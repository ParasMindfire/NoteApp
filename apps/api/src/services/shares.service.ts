import { randomBytes } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import type { CreateShareInput } from '@noteapp/shared';

export interface ShareResponse {
  token: string;
  shareUrl: string;
  expiresAt: Date | null;
  viewCount: number;
}

export interface ShareListItem {
  id: string;
  token: string;
  shareUrl: string;
  expiresAt: Date | null;
  revokedAt: Date | null;
  viewCount: number;
  createdAt: Date;
}

export interface PublicShareResponse {
  title: string;
  body: Prisma.JsonValue;
  viewCount: number;
  sharedAt: Date;
}

function buildShareUrl(token: string): string {
  const base = process.env['SHARE_BASE_URL'] ?? 'http://localhost:3000';
  return `${base}/public/shares/${token}`;
}

async function assertNoteOwner(userId: string, noteId: string): Promise<void> {
  const note = await prisma.note.findFirst({
    where: { id: noteId, userId, deletedAt: null },
    select: { id: true },
  });
  if (!note) throw new AppError(404, 'NOTE_NOT_FOUND', 'Note not found');
}

export async function createShare(
  userId: string,
  noteId: string,
  input: CreateShareInput,
): Promise<ShareResponse> {
  await assertNoteOwner(userId, noteId);

  const token = randomBytes(24).toString('base64url');
  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;

  const share = await prisma.noteShare.create({
    data: {
      noteId,
      token,
      expiresAt,
    },
    select: {
      token: true,
      expiresAt: true,
      viewCount: true,
    },
  });

  return {
    token: share.token,
    shareUrl: buildShareUrl(share.token),
    expiresAt: share.expiresAt,
    viewCount: share.viewCount,
  };
}

export async function revokeShare(
  userId: string,
  noteId: string,
  token: string,
): Promise<void> {
  await assertNoteOwner(userId, noteId);

  const share = await prisma.noteShare.findFirst({
    where: { noteId, token },
    select: { id: true, revokedAt: true },
  });

  if (!share) throw new AppError(404, 'SHARE_NOT_FOUND', 'Share link not found');

  if (share.revokedAt !== null) return;

  await prisma.noteShare.update({
    where: { id: share.id },
    data: { revokedAt: new Date() },
  });
}

export async function listShares(
  userId: string,
  noteId: string,
): Promise<ShareListItem[]> {
  await assertNoteOwner(userId, noteId);

  const shares = await prisma.noteShare.findMany({
    where: { noteId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      token: true,
      expiresAt: true,
      revokedAt: true,
      viewCount: true,
      createdAt: true,
    },
  });

  return shares.map((s) => ({
    id: s.id,
    token: s.token,
    shareUrl: buildShareUrl(s.token),
    expiresAt: s.expiresAt,
    revokedAt: s.revokedAt,
    viewCount: s.viewCount,
    createdAt: s.createdAt,
  }));
}

export async function viewPublicShare(token: string): Promise<PublicShareResponse> {
  const share = await prisma.noteShare.findUnique({
    where: { token },
    include: {
      note: {
        select: { title: true, body: true, deletedAt: true },
      },
    },
  });

  if (!share || share.note.deletedAt !== null) {
    throw new AppError(410, 'GONE_LINK_INVALID', 'This share link has expired or been revoked');
  }

  const now = new Date();
  if (share.revokedAt !== null || (share.expiresAt !== null && share.expiresAt < now)) {
    throw new AppError(410, 'GONE_LINK_INVALID', 'This share link has expired or been revoked');
  }

  const updated = await prisma.noteShare.update({
    where: { id: share.id },
    data: { viewCount: { increment: 1 } },
    select: { viewCount: true },
  });

  return {
    title: share.note.title,
    body: share.note.body,
    viewCount: updated.viewCount,
    sharedAt: share.createdAt,
  };
}
