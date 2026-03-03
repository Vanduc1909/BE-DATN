import passport from 'passport';

export const requireBearerAuth = passport.authenticate('bearer', { session: false });
