import { getMongoHealth } from '@config/mongoose';
import { asyncHandler } from '@utils/async-handler';
import { sendSuccess } from '@utils/response';

export const healthController = asyncHandler(async (_req, res) => {
  return sendSuccess(res, {
    message: 'Service is healthy',
    data: {
      app: 'up',
      mongo: getMongoHealth(),
      timestamp: new Date().toISOString()
    }
  });
});
