import {
  createConversationController,
  joinConversationController,
  listMessagesController,
  listMyConversationsController,
  markMessageAsReadController,
  sendMessageController
} from '@controllers/chat.controller';
import { requireBearerAuth } from '@middlewares/auth.middleware';
import { parsePaginationMiddleware } from '@middlewares/pagination.middleware';
import { requireRoles } from '@middlewares/rbac.middleware';
import { validate } from '@middlewares/validate.middleware';
import {
  conversationIdParamSchema,
  createConversationSchema,
  listConversationsSchema,
  listMessagesSchema,
  messageIdParamSchema,
  sendMessageSchema
} from '@validators/chat.validator';
import { Router } from 'express';

const chatRouter = Router();

chatRouter.use(requireBearerAuth);
chatRouter.post('/conversations', validate(createConversationSchema), createConversationController);
chatRouter.get(
  '/conversations',
  validate(listConversationsSchema),
  parsePaginationMiddleware,
  listMyConversationsController
);
chatRouter.post(
  '/conversations/:conversationId/join',
  requireRoles('staff', 'admin'),
  validate(conversationIdParamSchema),
  joinConversationController
);
chatRouter.get(
  '/conversations/:conversationId/messages',
  validate(listMessagesSchema),
  parsePaginationMiddleware,
  listMessagesController
);
chatRouter.post(
  '/conversations/:conversationId/messages',
  validate(sendMessageSchema),
  sendMessageController
);
chatRouter.patch(
  '/messages/:messageId/read',
  validate(messageIdParamSchema),
  markMessageAsReadController
);

export default chatRouter;