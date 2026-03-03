import passport from 'passport';
import { Strategy as BearerStrategy } from 'passport-http-bearer';

import { logger } from '@config/logger';
import { UserModel } from '@models/user.model';
import { verifyAccessToken } from '@services/token.service';

let strategyInitialized = false;

export const initPassport = () => {
  if (strategyInitialized) {
    return passport;
  }

  passport.use(
    new BearerStrategy((token, done) => {
      void (async () => {
        try {
          const payload = verifyAccessToken(token);
          const user = await UserModel.findById(payload.sub).lean();

          if (!user) {
            return done(null, false);
          }

          return done(null, {
            id: String(user._id),
            email: user.email,
            role: user.role
          });
        } catch (error) {
          logger.warn(`Bearer auth failed: ${(error as Error).message}`);
          return done(null, false);
        }
      })();
    })
  );

  strategyInitialized = true;
  return passport;
};
