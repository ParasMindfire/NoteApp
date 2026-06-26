---
status: APPROVED
ticket: AB-1008
slug: AB-1008-sharing
---

# AB-1008 — Implementation Plan: Note Sharing

## Prerequisites

All dependencies already merged:
- AB-1001 — monorepo, Prisma, Vitest
- AB-1002 — auth middleware (`requireAuth`, `AppError`, JWT)
- AB-1004 — `Note` model, `NOTE_NOT_FOUND` convention, three-layer pattern

No new npm packages required — token generation uses Node.js built-in `crypto`.

---

## Files to Create

| File | Purpose |
|------|---------|
| `apps/api/src/services/shares.service.ts` | All DB access + business logic |
| `apps/api/src/controllers/shares.controller.ts` | Zod validate → call service → respond |
| `apps/api/src/routes/shares.ts` | Authenticated routes under `/notes/:noteId/shares` |
| `apps/api/src/routes/public.ts` | Unauthenticated routes under `/public` |
| `apps/api/src/__tests__/shares.test.ts` | Integration tests (all 11 scenarios) |
| *(Prisma auto-generates)* `apps/api/prisma/migrations/<ts>_add_note_share/migration.sql` | |

---

## Files to Modify

| File | Change |
|------|--------|
| `apps/api/prisma/schema.prisma` | Add `NoteShare` model; add `shares NoteShare[]` to `Note` |
| `packages/shared/src/index.ts` | Add `createShareSchema` + `CreateShareInput` |
| `apps/api/src/middleware/errorHandler.ts` | Add `SHARE_NOT_FOUND`, `GONE_LINK_INVALID` to `CODE_TITLES` |
| `apps/api/src/middleware/rateLimiters.ts` | Add `createPublicShareLimiter` (60/min, per IP+token key) |
| `apps/api/src/index.ts` | Mount `sharesRouter` at `/notes` and `publicRouter` at `/public` |
| `.env.example` | Add `SHARE_BASE_URL=http://localhost:3000` |
| `docs/FRS.md` | Add FR-SHARE-5 (list endpoint) under Backend — Sharing section |

---

## Prisma Schema Changes

### New model — `NoteShare`

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

### Amendment to `Note` model — relation field only

```prisma
model Note {
  // … existing columns unchanged …
  shares NoteShare[]
}
```

Run: `pnpm --filter api prisma migrate dev --name add_note_share`

---

## New Shared Schemas (`packages/shared/src/index.ts`)

```typescript
export const createShareSchema = z.object({
  expiresAt: z
    .string()
    .datetime({ message: 'expiresAt must be a valid ISO 8601 datetime' })
    .refine((v) => new Date(v) > new Date(), {
      message: 'expiresAt must be a future datetime',
    })
    .optional(),
});

export type CreateShareInput = z.infer<typeof createShareSchema>;
```

---

## Implementation Order

Execute tasks in this sequence (each unblocked by the previous):

1. **Prisma schema + migration** — foundation for everything
2. **Shared schema** — `createShareSchema`; rebuild `packages/shared`
3. **Error handler** — add `SHARE_NOT_FOUND`, `GONE_LINK_INVALID` codes
4. **Rate limiter** — add `createPublicShareLimiter`
5. **Service** — `shares.service.ts` (core business logic)
6. **Controller** — `shares.controller.ts` (thin validation layer)
7. **Routes** — `shares.ts` + `public.ts`
8. **App wiring** — mount both routers in `index.ts`
9. **`.env.example`** — add `SHARE_BASE_URL`
10. **FRS.md** — add FR-SHARE-5
11. **Tests** — `shares.test.ts` (all 11 scenarios)

---

## Service Design (`shares.service.ts`)

```typescript
// All functions exported — no Express types

createShare(userId, noteId, input: CreateShareInput): Promise<ShareResponse>
  // 1. assertNoteOwner(userId, noteId) → 404 if not found
  // 2. token = randomBytes(24).toString('base64url')
  // 3. shareUrl = `${process.env.SHARE_BASE_URL}/public/shares/${token}`
  // 4. prisma.noteShare.create(...)
  // 5. return { token, shareUrl, expiresAt, viewCount: 0 }

revokeShare(userId, noteId, token): Promise<void>
  // 1. assertNoteOwner(userId, noteId) → 404 if not found
  // 2. find NoteShare where { noteId, token }; if not found → 404 SHARE_NOT_FOUND
  // 3. if revokedAt already set → return (idempotent)
  // 4. prisma.noteShare.update({ data: { revokedAt: new Date() } })

listShares(userId, noteId): Promise<ShareListItem[]>
  // 1. assertNoteOwner(userId, noteId) → 404 if not found
  // 2. prisma.noteShare.findMany({ where: { noteId }, orderBy: { createdAt: 'desc' } })
  // 3. map each to ShareListItem (add shareUrl)

viewPublicShare(token): Promise<PublicShareResponse>
  // 1. prisma.noteShare.findUnique({ where: { token }, include: { note: ... } })
  // 2. if not found → 410 GONE_LINK_INVALID
  // 3. if revokedAt || (expiresAt && expiresAt < now) → 410 GONE_LINK_INVALID
  // 4. prisma.noteShare.update({ data: { viewCount: { increment: 1 } } })
  //    (single SQL UPDATE — atomic, no race)
  // 5. return { title, body, viewCount: updated.viewCount, sharedAt: share.createdAt }
```

`assertNoteOwner` is the same pattern as in `notes.service.ts` — looks up by `{ id: noteId, userId, deletedAt: null }`.

---

## Controller Design (`shares.controller.ts`)

```typescript
createShareController(req, res)   → parse body with createShareSchema → createShare → 201
revokeShareController(req, res)   → revokeShare(userId, noteId, token) → 204
listSharesController(req, res)    → listShares(userId, noteId) → 200
viewPublicShareController(req, res) → viewPublicShare(token) → 200
```

All controllers are `async` functions; routes wrap them in `.catch(next)`.

---

## Route Design

### `routes/shares.ts` — mounted at `/notes` in `index.ts`

```
router.use('/:noteId/shares', requireAuth)
POST   /:noteId/shares        → createShareController
GET    /:noteId/shares        → listSharesController
DELETE /:noteId/shares/:token → revokeShareController
```

### `routes/public.ts` — mounted at `/public` in `index.ts`

```
GET /shares/:token → publicShareLimiter → viewPublicShareController
```

---

## Risk Areas

| Risk | Mitigation |
|------|-----------|
| Prisma `increment` not atomic | Test SHARE-VIEW-S4 sends 10 concurrent requests and asserts `viewCount === 10`; if Prisma generates read-then-write instead of a single UPDATE, this will fail |
| `req.ip` undefined in test env | Supertest sets a loopback IP; `keyGenerator` falls back to `'unknown'` if `req.ip` is falsy — acceptable for test env, does not break rate limit functionality |
| `SHARE_BASE_URL` absent in tests | Set `process.env.SHARE_BASE_URL = 'http://localhost:3000'` at top of test file before any imports that would read it; or rely on `dotenv/config` loading `.env` which should define it |
| Revoke idempotency vs. 404 | Logic: find share by `{ noteId, token }` (not just by token). Missing entirely → 404. Found but revoked → 204. Found and active → revoke + 204. No ambiguity. |
| `expiresAt` timezone handling | Zod `.datetime()` requires full ISO 8601 with timezone offset. Service compares `new Date(expiresAt) < new Date()` at view time — both in UTC internally. |

---

## Test Strategy

**File:** `apps/api/src/__tests__/shares.test.ts`

| Scenario | What is tested |
|----------|---------------|
| SHARE-CREATE-S1 | POST no expiry → 201; token exactly 32 chars; URL-safe pattern; shareUrl contains token |
| SHARE-CREATE-S2 | POST future expiresAt → 201; expiresAt in response matches input |
| SHARE-CREATE-S3 | POST past expiresAt → 400 VALIDATION_FAILED |
| SHARE-REVOKE-S1 | DELETE active token → 204; subsequent GET /public returns 410 |
| SHARE-REVOKE-S2 | DELETE already-revoked token → 204 (idempotent) |
| SHARE-VIEW-S1 | GET /public active token → 200; title + body match note; viewCount = 1 |
| SHARE-VIEW-S2 | GET /public expired token → 410 GONE_LINK_INVALID |
| SHARE-VIEW-S3 | GET /public revoked token → 410; same response shape as S2 |
| SHARE-VIEW-S4 | 10 concurrent GETs → viewCount = 10 in DB (atomicity verified) |
| SHARE-LIST-S1 | GET /:noteId/shares → 2 items (active + revoked); ordering; revokedAt set on revoked |
| SHARE-LIST-S2 | GET cross-user → 404 NOTE_NOT_FOUND |

Pattern follows `search.test.ts`: minimal Express app, real DB, `beforeAll` registers + logs in, `afterAll` deletes user.

---

## Definition of Done

- [ ] `pnpm --filter api prisma migrate dev` completes with no errors
- [ ] `pnpm build` — 0 errors, 0 warnings
- [ ] `pnpm lint --max-warnings 0`
- [ ] `pnpm test --run` — all 11 scenario tests pass; coverage ≥ 80% on new files
- [ ] Reviewer agent finds no cross-layer violations (no Prisma in controller, no Express in service)
- [ ] FR-SHARE-5 added to `docs/FRS.md`
