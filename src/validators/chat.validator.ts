import { z } from 'zod';

export const createConversationSchema = z.object({
  body: z.object({
    initialMessage: z.string().min(1).max(4000).optional()
  })
});

export const listConversationsSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional()
  })
});

export const conversationIdParamSchema = z.object({
  params: z.object({
    conversationId: z.string().min(1)
  })
});

export const listMessagesSchema = z.object({
  params: z.object({
    conversationId: z.string().min(1)
  }),
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional()
  })
});

export const sendMessageSchema = z.object({
  params: z.object({
    conversationId: z.string().min(1)
  }),
  body: z.object({
    content: z.string().min(1).max(4000)
  })
});

export const messageIdParamSchema = z.object({
  params: z.object({
    messageId: z.string().min(1)
  })
});
