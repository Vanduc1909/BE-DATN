import { env } from '@/config/env';
import { logger } from '@/config/logger';
import { ApiError } from '@/utils/api-error';
import { PAYMENT_REQUIRED, StatusCodes } from 'http-status-codes';
import crypto from 'node:crypto';

interface ZalopayCreateOrderInput {
  appTransId: string;
  appUser: string;
  appTime?: number;
  amount: number;
  description: string;
  items: Array<Record<string, unknown>>;
  embedData?: Record<string, unknown>;
  bankCode?: string;
  redirectUrl?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface ZalopayCreateOrderResult {
  appTransId: string;
  orderUrl: string;
  zpTransToken?: string;
}

export interface ZalopayCallbackPayload {
  data: string;
  mac: string;
  type?: number | string;
}

export interface ZalopayCallbackData {
  app_id?: number;
  app_trans_id?: string;
  app_user?: string;
  amount?: number;
  zp_trans_id?: number | string;
  server_time?: number;
  channel?: string;
  merchant_user_id?: string;
  return_code?: number;
  return_message?: string;
  sub_return_code?: number;
  sub_return_message?: string;
}

export interface ZalopayRedirectPayload {
  appid?: string;
  apptransid?: string;
  pmcid?: string;
  bankcode?: string;
  amount?: string | number;
  discountamount?: string | number;
  status?: string | number;
  checksum?: string;
}

export interface ZalopayRedirectVerifyResult {
  isVerified: boolean;
  appTransId: string;
  status: number;
  amount: number;
  discountAmount: number;
}

export interface ZalopayQueryResult {
  returnCode: number;
  returnMessage: string;
  zpTransId?: string;
}

const isZalopayConfigured = () => {
  return Boolean(
    env.ZALOPAY_APP_ID &&
    env.ZALOPAY_KEY1 &&
    env.ZALOPAY_KEY2 &&
    env.ZALOPAY_CREATE_ENDPOINT &&
    env.ZALOPAY_QUERY_ENDPOINT
  );
};

const assertZalopayConfigured = () => {
  if (!isZalopayConfigured()) {
    throw new ApiError(StatusCodes.SERVICE_UNAVAILABLE, 'ZaloPay chưa được cấu hình');
  }
};

const toNumber = (value: unknown) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

const normalizeMac = (value: string) => value.trim().toLowerCase();

const signHmacSha256 = (key: string, data: string) => {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest('hex');
};

const buildEmbedData = (embedData?: Record<string, unknown>, redirectUrl?: string) => {
  const payload: Record<string, unknown> = { ...(embedData ?? {}) };

  if (redirectUrl) {
    payload.redirecturl = redirectUrl;
  } else if (env.ZALOPAY_REDIRECT_URL) {
    payload.redirecturl = env.ZALOPAY_REDIRECT_URL;
  }

  return JSON.stringify(payload);
};

const safeJsonParse = <T>(value: string): T | null => {
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    return null;
  }
};

const isZalopayDebug = () => String(env.ZALOPAY_DEBUG ?? '').toLowerCase() === 'true';

export const createZalopayPaymentUrl = async (
  input: ZalopayCreateOrderInput
): Promise<ZalopayCreateOrderResult> => {
  assertZalopayConfigured();

  const appId = String(env.ZALOPAY_APP_ID ?? '').trim();
  const appTime = input.appTime ?? Date.now();
  const amount = Math.round(Math.max(0, input.amount));
  const item = JSON.stringify(input.items ?? []);
  const embedData = buildEmbedData(input.embedData, input.redirectUrl);
  const bankCode = String(input.bankCode ?? env.ZALOPAY_BANK_CODE ?? '').trim();
  const payload: Record<string, string> = {
    appid: appId,
    apptransid: input.appTransId,
    appuser: input.appUser,
    apptime: String(appTime),
    amount: String(amount),
    embeddata: embedData,
    item,
    description: input.description,
    bankcode: bankCode
  };

  if (isZalopayDebug()) {
    logger.info('[ZaloPay] create payload', {
      endpoint: env.ZALOPAY_CREATE_ENDPOINT,
      appid: payload.appid ?? payload.app_id,
      apptransid: payload.apptransid ?? payload.app_trans_id,
      appuser: payload.appuser ?? payload.app_user,
      apptime: payload.apptime ?? payload.app_time,
      amount: payload.amount,
      bankcode: payload.bankcode ?? payload.bank_code,
      embeddataLength: String(payload.embeddata ?? payload.embed_data ?? '').length,
      itemLength: String(payload.item ?? '').length
    });
  }

  if (input.phone) {
    payload.phone = input.phone;
  }

  if (input.email) {
    payload.email = input.email;
  }

  if (input.address) {
    payload.address = input.address;
  }

  const macData = [
    appId,
    input.appTransId,
    input.appUser,
    String(amount),
    String(appTime),
    embedData,
    item
  ].join('|');

  payload.mac = signHmacSha256(env.ZALOPAY_KEY1 ?? '', macData);

  const response = await fetch(env.ZALOPAY_CREATE_ENDPOINT ?? '', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams(payload).toString()
  });

  if (!response.ok) {
    throw new ApiError(StatusCodes.BAD_GATEWAY, 'Không thể tạo giao dịch ZaloPay');
  }

  const data = (await response.json()) as {
    return_code?: number;
    returncode?: number;
    return_message?: string;
    returnmessage?: string;
    sub_return_code?: number;
    sub_returncode?: number;
    sub_return_message?: string;
    sub_returnmessage?: string;
    order_url?: string;
    orderurl?: string;
    zp_trans_token?: string;
    zptranstoken?: string;
  };

  const returnCode = Number(data.return_code ?? data.returncode ?? 0);
  const orderUrl = data.order_url ?? data.orderurl;
  const returnMessage = data.return_message ?? data.returnmessage;
  const subReturnCode = Number(data.sub_return_code ?? data.sub_returncode ?? 0);
  const subReturnMessage = data.sub_return_message ?? data.sub_returnmessage;

  if (isZalopayDebug()) {
    logger.info('[ZaloPay] create response', {
      returnCode,
      returnMessage,
      subReturnCode,
      subReturnMessage
    });
  }

  if (returnCode !== 1 || !orderUrl) {
    const detail = [
      returnMessage ? `ZaloPay: ${returnMessage}` : 'Không thể tạo giao dịch ZaloPay',
      subReturnCode ? `sub:${subReturnCode}` : '',
      subReturnMessage ? subReturnMessage : ''
    ]
      .filter(Boolean)
      .join(' ');
    throw new ApiError(StatusCodes.BAD_GATEWAY, detail);
  }

  return {
    appTransId: input.appTransId,
    orderUrl,
    zpTransToken: data.zp_trans_token ?? data.zptranstoken
  };
};

export const verifyZalopayCallback = (
  payload: ZalopayCallbackPayload
): { isVerified: boolean; data?: ZalopayCallbackData } => {
  assertZalopayConfigured();

  if (!payload.data || !payload.mac) {
    throw new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, 'Thiếu dữ liệu callback ZaloPay');
  }

  const expectedMac = signHmacSha256(env.ZALOPAY_KEY2 ?? '', payload.data);
  const isVerified = normalizeMac(expectedMac) === normalizeMac(payload.mac);

  if (!isVerified) {
    return { isVerified };
  }

  const parsed = safeJsonParse<ZalopayCallbackData>(payload.data);
  return {
    isVerified,
    data: parsed ?? undefined
  };
};

export const verifyZalopayRedirect = (
  payload: ZalopayRedirectPayload
): ZalopayRedirectVerifyResult => {
  assertZalopayConfigured();

  const appTransId = String(payload.apptransid ?? '').trim();
  const checksum = String(payload.checksum ?? '').trim();

  if (!appTransId || !checksum) {
    throw new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, 'Thiếu dữ liệu redirect ZaloPay');
  }

  const checksumData = [
    String(payload.appid ?? ''),
    appTransId,
    String(payload.pmcid ?? ''),
    String(payload.bankcode ?? ''),
    String(payload.amount ?? ''),
    String(payload.discountamount ?? ''),
    String(payload.status ?? '')
  ].join('|');

  const expected = signHmacSha256(env.ZALOPAY_KEY2 ?? '', checksumData);
  const isVerified = normalizeMac(expected) === normalizeMac(checksum);

  return {
    isVerified,
    appTransId,
    status: Math.trunc(toNumber(payload.status)),
    amount: toNumber(payload.amount),
    discountAmount: toNumber(payload.discountamount)
  };
};

export const queryZalopayOrderStatus = async (appTransId: string): Promise<ZalopayQueryResult> => {
  assertZalopayConfigured();

  const appId = String(env.ZALOPAY_APP_ID ?? '').trim();
  const normalizedTransId = appTransId.trim();

  const macData = `${appId}|${normalizedTransId}|${env.ZALOPAY_KEY1 ?? ''}`;
  const mac = signHmacSha256(env.ZALOPAY_KEY1 ?? '', macData);

  const payload = new URLSearchParams({
    appid: appId,
    apptransid: normalizedTransId,
    mac
  });

  const response = await fetch(env.ZALOPAY_QUERY_ENDPOINT ?? '', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: payload.toString()
  });

  if (!response.ok) {
    throw new ApiError(StatusCodes.BAD_GATEWAY, 'Không thể truy vấn trạng thái ZaloPay');
  }

  const data = (await response.json()) as {
    return_code?: number;
    returncode?: number;
    return_message?: string;
    returnmessage?: string;
    zp_trans_id?: string | number;
    zptransid?: string | number;
  };

  const returnCode = Number(data.return_code ?? data.returncode ?? 0);
  const returnMessage = String(data.return_message ?? data.returnmessage ?? '');
  const zpTransId = data.zp_trans_id ?? data.zptransid;

  return {
    returnCode,
    returnMessage,
    zpTransId: zpTransId ? String(zpTransId) : undefined
  };
};
