import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';

// ─── Internal DB row from $queryRaw ─────────────────────────────────────────

interface SearchRow {
  id: string;
  title: string;
  body: unknown;
  version: number;
  tagIds: string | string[]; // PostgreSQL may return array literal string "{clx1}" or JS array
  createdAt: Date;
  updatedAt: Date;
  rank: number;
  headline: string;
}

// ─── Public types ────────────────────────────────────────────────────────────

// Re-declared locally to avoid cross-service imports (FR-ARCH-1)
export interface NoteResponse {
  id: string;
  title: string;
  body: unknown;
  tagIds: string[];
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SearchInput {
  q: string;
  cursor?: string;
  limit: number;
}

export interface SearchResultItem {
  note: NoteResponse;
  headline: string;
}

export interface SearchResultPage {
  items: SearchResultItem[];
  nextCursor: string | null;
}

// ─── Cursor helpers ──────────────────────────────────────────────────────────

interface SearchCursor {
  lastId: string;
  lastRank: number;
}

function encodeSearchCursor(lastId: string, lastRank: number): string {
  return Buffer.from(JSON.stringify({ lastId, lastRank })).toString('base64url');
}

function decodeSearchCursor(raw: string): SearchCursor {
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as unknown;
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as Record<string, unknown>)['lastId'] !== 'string' ||
      typeof (parsed as Record<string, unknown>)['lastRank'] !== 'number'
    ) {
      throw new Error('bad shape');
    }
    return parsed as SearchCursor;
  } catch {
    throw new AppError(400, 'VALIDATION_FAILED', 'Invalid pagination cursor');
  }
}

// ─── tagIds parsing helper ───────────────────────────────────────────────────

function parseTagIds(raw: string | string[]): string[] {
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (!raw || raw === '{}') return [];
  return raw.slice(1, -1).split(',').filter(Boolean);
}

// ─── Row → NoteResponse ──────────────────────────────────────────────────────

function toNoteResponse(row: SearchRow): NoteResponse {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    tagIds: parseTagIds(row.tagIds),
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ─── searchNotes ─────────────────────────────────────────────────────────────

export async function searchNotes(userId: string, input: SearchInput): Promise<SearchResultPage> {
  const { q, cursor, limit } = input;

  // Decode cursor if provided
  let cursorClause = Prisma.empty;
  if (cursor) {
    const { lastId, lastRank } = decodeSearchCursor(cursor);
    cursorClause = Prisma.sql`
      AND (
        ts_rank(to_tsvector('english', n.title || ' ' || n."bodyText"), plainto_tsquery('english', ${q}))::real < ${lastRank}::real
        OR (
          ts_rank(to_tsvector('english', n.title || ' ' || n."bodyText"), plainto_tsquery('english', ${q}))::real = ${lastRank}::real
          AND n.id > ${lastId}
        )
      )`;
  }

  const fetchLimit = limit + 1;

  const rows = await prisma.$queryRaw<SearchRow[]>(Prisma.sql`
    SELECT
      n.id,
      n.title,
      n.body,
      n.version,
      n."createdAt",
      n."updatedAt",
      ts_rank(to_tsvector('english', n.title || ' ' || n."bodyText"), plainto_tsquery('english', ${q})) AS rank,
      ts_headline('english', n.title || ' ' || n."bodyText", plainto_tsquery('english', ${q}),
        'MaxFragments=3,MaxWords=15,MinWords=5,StartSel=<mark>,StopSel=</mark>') AS headline,
      COALESCE(array_agg(nt."tagId") FILTER (WHERE nt."tagId" IS NOT NULL), ARRAY[]::text[]) AS "tagIds"
    FROM "Note" n
    LEFT JOIN "NoteTag" nt ON nt."noteId" = n.id
    WHERE n."userId" = ${userId}
      AND n."deletedAt" IS NULL
      AND to_tsvector('english', n.title || ' ' || n."bodyText") @@ plainto_tsquery('english', ${q})
      ${cursorClause}
    GROUP BY n.id
    ORDER BY rank DESC, n.id ASC
    LIMIT ${fetchLimit}
  `);

  // Detect next page
  let nextCursor: string | null = null;
  if (rows.length > limit) {
    rows.pop();
    const last = rows[rows.length - 1];
    if (last) {
      nextCursor = encodeSearchCursor(last.id, last.rank);
    }
  }

  const items: SearchResultItem[] = rows.map((row) => ({
    note: toNoteResponse(row),
    headline: row.headline,
  }));

  return { items, nextCursor };
}
