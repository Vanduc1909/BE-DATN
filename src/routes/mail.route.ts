import { sendTestMailController } from '@/controllers/mail.controller';
import { requireBearerAuth } from '@/middlewares/auth.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { sendTestMailSchema } from '@/validators/mail.validators';
import { Router } from 'express';

const mailRouter = Router();

mailRouter.post('/test', requireBearerAuth, validate(sendTestMailSchema), sendTestMailController);

export default mailRouter;
