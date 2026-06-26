import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import type { CreateTagInput, UpdateTagInput } from '@noteapp/shared';

export interface TagResponse {
  id: string;
  name: string;
  color: string;
  createdAt: Date;
}

export interface TagListItem {
  id: string;
  name: string;
  color: string;
  noteCount: number;
}

async function assertTagOwner(userId: string, tagId: string): Promise<{
  id: string;
  name: string;
  color: string;
  createdAt: Date;
}> {
  const tag = await prisma.tag.findFirst({
    where: { id: tagId, userId, deletedAt: null },
    select: { id: true, name: true, color: true, createdAt: true },
  });
  if (!tag) {
    throw new AppError(404, 'TAG_NOT_FOUND', 'No tag with that ID exists for this user.');
  }
  return tag;
}

export async function createTag(userId: string, data: CreateTagInput): Promise<TagResponse> {
  try {
    const tag = await prisma.tag.create({
      data: { userId, name: data.name, color: data.color },
      select: { id: true, name: true, color: true, createdAt: true },
    });
    return tag;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new AppError(409, 'TAG_NAME_DUPLICATE', `A tag named '${data.name}' already exists.`);
    }
    throw e;
  }
}

export async function listTags(userId: string): Promise<TagListItem[]> {
  const tags = await prisma.tag.findMany({
    where: { userId, deletedAt: null },
    select: {
      id: true,
      name: true,
      color: true,
      _count: {
        select: {
          notes: { where: { note: { deletedAt: null } } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return tags.map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color,
    noteCount: t._count.notes,
  }));
}

export async function updateTag(
  userId: string,
  tagId: string,
  data: UpdateTagInput,
): Promise<TagResponse> {
  const tag = await assertTagOwner(userId, tagId);

  const hasUpdates = data.name !== undefined || data.color !== undefined;
  if (!hasUpdates) {
    return tag;
  }

  try {
    const updated = await prisma.tag.update({
      where: { id: tagId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.color !== undefined && { color: data.color }),
      },
      select: { id: true, name: true, color: true, createdAt: true },
    });
    return updated;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new AppError(409, 'TAG_NAME_DUPLICATE', `A tag named '${data.name}' already exists.`);
    }
    throw e;
  }
}

export async function deleteTag(userId: string, tagId: string): Promise<void> {
  await assertTagOwner(userId, tagId);
  await prisma.tag.update({
    where: { id: tagId },
    data: { deletedAt: new Date() },
  });
}
