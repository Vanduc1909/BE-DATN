import { logger } from '@config/logger';
import { sendBackofficeWebPushNotification } from '@services/push-notification.service';

if (io) {
  io.to(STAFF_NOTIFICATION_ROOM).emit('staff:notification', payload);
}

void sendBackofficeWebPushNotification({
  title: payload.title,
  body: payload.body,
  url: payload.url,
  tag: `staff-${payload.type}-${payload.id}`,
  metadata: payload.metadata
}).catch((error) => {
  logger.error(`Failed to broadcast Web Push notification: ${(error as Error).message}`);
});
