---
status: APPROVED
ticket: AB-1009
slug: AB-1009-version-history
---

# AB-1009 — Version History

## Overview

AB-1009 adds read and restore access to the version history that AB-1004 already snapshots on every note save. The NoteVersion model and its snapshot logic (`updateNote` transaction) are in place; this ticket exposes three new authenticated endpoints (list versions, view a single version, restore a version) and a daily cron job that hard-deletes NoteVersion rows older than 90 days. All new code follows the three-layer structure (FR-ARCH-1).

## Goals

- `GET /notes/:id/versions` — list all versions for an owned note, newest first (title only, no body)
- `GET /notes/:id/versions/:versionId` — view a single version in full (title + body)
- `POST /notes/:id/versions/:versionId/restore` — non-destructively restore an old version; creates 2 new NoteVersion records and increments `note.version` by 1
- Daily cron at 03:00 UTC that hard-deletes NoteVersion rows where `savedAt < now − 90 days`; logs purged row count
- Three-layer structure: `routes/versions.ts` → `controllers/versions.controller.ts` → `services/versions.service.ts`

## Non-Goals

- Diffing or comparing versions (future ticket)
- Restoring to a version for a note that has been soft-deleted (404 path already covers this)
- Permanent retention (purge threshold is fixed at 90 days, not user-configurable)
- Physical deletion of Notes (soft-delete rule unchanged)

## FRs Covered

- FR-VER-1 (already implemented in AB-1004; snapshots verified by VER-SAVE-S1..S2)
- FR-VER-2
- FR-VER-3
- FR-VER-4
- FR-VER-5
- FR-ARCH-1 (three-layer convention)

## API Contract

| Method | Path | Auth | Summary |
|--------|------|------|---------|
| GET | /notes/:id/versions | JWT | List versions, newest first |
| GET | /notes/:id/versions/:versionId | JWT | View full version (with body) |
| POST | /notes/:id/versions/:versionId/restore | JWT | Restore note to this version |

**GET /notes/:id/versions success 200:**
```json
[
  { "id": "clxabc", "version": 3, "savedAt": "2026-06-26T12:00:00.000Z", "title": "Meeting notes v3" },
  { "id": "clxdef", "version": 2, "savedAt": "2026-06-26T10:00:00.000Z", "title": "Meeting notes v2" },
  { "id": "clxghi", "version": 1, "savedAt": "2026-06-26T08:00:00.000Z", "title": "Meeting notes" }
]
```

**GET /notes/:id/versions/:versionId success 200:**
```json
{
  "id": "clxabc",
  "version": 3,
  "savedAt": "2026-06-26T12:00:00.000Z",
  "title": "Meeting notes v3",
  "body": { "type": "doc", "content": [] }
}
```

**POST /notes/:id/versions/:versionId/restore success 200:**
```json
{
  "id": "clxnote",
  "title": "Meeting notes",
  "body": { "type": "doc", "content": [] },
  "tagIds": [],
  "createdAt": "2026-06-26T07:00:00.000Z",
  "updatedAt": "2026-06-26T13:00:00.000Z",
  "version": 4
}
```
(Returns the full updated note — same shape as `PATCH /notes/:id` response per FR-NOTE-3.)

**Errors:**

| Status | Code | Trigger |
|--------|------|---------|
| 401 | AUTH_TOKEN_INVALID | missing or invalid access token |
| 404 | NOTE_NOT_FOUND | note doesn't exist or not owned by requester |
| 404 | VERSION_NOT_FOUND | versionId doesn't exist or belongs to a different note |

See `delta-openapi.yaml` for full schema.

## Data Model

No new Prisma model or migration is required. `NoteVersion` already exists from AB-1004:

```prisma
model NoteVersion {
  id      String   @id @default(cuid())
  noteId  String
  version Int
  title   String   @db.VarChar(200)
  body    Json
  savedAt DateTime @default(now())

  note Note @relation(fields: [noteId], references: [id], onDelete: Cascade)
}
```

A migration **may be required** to add an index on `noteId` if one does not already exist (verify during implementation). Without it, listing and restoring versions for notes with large history tables would cause a full-table scan.

```prisma
@@index([noteId])
```

## Ticket-Specific Decisions

### 1. Restore creates 2 NoteVersion records (FR-VER-4 acceptance requirement)

FR-VER-4 acceptance states: "total version count after restore = previous count + 2 (one snapshot of pre-restore state, one for the restored content)."

The restore transaction does three things:

1. **Pre-restore snapshot** — create `NoteVersion { version: note.version, title: note.title, body: note.body }`. Records the state the user is leaving.
2. **Update the note** — apply the selected version's `title` and `body`; increment `note.version` by 1.
3. **Post-restore record** — create `NoteVersion { version: note.version (new), title: selectedVersion.title, body: selectedVersion.body }`. Records the restored state as an explicit history entry, making restore events visible in the version list.

All three steps run in a single Prisma `$transaction`. The selected old version is never modified or deleted.

### 2. Purge cron uses `node-cron`

`node-cron` is the chosen scheduler (`node-cron` package). Schedule string: `'0 3 * * *'` (03:00 UTC daily). The purge runs inside `apps/api/src/lib/purge.ts` and is registered in `apps/api/src/index.ts` at startup. It issues a single `prisma.noteVersion.deleteMany({ where: { savedAt: { lt: cutoff } } })` and logs `[PURGE] Deleted ${count} NoteVersion rows older than 90 days`.

Note: this is a hard delete of `NoteVersion` rows only. The main `Note` table is never hard-deleted (soft-delete only per FR-NOTE-4 and project rules).

### 3. Version ownership verification

Both version endpoints (`GET /notes/:id/versions/:versionId` and the restore endpoint) must verify:
1. The note `:id` exists and is owned by the current user (same `assertNoteOwner` helper from `notes.service.ts`)
2. The `NoteVersion` `:versionId` has `noteId === note.id`

If either check fails, the error surfaced is:
- Note check fails → 404 `NOTE_NOT_FOUND`
- Version check fails → 404 `VERSION_NOT_FOUND`

Cross-user access must never return 403 — always 404 to avoid leaking existence (same convention as FR-NOTE-2).

### 4. List response omits body

`GET /notes/:id/versions` returns `[{ id, version, savedAt, title }]` — no body field. This matches FR-VER-2 exactly and keeps the list payload small for notes with many versions. Body is only returned in the single-version endpoint.

### 5. Ordering

`GET /notes/:id/versions` orders by `version DESC` (FR-VER-2). This is equivalent to `savedAt DESC` in practice but uses `version` as the sort key since it is the canonical monotonic counter for a note's history.

## Scenarios

### VER-SAVE-S1 — Each update increments version count by 1
**Validates: FR-VER-1**
- Given: authenticated user owns note `n1` with `version: 1` and 0 NoteVersion records
- When: `PATCH /notes/n1` is called twice with different titles
- Then: note `version` = 3; `GET /notes/n1/versions` returns exactly 2 records (versions 1 and 2)

### VER-SAVE-S2 — Version count equals update count
**Validates: FR-VER-1**
- Given: note `n1` has been updated N times
- When: `GET /notes/n1/versions`
- Then: array length = N (one snapshot per update)

### VER-LIST-S1 — List returns newest version first
**Validates: FR-VER-2**
- Given: note `n1` has 3 NoteVersion records (versions 1, 2, 3)
- When: `GET /notes/n1/versions`
- Then: 200; array[0].version = 3, array[1].version = 2, array[2].version = 1; no `body` field in any item

### VER-LIST-S2 — List for unowned note returns 404
**Validates: FR-VER-2**
- Given: note `n1` belongs to user B; user A is authenticated
- When: user A calls `GET /notes/n1/versions`
- Then: 404 NOTE_NOT_FOUND

### VER-VIEW-S1 — View version includes body
**Validates: FR-VER-3**
- Given: note `n1` has NoteVersion `v1` with a known title and body
- When: `GET /notes/n1/versions/v1`
- Then: 200 with `{ id, version, savedAt, title, body }`; `body` matches the snapshot taken at that version

### VER-RESTORE-S1 — Restore increments total version count by 2
**Validates: FR-VER-4**
- Given: note `n1` is at `version: 3` with 2 NoteVersion records; user owns `n1`
- When: `POST /notes/n1/versions/<id-of-version-1>/restore`
- Then: 200 with updated note (`version: 4`, title/body from version 1); `GET /notes/n1/versions` returns 4 records (previous 2 + pre-restore snapshot + post-restore record); old version 1 record is unchanged

### VER-RESTORE-S2 — Restore to non-existent version returns 404
**Validates: FR-VER-4**
- Given: authenticated user owns note `n1`
- When: `POST /notes/n1/versions/nonexistent-id/restore`
- Then: 404 VERSION_NOT_FOUND

### VER-PURGE-S1 — Cron deletes versions older than 90 days
**Validates: FR-VER-5**
- Given: NoteVersion rows exist with `savedAt` values at −91 days, −90 days (boundary), and −1 day
- When: purge job runs
- Then: the row at −91 days is deleted; the row at −90 days (exactly on boundary) is NOT deleted; the row at −1 day is NOT deleted; log output contains `[PURGE] Deleted 1 NoteVersion rows older than 90 days`

### VER-PURGE-S2 — Cron is scheduled at 03:00 UTC daily
**Validates: FR-VER-5**
- Given: server starts
- When: cron is registered
- Then: node-cron schedule string is `'0 3 * * *'` (verified in test by inspecting the registered schedule or by calling purge logic directly and confirming log output format)

## Dependencies

- AB-1001 — infra (monorepo, Prisma, Vitest)
- AB-1002 — auth middleware (JWT verification)
- AB-1004 — NoteVersion model, `assertNoteOwner` helper, snapshot logic in `updateNote`, three-layer pattern

All of the above must be merged before AB-1009 can ship.

## Open Questions

None. All behavior is fully specified in FR-VER-1 through FR-VER-5.
