import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { signAccessToken } from '../lib/jwt.js';
import { AppError } from '../middleware/errorHandler.js';

const BCRYPT_ROUNDS = 12;
const REFRESH_TOKEN_BYTES = 32;
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const OTP_TTL_MS = 10 * 60 * 1000;

// Pre-computed hash to normalise timing when email is not found,
// preventing user enumeration via response time difference.
const DUMMY_HASH = bcrypt.hashSync('__sentinel__', 12);

export async function registerUser(
  email: string,
  password: string,
): Promise<{ id: string; email: string; createdAt: Date }> {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AppError(409, 'USER_EXISTS', 'An account with this email already exists');

  try {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    return await prisma.user.create({
      data: { email, passwordHash },
      select: { id: true, email: true, createdAt: true },
    });
  } catch (err) {
    if (err instanceof Error && (err as { code?: string }).code === 'P2002') {
      throw new AppError(409, 'USER_EXISTS', 'An account with this email already exists');
    }
    throw err;
  }
}

export async function loginUser(
  email: string,
  password: string,
): Promise<{ accessToken: string; refreshToken: string; user: { id: string; email: string } }> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, passwordHash: true },
  });

  const hash = user?.passwordHash ?? DUMMY_HASH;
  const passwordMatch = await bcrypt.compare(password, hash);

  if (!user || !passwordMatch) {
    throw new AppError(401, 'AUTH_INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const accessToken = signAccessToken(user.id);
  const refreshToken = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  await prisma.refreshToken.create({
    data: { userId: user.id, token: refreshToken, expiresAt },
  });

  return { accessToken, refreshToken, user: { id: user.id, email: user.email } };
}

export async function refreshTokens(
  incomingToken: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const existing = await prisma.refreshToken.findUnique({
    where: { token: incomingToken },
  });

  if (!existing || existing.revokedAt !== null || existing.expiresAt < new Date()) {
    throw new AppError(401, 'AUTH_REFRESH_INVALID', 'Refresh token is expired or has been revoked');
  }

  const newToken = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    }),
    prisma.refreshToken.create({
      data: { userId: existing.userId, token: newToken, expiresAt },
    }),
  ]);

  const accessToken = signAccessToken(existing.userId);
  return { accessToken, refreshToken: newToken };
}

export async function logoutUser(tokenValue: string): Promise<void> {
  const existing = await prisma.refreshToken.findUnique({ where: { token: tokenValue } });

  if (!existing || existing.revokedAt !== null) {
    return;
  }

  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: { revokedAt: new Date() },
  });
}

export async function sendOtp(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    await prisma.passwordResetOtp.updateMany({
      where: { userId: user.id, invalidatedAt: null },
      data: { invalidatedAt: new Date() },
    });

    const otp = crypto.randomInt(100000, 1000000).toString();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    await prisma.passwordResetOtp.create({
      data: { userId: user.id, otp, expiresAt, attemptsLeft: 5 },
    });

    console.log('[OTP]', otp);
  }
}

export async function resetPassword(
  email: string,
  otp: string,
  newPassword: string,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new AppError(401, 'AUTH_OTP_INVALID', 'Invalid or expired OTP');

  const now = new Date();
  const activeOtp = await prisma.passwordResetOtp.findFirst({
    where: {
      userId: user.id,
      invalidatedAt: null,
      expiresAt: { gt: now },
      attemptsLeft: { gt: 0 },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!activeOtp) throw new AppError(401, 'AUTH_OTP_INVALID', 'Invalid or expired OTP');

  if (activeOtp.otp !== otp) {
    const newAttemptsLeft = activeOtp.attemptsLeft - 1;
    await prisma.passwordResetOtp.update({
      where: { id: activeOtp.id },
      data: {
        attemptsLeft: newAttemptsLeft,
        invalidatedAt: newAttemptsLeft === 0 ? now : null,
      },
    });
    throw new AppError(401, 'AUTH_OTP_INVALID', 'Invalid or expired OTP');
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  await prisma.$transaction([
    prisma.passwordResetOtp.update({
      where: { id: activeOtp.id },
      data: { invalidatedAt: now },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    }),
    prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: now },
    }),
  ]);
}
