import type { Response } from 'express';

const COOKIE_NAME = 'refreshToken';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'strict',
    path: '/auth',
    maxAge: MAX_AGE_MS,
    secure: process.env['NODE_ENV'] === 'production',
  });
}

export function clearRefreshCookie(res: Response): void {
  res.cookie(COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'strict',
    path: '/auth',
    maxAge: 0,
    secure: process.env['NODE_ENV'] === 'production',
  });
}
