import authRouter from '@routes/auth.route';
import healthRouter from '@routes/health.route';
import { Router } from 'express';
import categoryRouter from '@routes/category.route';
import chatbotRouter from '@routes/chatbot.route';
import pushNotificationRouter from '@routes/pushNotification.route';
import chatRouter from '@routes/chat.route';
const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);

apiRouter.use('/categories', categoryRouter);
apiRouter.use('/chat', chatRouter);
apiRouter.use('/chatbot', chatbotRouter);
apiRouter.use('/notifications', pushNotificationRouter);
export default apiRouter;
