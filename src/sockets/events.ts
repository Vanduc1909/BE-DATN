import type { Server } from 'socket.io';

export const registerSocketEvents = (io: Server) => {
  io.on('connection', (socket) => {
    socket.on('client:ping', () => {
      socket.emit('server:pong', {
        timestamp: new Date().toISOString()
      });
    });

    socket.on('room:join', (payload: { roomId?: string }) => {
      if (!payload?.roomId) {
        return;
      }

      socket.join(payload.roomId);
    });

    socket.on('room:message', (payload: { roomId?: string; message?: string }) => {
      if (!payload?.roomId || !payload?.message) {
        return;
      }

      io.to(payload.roomId).emit('room:message', {
        roomId: payload.roomId,
        message: payload.message,
        senderId: socket.data.user?.id,
        timestamp: new Date().toISOString()
      });
    });
  });
};
