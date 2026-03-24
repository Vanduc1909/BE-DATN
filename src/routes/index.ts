import authRouter from '@routes/auth.route';
import healthRouter from '@routes/health.route';
import { Router } from 'express';
import categoryRouter from './category.route';

const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);

apiRouter.use('/categories', categoryRouter);
export default apiRouter;
