import { env } from '@config/env';
import { logger } from '@config/logger';
import { getMailerTransporter, isMailerConfigured } from '@config/mailer';

interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

const EMAIL_ADDRESS_REGEX = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

const sanitizeHeaderValue = (value?: string) => {
  return value?.replace(/[\r\n]+/g, '').trim();
};

const extractEmailAddress = (value?: string) => {
  const nomalized = sanitizeHeaderValue(value);

  if (!nomalized) {
    return undefined;
  }

  const angleMatch = nomalized.match(/<([^>]+)>/);
  const candidate = (angleMatch ? angleMatch[1] : nomalized).trim();

  return EMAIL_ADDRESS_REGEX.test(candidate) ? candidate : undefined;
};

export const sendMail = async (input: SendMailInput) => {
  if (!isMailerConfigured()) {
    logger.warn('Mailer is not configured. Email was not sent.');
    return false;
  }

  const transporter = getMailerTransporter();

  if (!transporter) {
    logger.warn('Mailer transporter unavailable. Email was not sent.');
    return false;
  }

  const configuredForm = sanitizeHeaderValue(input.from ?? env.SMTP_FROM);
  const fallbackSenderAddress = extractEmailAddress(env.SMTP_FROM);
  const senderAddress = extractEmailAddress(configuredForm) || fallbackSenderAddress;
  const senderHeader = extractEmailAddress(configuredForm) ? configuredForm : senderAddress;
  const recipientAddress = extractEmailAddress(input.to);
  const replyToAddress = extractEmailAddress(input.replyTo);

  if (!senderAddress || !senderHeader) {
    logger.warn('Mailer sender is invalid. Email was not sent.');
    return false;
  }

  if (!recipientAddress) {
    logger.warn(`Mailer recipient is invalid: ${input.to}. Email was not sent.`);
    return false;
  }

  try {
    await transporter.sendMail({
      from: senderHeader,
      to: recipientAddress,
      envelope: {
        from: senderAddress,
        to: recipientAddress
      },
      html: input.html,
      text: input.text,
      replyTo: replyToAddress
    });
  } catch (error) {
    logger.error(`Failed to send email to ${recipientAddress}: ${(error as Error).message}`);
    return false;
  }

  return true;
};
