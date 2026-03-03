import type { Server as HttpServer } from 'http';

import { Server } from 'socket.io';

import { env } from '@config/env';
import { logger } from '@config/logger';
import { verifyAccessToken } from '@services/token.service';
import { registerSocketEvents } from '@sockets/events';

let ioInstance: Server | null = null;

export const initSocketServer = (httpServer: HttpServer) => {
  if (ioInstance) {
    return ioInstance;
  }

  const io = new Server(httpServer, {
    cors: {
      origin: env.corsOriginList === '*' ? true : env.corsOriginList,
      credentials: true
    }
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token as string | undefined;

    if (!token) {
      return next(new Error('Unauthorized: missing token'));
    }

    try {
      const payload = verifyAccessToken(token);
      socket.data.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role
      };
      return next();
    } catch {
      return next(new Error('Unauthorized: invalid token'));
    }
  });

  registerSocketEvents(io);
  ioInstance = io;
  logger.info('Socket.IO initialized');
  return io;
};

export const getSocketServer = () => ioInstance;
