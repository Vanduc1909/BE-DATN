import nodemailer from 'nodemailer';

import { env } from '@config/env';
import { logger } from '@config/logger';

const mailerConfigured = Boolean(
  env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASS && env.SMTP_FROM
);

const mailTransporter = mailerConfigured
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: false,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS
      }
    })
  : null;

export const verifyMailer = async () => {
  if (!mailTransporter) {
    logger.warn('Nodemailer is not configured');
    return;
  }

  try {
    await mailTransporter.verify();
    logger.info('Nodemailer connected');
  } catch (error) {
    logger.error(`Nodemailer verification failed: ${(error as Error).message}`);
  }
};

export const getMailerTransporter = () => mailTransporter;

export const isMailerConfigured = () => mailerConfigured;
