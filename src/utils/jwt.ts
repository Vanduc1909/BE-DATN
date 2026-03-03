import jwt, { type Secret, type SignOptions } from 'jsonwebtoken';

export const signJwt = <TPayload extends object>(
  payload: TPayload,
  secret: Secret,
  options: SignOptions
) => {
  return jwt.sign(payload, secret, options);
};

export const verifyJwt = <TPayload>(token: string, secret: Secret): TPayload => {
  return jwt.verify(token, secret) as TPayload;
};
