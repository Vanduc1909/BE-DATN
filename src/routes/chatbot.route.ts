import { askChatbotController } from '@controllers/chatbot.controller';
import { validate } from '@middlewares/validate.middleware';
import { askChatbotSchema } from '@validators/chatbot.validator';
import { Router } from 'express';

const chatbotRouter = Router();

chatbotRouter.post('/ask', validate(askChatbotSchema), askChatbotController);

export default chatbotRouter;
