import { createLogger, format, transports } from 'winston';

import { env } from '@config/env';

const devFormat = format.combine(
  format.colorize(),
  format.timestamp(),
  format.printf(({ level, message, timestamp, stack }) => {
    return `${timestamp} [${level}] ${stack ?? message}`;
  })
);

const jsonFormat = format.combine(
  format.timestamp(),
  format.errors({ stack: true }),
  format.json()
);

export const logger = createLogger({
  level: env.LOG_LEVEL,
  format: env.isDevelopment ? devFormat : jsonFormat,
  transports: [new transports.Console({ silent: env.isTest })],
  defaultMeta: {
    service: env.APP_NAME,
    environment: env.NODE_ENV
  }
});
