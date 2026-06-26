/**
 * Integration tests for search.service.ts
 *
 * Coverage:
 *   SEARCH-S1         → FR-SEARCH-1: returns matching note for keyword found in body
 *   SEARCH-S2         → FR-SEARCH-1: returns empty items when no notes match query
 *   SEARCH-HIGHLIGHT-S1 → FR-SEARCH-2: headline contains <mark> tags around matched term
 *   SEARCH-PAGE-S1    → FR-SEARCH-3: returns nextCursor when results exceed limit
 *   SEARCH-PAGE-S2    → FR-SEARCH-3: second page using nextCursor returns remaining items
 *
 * Calls searchNotes() directly against the real DB — no HTTP layer.
 */

import 'dotenv/config';

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import bcrypt from 'bcrypt';

import { prisma } from '../lib/prisma.js';
import { searchNotes } from '../services/search.service.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OWNER_EMAIL = `search-service-owner-${Date.now()}@example.com`;
const TEST_PASSWORD = 'Secur3Pass';

// ---------------------------------------------------------------------------
// User IDs (populated in beforeAll)
// ---------------------------------------------------------------------------

let ownerId: string;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTipTapBody(text: string) {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text }],
      },
    ],
  };
}

async function seedNote(title: string, bodyText: string) {
  return prisma.note.create({
    data: {
      userId: ownerId,
      title,
      body: makeTipTapBody(bodyText),
    },
  });
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeAll(async () => {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 1);

  const owner = await prisma.user.upsert({
    where: { email: OWNER_EMAIL },
    create: { email: OWNER_EMAIL, passwordHash },
    update: {},
  });
  ownerId = owner.id;
});

beforeEach(async () => {
  // Clean in correct FK order
  await prisma.noteTag.deleteMany({ where: { note: { userId: ownerId } } });
  await prisma.noteVersion.deleteMany({ where: { note: { userId: ownerId } } });
  await prisma.note.deleteMany({ where: { userId: ownerId } });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: OWNER_EMAIL } });
  await prisma.$disconnect();
});

// ---------------------------------------------------------------------------
// SEARCH-S1: Match found in body
// FR-SEARCH-1: items non-empty, headline contains <mark>
// ---------------------------------------------------------------------------

describe('SEARCH-S1: returns matching note for keyword found in body (FR-SEARCH-1)', () => {
  it('SEARCH-S1: returns matching note for keyword found in body', async () => {
    await seedNote('Q3 Planning', 'quarterly review of all departments');
    // Wait for transaction to fully commit before FTS query
    await new Promise((r) => setTimeout(r, 100));

    const result = await searchNotes(ownerId, { q: 'review', limit: 20 });

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0].headline).toContain('<mark>');
    // Verify the returned note has expected shape
    const note = result.items[0].note;
    expect(note.id).toBeDefined();
    expect(note.title).toBeDefined();
    expect(note.version).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(note.tagIds)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// SEARCH-S2: No match
// FR-SEARCH-1: items empty, nextCursor null
// ---------------------------------------------------------------------------

describe('SEARCH-S2: returns empty items when no notes match query (FR-SEARCH-1)', () => {
  it('SEARCH-S2: returns empty items when no notes match query', async () => {
    await seedNote('My Note', 'some content about programming');
    await new Promise((r) => setTimeout(r, 100));

    const result = await searchNotes(ownerId, { q: 'zzznomatch', limit: 20 });

    expect(result.items).toHaveLength(0);
    expect(result.nextCursor).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// SEARCH-HIGHLIGHT-S1: <mark> wraps matched term
// FR-SEARCH-2: headline includes <mark>typescript</mark>
// ---------------------------------------------------------------------------

describe('SEARCH-HIGHLIGHT-S1: headline contains mark tags around matched term (FR-SEARCH-2)', () => {
  it('SEARCH-HIGHLIGHT-S1: headline contains mark tags around matched term', async () => {
    await seedNote('Developer Guide', 'typescript is great for large projects');
    await new Promise((r) => setTimeout(r, 100));

    const result = await searchNotes(ownerId, { q: 'typescript', limit: 20 });

    expect(result.items.length).toBeGreaterThan(0);
    // FR-SEARCH-2: headline must include <mark>typescript</mark>
    expect(result.items[0].headline).toContain('<mark>typescript</mark>');
  });
});

// ---------------------------------------------------------------------------
// SEARCH-PAGE-S1: nextCursor present when more pages exist
// FR-SEARCH-3: limit=3, create 5 matching notes → nextCursor non-null
// ---------------------------------------------------------------------------

describe('SEARCH-PAGE-S1: returns nextCursor when results exceed limit (FR-SEARCH-3)', () => {
  it('SEARCH-PAGE-S1: returns nextCursor when results exceed limit', async () => {
    // Create 5 notes sequentially to guarantee deterministic cuid ordering
    for (let i = 1; i <= 5; i++) {
      await seedNote(`Architecture Note ${i}`, `software architecture patterns note ${i}`);
    }
    await new Promise((r) => setTimeout(r, 100));

    const result = await searchNotes(ownerId, { q: 'architecture', limit: 3 });

    expect(result.items).toHaveLength(3);
    expect(result.nextCursor).not.toBeNull();
    expect(typeof result.nextCursor).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// SEARCH-PAGE-S2: second page using nextCursor returns remaining items
// FR-SEARCH-3: cursor from page 1 → page 2 has remaining items, nextCursor null
// ---------------------------------------------------------------------------

describe('SEARCH-PAGE-S2: second page using nextCursor returns remaining items (FR-SEARCH-3)', () => {
  it('SEARCH-PAGE-S2: second page using nextCursor returns remaining items', async () => {
    // Create 5 notes sequentially to guarantee deterministic cuid ordering
    for (let i = 1; i <= 5; i++) {
      await seedNote(`Algorithm Study ${i}`, `sorting algorithm analysis note ${i}`);
    }
    await new Promise((r) => setTimeout(r, 100));

    // Page 1: fetch 3
    const page1 = await searchNotes(ownerId, { q: 'algorithm', limit: 3 });
    expect(page1.items).toHaveLength(3);
    expect(page1.nextCursor).not.toBeNull();

    // Page 2: use cursor from page 1
    const page2 = await searchNotes(ownerId, {
      q: 'algorithm',
      limit: 3,
      cursor: page1.nextCursor!,
    });

    expect(page2.items.length).toBeGreaterThan(0);
    // Only 2 remaining out of 5, so nextCursor should be null
    expect(page2.nextCursor).toBeNull();

    // Ensure no overlap: page 2 IDs not in page 1
    const page1Ids = new Set(page1.items.map((i) => i.note.id));
    for (const item of page2.items) {
      expect(page1Ids.has(item.note.id)).toBe(false);
    }
  });
});
