import { z } from 'zod';

export const askChatbotSchema = z.object({
  body: z.object({
    question: z.string().trim().min(2).max(1000),
    context: z
      .object({
        path: z.string().trim().min(1).max(300).optional()
      })
      .optional()
  })
});
