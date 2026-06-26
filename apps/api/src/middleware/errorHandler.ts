import type { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    public readonly detail: string,
  ) {
    super(detail);
    this.name = 'AppError';
  }
}

const CODE_TITLES: Record<string, string> = {
  VALIDATION_FAILED: 'Validation failed',
  USER_EXISTS: 'User already exists',
  AUTH_INVALID_CREDENTIALS: 'Invalid credentials',
  AUTH_TOKEN_INVALID: 'Unauthorized',
  AUTH_REFRESH_INVALID: 'Refresh token invalid',
  AUTH_OTP_INVALID: 'Invalid or expired OTP',
  RATE_LIMITED: 'Too many requests',
};

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      type: `https://api.example.com/errors/${err.code}`,
      title: CODE_TITLES[err.code] ?? 'An error occurred',
      status: err.statusCode,
      detail: err.detail,
      code: err.code,
    });
    return;
  }
  console.error(err);
  res.status(500).json({
    type: 'https://api.example.com/errors/INTERNAL_ERROR',
    title: 'Internal server error',
    status: 500,
    detail: 'An unexpected error occurred',
    code: 'INTERNAL_ERROR',
  });
}
