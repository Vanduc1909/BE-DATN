import authRouter from '@routes/auth.route';
import healthRouter from '@routes/health.route';
import { Router } from 'express';
import categoryRouter from './category.route';
import chatbotRouter from './chatbot.route';
import pushNotificationRouter from './push-notification.route';

const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);

apiRouter.use('/categories', categoryRouter);
apiRouter.use('/chatbot', chatbotRouter);
apiRouter.use('/notifications', pushNotificationRouter);
export default apiRouter;
