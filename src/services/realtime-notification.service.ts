import { getSocketServer } from '@config/socket';
import { sendBackofficeWebPushNotification } from './push-notification.service';
import { logger } from '@/config/logger';

export const STAFF_NOTIFICATION_ROOM = 'backoffice:notifications';

export type StaffNotificationType =
  | 'order_created'
  | 'comment_created'
  | 'review_created'
  | 'chat_message';

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

  if (io) {
    io.to(STAFF_NOTIFICATION_ROOM).emit('staff:notification', payload);
  }

  void sendBackofficeWebPushNotification({
    title: payload.title,
    body: payload.body,
    url: payload.url,
    tag:`staff-${payload.type}-${payload.id}`,
    metadata: payload.metadata
  }).catch((error) => {
    logger.error(`Failed to send web push notification for staff notification: ${(error as Error).message}`);
  });
};
