import { getSocketServer } from '@config/socket';

export const STAFF_NOTIFICATION_ROOM = 'backoffice:notifications';

export type StaffNotificationType = 'order_created' | 'comment_created' | 'review_created';

export interface StaffRealtimeNotificationPayload {
  id: string;
  type: StaffNotificationType;
  title: string;
  body: string;
  createdAt: string;
  url: string;
  metadata?: Record<string, unknown>;
}

export const emitStaffRealtimeNotification = (payload: StaffRealtimeNotificationPayload) => {
  const io = getSocketServer();

  if (!io) {
    return;
  }

  io.to(STAFF_NOTIFICATION_ROOM).emit('staff:notification', payload);
};