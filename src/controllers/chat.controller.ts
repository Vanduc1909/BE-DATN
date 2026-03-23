import { StatusCodes } from 'http-status-codes';

import {
  createSupportConversation,
  joinConversationAsStaff,
  listConversationMessages,
  listMyConversations,
  markMessageAsRead,
  sendMessageToConversation
} from '@services/chat.service';
import { ApiError } from '@utils/api-error';
import { asyncHandler } from '@utils/async-handler';
import { getParam } from '@utils/request';
import { sendSuccess } from '@utils/response';
import type { Request } from 'express';

const getUserId = (req: Request) => {
  const userId = req.user?.id;

  if (!userId) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Unauthorized');
  }

  return userId;
};

export const createConversationController = asyncHandler(async (req, res) => {
  const data = await createSupportConversation(getUserId(req), req.body?.initialMessage);

  return sendSuccess(res, {
    statusCode: StatusCodes.CREATED,
    message: 'Create conversation successfully',
    data
  });
});

export const listMyConversationsController = asyncHandler(async (req, res) => {
  const data = await listMyConversations(getUserId(req), {
    page: res.locals.pagination?.page ?? 1,
    limit: res.locals.pagination?.limit ?? 20
  });

  return sendSuccess(res, {
    message: 'Get conversations successfully',
    data
  });
});

export const joinConversationController = asyncHandler(async (req, res) => {
  const data = await joinConversationAsStaff(
    getParam(req.params.conversationId, 'conversationId'),
    getUserId(req)
  );

  return sendSuccess(res, {
    message: 'Join conversation successfully',
    data
  });
});

export const listMessagesController = asyncHandler(async (req, res) => {
  const data = await listConversationMessages(
    getParam(req.params.conversationId, 'conversationId'),
    getUserId(req),
    {
      page: res.locals.pagination?.page ?? 1,
      limit: res.locals.pagination?.limit ?? 20
    }
  );

  return sendSuccess(res, {
    message: 'Get messages successfully',
    data
  });
});

export const sendMessageController = asyncHandler(async (req, res) => {
  const data = await sendMessageToConversation(
    getParam(req.params.conversationId, 'conversationId'),
    getUserId(req),
    req.body.content
  );

  return sendSuccess(res, {
    statusCode: StatusCodes.CREATED,
    message: 'Send message successfully',
    data
  });
});

export const markMessageAsReadController = asyncHandler(async (req, res) => {
  const data = await markMessageAsRead(getParam(req.params.messageId, 'messageId'), getUserId(req));

  return sendSuccess(res, {
    message: 'Mark message as read successfully',
    data
  });
});