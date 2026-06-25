import jwt from 'jsonwebtoken';

function getSecret(): string {
  const secret = process.env['JWT_SECRET'];
  if (!secret) throw new Error('JWT_SECRET env var is required');
  return secret;
}

export interface AccessTokenPayload {
  sub: string;
  iat: number;
  exp: number;
}

export function signAccessToken(userId: string): string {
  return jwt.sign({ sub: userId }, getSecret(), { expiresIn: '15m' });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, getSecret()) as AccessTokenPayload;
}
