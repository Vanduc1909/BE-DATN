import { askChatbot } from '@services/chatbot.service';
import { asyncHandler } from '@utils/async-handler';
import { sendSuccess } from '@utils/response';

export const askChatbotController = asyncHandler(async (req, res) => {
  const data = await askChatbot({
    question: req.body.question,
    context: req.body.context
  });

  return sendSuccess(res, {
    message: 'Get chatbot response successfully',
    data
  });
});
