---
status: APPROVED
ticket: AB-1008
slug: AB-1008-sharing
---

# AB-1008 — Tasks: Note Sharing

## Checklist

- [x] **Task 1 — Prisma schema + migration** `[10 min]`
  - Add `NoteShare` model to `schema.prisma`
  - Add `shares NoteShare[]` relation to `Note` model
  - Run `pnpm --filter api prisma migrate dev --name add_note_share`
  - Files: `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/<ts>_add_note_share/`
  - Scenarios: (foundational — all share scenarios depend on this)

- [x] **Task 2 — Shared schema: `createShareSchema`** `[10 min]` `[PARALLEL with Task 3, Task 4]`
  - Add `createShareSchema` (optional `expiresAt: ISO datetime, must be future`) + `CreateShareInput` type
  - Rebuild shared package: `pnpm --filter shared build`
  - Files: `packages/shared/src/index.ts`
  - Scenarios: SHARE-CREATE-S1, SHARE-CREATE-S2, SHARE-CREATE-S3

- [x] **Task 3 — Error handler: add new codes** `[5 min]` `[PARALLEL with Task 2, Task 4]`
  - Add `SHARE_NOT_FOUND: 'Share not found'` and `GONE_LINK_INVALID: 'Gone'` to `CODE_TITLES`
  - Files: `apps/api/src/middleware/errorHandler.ts`
  - Scenarios: SHARE-REVOKE-S1, SHARE-VIEW-S2, SHARE-VIEW-S3

- [x] **Task 4 — Rate limiter: `createPublicShareLimiter`** `[5 min]` `[PARALLEL with Task 2, Task 3]`
  - Add `createPublicShareLimiter` — 60/min, custom keyGenerator: `req.ip + ':' + req.params.token`
  - Files: `apps/api/src/middleware/rateLimiters.ts`
  - Scenarios: (rate limit path; not exercised by functional tests but wired in Task 7)

- [x] **Task 5 — Service: `shares.service.ts`** `[20 min]`
  - Depends on: Task 1 (Prisma model), Task 3 (AppError codes)
  - Implement: `createShare`, `revokeShare`, `listShares`, `viewPublicShare`
  - Token: `randomBytes(24).toString('base64url')` (32 chars)
  - `viewCount` increment via `{ increment: 1 }` (atomic single UPDATE)
  - `assertNoteOwner` helper (same pattern as notes.service.ts)
  - Files: `apps/api/src/services/shares.service.ts`
  - Scenarios: SHARE-CREATE-S1..S3, SHARE-REVOKE-S1..S2, SHARE-VIEW-S1..S4, SHARE-LIST-S1..S2

- [x] **Task 6 — Controller: `shares.controller.ts`** `[10 min]`
  - Depends on: Task 2 (schema), Task 5 (service)
  - Implement: `createShareController`, `revokeShareController`, `listSharesController`, `viewPublicShareController`
  - No `@prisma/client` imports — Zod validate → call service → `res.json()`
  - Files: `apps/api/src/controllers/shares.controller.ts`
  - Scenarios: all (controller is the HTTP boundary)

- [x] **Task 7 — Routes: `shares.ts` + `public.ts`** `[10 min]`
  - Depends on: Task 4 (rate limiter), Task 6 (controller)
  - `routes/shares.ts`: POST/GET `/:noteId/shares`, DELETE `/:noteId/shares/:token` — all behind `requireAuth`
  - `routes/public.ts`: GET `/shares/:token` — behind `publicShareLimiter`, no auth
  - Files: `apps/api/src/routes/shares.ts`, `apps/api/src/routes/public.ts`
  - Scenarios: all

- [x] **Task 8 — App wiring + `.env.example`** `[5 min]`
  - Depends on: Task 7 (routers)
  - Mount `sharesRouter` at `/notes` and `publicRouter` at `/public` in `index.ts`
  - Add `SHARE_BASE_URL=http://localhost:3000` to `.env.example`
  - Files: `apps/api/src/index.ts`, `.env.example`
  - Scenarios: all (endpoints become reachable)

- [x] **Task 9 — FRS.md: add FR-SHARE-5** `[5 min]` `[PARALLEL — any time after Task 1]`
  - Add FR-SHARE-5 under "Backend — Sharing (AB-1008)" section in FRS.md
  - Files: `docs/FRS.md`
  - Scenarios: SHARE-LIST-S1, SHARE-LIST-S2

- [x] **Task 10 — Integration tests: `shares.test.ts`** `[25 min]`
  - Depends on: Task 8 (full stack wired)
  - One test per scenario, named exactly as scenario IDs
  - Spin up minimal Express app (pattern from `search.test.ts`)
  - Cover all 11 scenarios: SHARE-CREATE-S1..S3, SHARE-REVOKE-S1..S2, SHARE-VIEW-S1..S4, SHARE-LIST-S1..S2
  - SHARE-VIEW-S4: 10 concurrent requests via `Promise.all`, assert `viewCount === 10` from DB
  - Files: `apps/api/src/__tests__/shares.test.ts`
  - Scenarios: SHARE-CREATE-S1..S3, SHARE-REVOKE-S1..S2, SHARE-VIEW-S1..S4, SHARE-LIST-S1..S2
