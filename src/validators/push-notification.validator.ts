import { z } from 'zod';

export const subscribePushNotificationSchema = z.object({
  body: z.object({
    subscription: z.object({
      endpoint: z.string().trim().min(1),
      expirationTime: z.number().nullable().optional(),
      keys: z.object({
        p256dh: z.string().trim().min(1),
        auth: z.string().trim().min(1)
      })
    })
  })
});

export const unsubscribePushNotificationSchema = z.object({
  body: z.object({
    endpoint: z.string().trim().min(1)
  })
});
