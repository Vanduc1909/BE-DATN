import { env } from '@/config/env';
import { ApiError } from '@/utils/api-error';
import { PAYMENT_REQUIRED, StatusCodes } from 'http-status-codes';
import crypto from 'node:crypto';

interface ZalopayCreateOrderInput {
  appTransId: string;
  appUser: string;
  amount: number;
  description: string;
  items: Array<Record<string, unknown>>;
  embedData?: Record<string, unknown>;
  callbackUrl?: string;
  redirectUrl?: string;
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

export const createZalopayPaymentUrl = async (
  input: ZalopayCreateOrderInput
): Promise<ZalopayCreateOrderResult> => {
  assertZalopayConfigured();

  const appId = env.ZALOPAY_APP_ID ?? '';
  const appTime = Date.now();
  const amount = Math.round(Math.max(0, input.amount));
  const item = JSON.stringify(input.items ?? []);
  const embedData = buildEmbedData(input.embedData, input.redirectUrl);

  const payload: Record<string, string> = {
    app_id: appId,
    app_trans_id: input.appTransId,
    app_user: input.appUser,
    app_time: String(appTime),
    amount: String(amount),
    item,
    embed_data: embedData,
    description: input.description
  };

  const callbackUrl = input.callbackUrl ?? env.ZALOPAY_CALLBACK_URL;

  if (callbackUrl) {
    payload.callback_url = callbackUrl;
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
    return_message?: string;
    order_url?: string;
    zp_trans_token?: string;
  };

  if (data.return_code !== 1 || !data.order_url) {
    throw new ApiError(
      StatusCodes.BAD_GATEWAY,
      data.return_message ? `ZaloPay: ${data.return_message}` : 'Không thể tạo giao dịch ZaloPay'
    );
  }

  return {
    appTransId: input.appTransId,
    orderUrl: data.order_url,
    zpTransToken: data.zp_trans_token
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

  const appId = env.ZALOPAY_APP_ID ?? '';
  const normalizedTransId = appTransId.trim();

  const macData = `${appId}|${normalizedTransId}|${env.ZALOPAY_KEY1 ?? ''}`;
  const mac = signHmacSha256(env.ZALOPAY_KEY1 ?? '', macData);

  const payload = new URLSearchParams({
    app_id: appId,
    app_trans_id: normalizedTransId,
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
    return_message?: string;
    zp_trans_id?: string | number;
  };

  return {
    returnCode: Number(data.return_code ?? 0),
    returnMessage: String(data.return_message ?? ''),
    zpTransId: data.zp_trans_id ? String(data.zp_trans_id) : undefined
  };
};
