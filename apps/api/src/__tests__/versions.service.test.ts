/**
 * Integration tests for versions.service.ts
 *
 * Coverage:
 *   VER-SAVE-S1   → FR-VER-1: after 2 PATCHes, listVersions returns 2 items
 *   VER-SAVE-S2   → FR-VER-1: version count equals update count (3 updates → 3 snapshots)
 *   VER-LIST-S1   → FR-VER-2: listVersions returns items ordered version DESC; no `body` field
 *   VER-LIST-S2   → FR-VER-2: listVersions for unowned note throws AppError 404 NOTE_NOT_FOUND
 *   VER-VIEW-S1   → FR-VER-3: getVersion returns full version including `body`
 *   VER-RESTORE-S1 → FR-VER-4: restoreVersion → total NoteVersion count = previous count + 2; note.version incremented by 1
 *   VER-RESTORE-S2 → FR-VER-4: restoreVersion with unknown versionId throws AppError 404 VERSION_NOT_FOUND
 *
 * Calls service functions directly against the real DB — no HTTP layer.
 */

import 'dotenv/config';

import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
} from 'vitest';
import bcrypt from 'bcrypt';

import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { updateNote } from '../services/notes.service.js';
import {
  listVersions,
  getVersion,
  restoreVersion,
} from '../services/versions.service.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OWNER_EMAIL = `versions-service-owner-${Date.now()}@example.com`;
const OTHER_EMAIL = `versions-service-other-${Date.now()}@example.com`;
const TEST_PASSWORD = 'Secur3Pass';

const SAMPLE_BODY = { type: 'doc', content: [] };

// ---------------------------------------------------------------------------
// User IDs (populated in beforeAll)
// ---------------------------------------------------------------------------

let ownerId: string;
let otherId: string;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function seedNote(
  userId: string,
  overrides: Partial<{ title: string; body: object }> = {},
) {
  return prisma.note.create({
    data: {
      userId,
      title: overrides.title ?? 'Seed Note',
      body: overrides.body ?? SAMPLE_BODY,
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

  const other = await prisma.user.upsert({
    where: { email: OTHER_EMAIL },
    create: { email: OTHER_EMAIL, passwordHash },
    update: {},
  });
  otherId = other.id;
});

beforeEach(async () => {
  // Clean in FK order: NoteTag + NoteVersion first, then Note
  await prisma.noteTag.deleteMany({ where: { note: { userId: { in: [ownerId, otherId] } } } });
  await prisma.noteVersion.deleteMany({ where: { note: { userId: { in: [ownerId, otherId] } } } });
  await prisma.note.deleteMany({ where: { userId: { in: [ownerId, otherId] } } });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: [OWNER_EMAIL, OTHER_EMAIL] } } });
  await prisma.$disconnect();
});

// ---------------------------------------------------------------------------
// VER-SAVE-S1: after 2 PATCHes, listVersions returns 2 items
// FR-VER-1: version count = update count
// ---------------------------------------------------------------------------

describe('VER-SAVE-S1: after 2 PATCHes, listVersions returns 2 items (FR-VER-1)', () => {
  it('VER-SAVE-S1: listVersions returns exactly 2 NoteVersion rows after 2 updateNote calls', async () => {
    const note = await seedNote(ownerId, { title: 'Version Save Test' });

    // First PATCH
    await updateNote(ownerId, note.id, { title: 'Update One' });
    // Second PATCH
    await updateNote(ownerId, note.id, { title: 'Update Two' });

    const versions = await listVersions(ownerId, note.id);

    expect(versions).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// VER-SAVE-S2: version count equals update count
// FR-VER-1: each update creates exactly one snapshot
// ---------------------------------------------------------------------------

describe('VER-SAVE-S2: version count equals update count after 3 PATCHes (FR-VER-1)', () => {
  it('VER-SAVE-S2: listVersions returns exactly 3 items after 3 updateNote calls', async () => {
    const note = await seedNote(ownerId, { title: 'Triple Update' });

    await updateNote(ownerId, note.id, { title: 'Update One' });
    await updateNote(ownerId, note.id, { title: 'Update Two' });
    await updateNote(ownerId, note.id, { title: 'Update Three' });

    const versions = await listVersions(ownerId, note.id);

    expect(versions).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// VER-LIST-S1: listVersions returns items ordered version DESC; no `body` field
// FR-VER-2: ordered by version DESC; response shape has no body
// ---------------------------------------------------------------------------

describe('VER-LIST-S1: listVersions returns items ordered version DESC with no body field (FR-VER-2)', () => {
  it('VER-LIST-S1: items are sorted version DESC and each item lacks a body property', async () => {
    const note = await seedNote(ownerId, { title: 'Order Test' });

    // Create 3 versions so ordering is meaningful
    await updateNote(ownerId, note.id, { title: 'Update One' });
    await updateNote(ownerId, note.id, { title: 'Update Two' });
    await updateNote(ownerId, note.id, { title: 'Update Three' });

    const versions = await listVersions(ownerId, note.id);

    expect(versions.length).toBeGreaterThanOrEqual(3);

    // Verify version numbers are descending
    for (let i = 0; i < versions.length - 1; i++) {
      expect(versions[i]!.version).toBeGreaterThan(versions[i + 1]!.version);
    }

    // Verify no `body` field on any item
    for (const item of versions) {
      expect(item).not.toHaveProperty('body');
      // Verify required list fields are present
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('version');
      expect(item).toHaveProperty('savedAt');
      expect(item).toHaveProperty('title');
    }
  });
});

// ---------------------------------------------------------------------------
// VER-LIST-S2: listVersions for unowned note throws NOTE_NOT_FOUND
// FR-VER-2: 404 NOTE_NOT_FOUND when note not owned by user
// ---------------------------------------------------------------------------

describe('VER-LIST-S2: listVersions for unowned note throws AppError 404 NOTE_NOT_FOUND (FR-VER-2)', () => {
  it('VER-LIST-S2: throws AppError 404 NOTE_NOT_FOUND when note belongs to another user', async () => {
    const otherNote = await seedNote(otherId, { title: "Other's Note" });

    await expect(
      listVersions(ownerId, otherNote.id),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOTE_NOT_FOUND',
    } satisfies Partial<AppError>);
  });
});

// ---------------------------------------------------------------------------
// VER-VIEW-S1: getVersion returns full version including body
// FR-VER-3: 200 with full version including body
// ---------------------------------------------------------------------------

describe('VER-VIEW-S1: getVersion returns full version detail including body (FR-VER-3)', () => {
  it('VER-VIEW-S1: getVersion returns item with body, id, version, savedAt, title', async () => {
    const originalBody = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'original content' }] }],
    };
    const note = await seedNote(ownerId, { title: 'View Version Note', body: originalBody });

    // Create a version by patching
    await updateNote(ownerId, note.id, { title: 'Patched Title' });

    // Get all versions to find the snapshot ID
    const versions = await listVersions(ownerId, note.id);
    expect(versions).toHaveLength(1);
    const versionId = versions[0]!.id;

    const detail = await getVersion(ownerId, note.id, versionId);

    // Must include body
    expect(detail).toHaveProperty('body');
    expect(detail.body).toBeDefined();

    // Must include all other fields
    expect(detail.id).toBe(versionId);
    expect(detail.version).toBeDefined();
    expect(detail.savedAt).toBeInstanceOf(Date);
    expect(detail.title).toBeDefined();

    // body must match the original note content (snapshot taken before patch)
    expect(detail.body).toMatchObject(originalBody);
    expect(detail.title).toBe('View Version Note');
  });
});

// ---------------------------------------------------------------------------
// VER-RESTORE-S1: restoreVersion → count = previous count + 2; note.version incremented by 1
// FR-VER-4: pre-restore snapshot + post-restore version = +2; note.version += 1
// ---------------------------------------------------------------------------

describe('VER-RESTORE-S1: restoreVersion creates 2 new NoteVersion rows and increments note.version (FR-VER-4)', () => {
  it('VER-RESTORE-S1: after restore, total NoteVersion count = previous count + 2; note.version incremented by 1', async () => {
    const note = await seedNote(ownerId, { title: 'Restore Test' });

    // Apply 2 patches to create 2 version snapshots
    await updateNote(ownerId, note.id, { title: 'Update One' });
    await updateNote(ownerId, note.id, { title: 'Update Two' });

    // Count versions before restore
    const countBefore = await prisma.noteVersion.count({
      where: { noteId: note.id },
    });
    expect(countBefore).toBe(2);

    // Get current note version number before restore
    const noteBefore = await prisma.note.findUnique({ where: { id: note.id } });
    const versionBefore = noteBefore!.version; // should be 3

    // Pick the first version (snapshot of version 1)
    const versions = await listVersions(ownerId, note.id);
    // The oldest version should be at the end (sorted version DESC)
    const targetVersion = versions[versions.length - 1]!;

    // Restore
    const restored = await restoreVersion(ownerId, note.id, targetVersion.id);

    // NoteVersion count must be previous count + 2
    const countAfter = await prisma.noteVersion.count({
      where: { noteId: note.id },
    });
    expect(countAfter).toBe(countBefore + 2);

    // note.version must be exactly versionBefore + 1
    expect(restored.version).toBe(versionBefore + 1);

    // The note's title should match the restored version's title
    expect(restored.title).toBe(targetVersion.title);
  });
});

// ---------------------------------------------------------------------------
// VER-RESTORE-S2: restoreVersion with unknown versionId throws VERSION_NOT_FOUND
// FR-VER-4: 404 VERSION_NOT_FOUND for unknown versionId
// ---------------------------------------------------------------------------

describe('VER-RESTORE-S2: restoreVersion with unknown versionId throws AppError 404 VERSION_NOT_FOUND (FR-VER-4)', () => {
  it('VER-RESTORE-S2: throws AppError 404 VERSION_NOT_FOUND for non-existent versionId', async () => {
    const note = await seedNote(ownerId, { title: 'Restore Not Found Test' });

    const nonExistentVersionId = '00000000-0000-0000-0000-000000000000';

    await expect(
      restoreVersion(ownerId, note.id, nonExistentVersionId),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'VERSION_NOT_FOUND',
    } satisfies Partial<AppError>);
  });
});
