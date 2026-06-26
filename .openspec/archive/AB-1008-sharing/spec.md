---
status: APPROVED
ticket: AB-1008
slug: AB-1008-sharing
---

# AB-1008 — Note Sharing

## Overview

AB-1008 adds public read-only link sharing for notes. Authenticated note owners can generate URL-safe share tokens (with optional expiry), revoke them, and list all shares for a note. A public endpoint (`GET /public/shares/:token`) lets anyone with the link view the note title and body without authentication. View counts are incremented atomically via a single SQL `UPDATE` to prevent races under concurrent load. All authenticated endpoints follow the three-layer structure (FR-ARCH-1).

## Goals

- `POST /notes/:id/shares` — generate 32-char URL-safe token with optional expiry
- `DELETE /notes/:id/shares/:token` — revoke a share (idempotent)
- `GET /notes/:id/shares` — list all shares (active + revoked) for AB-1014 frontend
- `GET /public/shares/:token` — public note view with atomic viewCount increment
- 410 GONE_LINK_INVALID for revoked or expired tokens (cause not distinguished to client)
- Rate limit 60/min per IP+token on the public endpoint
- Three-layer structure: `routes/` → `controllers/shares.controller.ts` → `services/shares.service.ts`

## Non-Goals

- Public frontend page (shareUrl points to API endpoint in v1; a dedicated page is a future ticket)
- Share permissions other than read-only (no edit, no comment)
- Per-share view logs or visitor analytics beyond viewCount
- Unauthenticated share creation or revocation

## FRs Covered

- FR-SHARE-1
- FR-SHARE-2
- FR-SHARE-3
- FR-SHARE-4
- FR-ARCH-1 (three-layer convention)

> **Proposed FRS addition — FR-SHARE-5:** The backend FRS omits an explicit list endpoint, but FR-UI-SHARE-2 (AB-1014) references `GET /notes/:id/shares`. This spec adds the endpoint and proposes it be ratified in FRS.md as FR-SHARE-5 during /implement. See Ticket-Specific Decisions §5.

## API Contract

| Method | Path | Auth | Summary |
|--------|------|------|---------|
| POST | /notes/:id/shares | JWT | Generate share link |
| GET | /notes/:id/shares | JWT | List all shares for note |
| DELETE | /notes/:id/shares/:token | JWT | Revoke a share link |
| GET | /public/shares/:token | None | View shared note (public) |

**POST /notes/:id/shares request body** (all fields optional):
```json
{ "expiresAt": "2026-12-31T23:59:59.000Z" }
```

**POST /notes/:id/shares success 201:**
```json
{
  "token": "abc123...32chars",
  "shareUrl": "http://localhost:3000/public/shares/abc123...32chars",
  "expiresAt": "2026-12-31T23:59:59.000Z",
  "viewCount": 0
}
```

**GET /notes/:id/shares success 200:**
```json
[
  {
    "id": "clxabc",
    "token": "abc123...32chars",
    "shareUrl": "http://localhost:3000/public/shares/abc123...32chars",
    "expiresAt": null,
    "revokedAt": null,
    "viewCount": 42,
    "createdAt": "2026-06-26T10:00:00.000Z"
  }
]
```

**GET /public/shares/:token success 200:**
```json
{
  "title": "Meeting Notes",
  "body": { "type": "doc", "content": [] },
  "viewCount": 1,
  "sharedAt": "2026-06-26T10:00:00.000Z"
}
```

**Errors:**

| Status | Code | Trigger |
|--------|------|---------|
| 400 | VALIDATION_FAILED | `expiresAt` is in the past |
| 401 | AUTH_TOKEN_INVALID | missing or invalid access token |
| 404 | NOTE_NOT_FOUND | note doesn't exist or is not owned by requester |
| 404 | SHARE_NOT_FOUND | token doesn't exist or belongs to another user's note |
| 410 | GONE_LINK_INVALID | token is revoked or expired |
| 429 | RATE_LIMITED | 60/min per IP+token on public endpoint |

See `delta-openapi.yaml` for full schema.

## Data Model

**New `NoteShare` model:**

```prisma
model NoteShare {
  id        String    @id @default(cuid())
  noteId    String
  token     String    @unique @db.VarChar(32)
  expiresAt DateTime?
  revokedAt DateTime?
  viewCount Int       @default(0)
  createdAt DateTime  @default(now())

  note Note @relation(fields: [noteId], references: [id], onDelete: Cascade)

  @@index([noteId])
  @@index([token])
}
```

**Amend `Note` model** — add relation field only:

```prisma
model Note {
  // … existing fields unchanged …
  shares NoteShare[]
}
```

One new Prisma migration. No existing model columns change.

## Ticket-Specific Decisions

### 1. Token generation
`crypto.randomBytes(24).toString('base64url')` produces exactly 32 URL-safe chars (base64url without padding; 24 bytes × 4/3 = 32 chars since 24 % 3 == 0). Node.js built-in `crypto` module — no external dependency.

### 2. `shareUrl` construction
`${process.env.SHARE_BASE_URL}/public/shares/${token}`. `SHARE_BASE_URL` added to `.env.example` (example: `http://localhost:3000`). In v1, this is the API server's base URL since there is no dedicated frontend share page. A future ticket may redirect through a frontend route instead; the env var allows this without code changes.

### 3. `sharedAt` field
`NoteShare.createdAt` is returned as `sharedAt` in the public response. No additional DB column is needed.

### 4. Atomic viewCount increment
`prisma.noteShare.update({ data: { viewCount: { increment: 1 } } })` generates `UPDATE "NoteShare" SET "viewCount" = "viewCount" + 1 WHERE token = $1`. Single SQL statement; no read-then-write race. This satisfies FR-SHARE-3's atomicity requirement without raw SQL.

### 5. GET /notes/:id/shares (proposed FR-SHARE-5)
The backend FRS (FR-SHARE-1 through FR-SHARE-4) omits an explicit list endpoint, but FR-UI-SHARE-2 (AB-1014) references `GET /notes/:id/shares`. Adding this endpoint in AB-1008 so the frontend ticket has a ready dependency. Returns **all** shares (active and revoked), ordered `createdAt DESC`, so the frontend can render revoked links with a distinct style (FR-UI-SHARE-4). Proposed FRS entry to ratify during /implement:

> **FR-SHARE-5 [AB-1008]:** GET /notes/:id/shares — auth required; must own note; returns all shares ordered `createdAt DESC`. Success 200 `[{ id, token, shareUrl, expiresAt, revokedAt, viewCount, createdAt }]`. Errors: 401 AUTH_TOKEN_INVALID, 404 NOTE_NOT_FOUND.

### 6. Rate limit keying for public endpoint
FR-SHARE-3 specifies "60/min per IP per token". Using a custom `keyGenerator` in `rateLimiters.ts`: `(req) => req.ip + ':' + req.params.token`. This prevents a single IP from exhausting its limit against one popular share while still allowing access to other shares. A new `publicShareLimiter` is added and applied only to the `/public/shares/:token` route.

### 7. Route file structure
Two new route files to respect the different path prefixes and auth requirements:
- `apps/api/src/routes/shares.ts` — mounts at `/notes/:noteId/shares` (authenticated; uses `authMiddleware`)
- `apps/api/src/routes/public.ts` — mounts at `/public` (unauthenticated; extensible for future public endpoints)

Both route files wire to `controllers/shares.controller.ts`, which calls `services/shares.service.ts`.

### 8. Expired vs. revoked — identical 410 response
FR-SHARE-4 mandates that expired and revoked links return identical `410 GONE_LINK_INVALID`. The service checks both `revokedAt IS NOT NULL` and `expiresAt < now()` before incrementing `viewCount`, and throws the same `AppError` regardless of which condition triggered. The client cannot distinguish the cause.

## Scenarios

### SHARE-CREATE-S1 — Create share without expiry
**Validates: FR-SHARE-1**
- Given: authenticated user owns note `n1`
- When: `POST /notes/n1/shares` with body `{}`
- Then: 201 with `{ token, shareUrl, expiresAt: null, viewCount: 0 }`; `token` is exactly 32 chars and URL-safe (`[A-Za-z0-9\-_]`); `shareUrl` contains the token

### SHARE-CREATE-S2 — Create share with future expiry
**Validates: FR-SHARE-1**
- Given: authenticated user owns note `n1`
- When: `POST /notes/n1/shares` with `{ expiresAt: "<tomorrow ISO 8601>" }`
- Then: 201; response `expiresAt` matches submitted value

### SHARE-CREATE-S3 — Past expiresAt rejected
**Validates: FR-SHARE-1**
- Given: authenticated user owns note `n1`
- When: `POST /notes/n1/shares` with `{ expiresAt: "<yesterday ISO 8601>" }`
- Then: 400 VALIDATION_FAILED

### SHARE-REVOKE-S1 — Revoke active share
**Validates: FR-SHARE-2**
- Given: authenticated user owns note `n1` with active share token `t1` (`revokedAt: null`)
- When: `DELETE /notes/n1/shares/t1`
- Then: 204; subsequent `GET /public/shares/t1` returns 410 GONE_LINK_INVALID

### SHARE-REVOKE-S2 — Revoke already-revoked is idempotent
**Validates: FR-SHARE-2**
- Given: share `t1` already has `revokedAt` set
- When: `DELETE /notes/n1/shares/t1`
- Then: 204 (no error)

### SHARE-VIEW-S1 — Valid share returns note content and increments viewCount
**Validates: FR-SHARE-3**
- Given: active share token `t1` with `viewCount: 0`, no expiry, not revoked
- When: `GET /public/shares/t1`
- Then: 200 with `{ title, body, viewCount: 1, sharedAt }`; title and body match the note's current values

### SHARE-VIEW-S2 — Expired share returns 410
**Validates: FR-SHARE-3, FR-SHARE-4**
- Given: share token `t1` with `expiresAt` 1 hour in the past
- When: `GET /public/shares/t1`
- Then: 410 GONE_LINK_INVALID

### SHARE-VIEW-S3 — Revoked share returns 410
**Validates: FR-SHARE-3, FR-SHARE-4**
- Given: share token `t1` with `revokedAt` set
- When: `GET /public/shares/t1`
- Then: 410 GONE_LINK_INVALID; response body shape identical to SHARE-VIEW-S2

### SHARE-VIEW-S4 — Concurrent viewCount increments are atomic
**Validates: FR-SHARE-3**
- Given: active share token `t1` with `viewCount: 0`
- When: 10 concurrent `GET /public/shares/t1` requests
- Then: `viewCount` in DB = 10 (no increments lost); verified via `prisma.noteShare.findUnique` after all requests settle

### SHARE-LIST-S1 — List all shares for owned note includes active and revoked
**Validates: FR-SHARE-5 (proposed)**
- Given: authenticated user owns note `n1` with 2 shares: 1 active (`revokedAt: null`) and 1 revoked
- When: `GET /notes/n1/shares`
- Then: 200 with array of length 2; revoked item has `revokedAt` set; items ordered `createdAt DESC`

### SHARE-LIST-S2 — List shares for unowned note returns 404
**Validates: FR-SHARE-5 (proposed)**
- Given: note `n1` belongs to user B; user A is authenticated
- When: user A calls `GET /notes/n1/shares`
- Then: 404 NOTE_NOT_FOUND

## Dependencies

- AB-1001 — infra (monorepo, Prisma, Vitest)
- AB-1002 — auth middleware (JWT verification)
- AB-1004 — Note model, NOTE_NOT_FOUND error convention, three-layer pattern

All of the above must be merged before AB-1008 can ship.

## Open Questions

None. FR-SHARE-5 (list endpoint) is proposed in §Ticket-Specific Decisions §5 and will be ratified by updating FRS.md during /implement with user approval.
