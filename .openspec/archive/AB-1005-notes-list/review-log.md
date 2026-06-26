# Review Log — AB-1005 Notes List, Sort, and Tag Filter

<!-- Reviewer appends findings here after each task, with timestamp and task ID. -->

## 2026-06-26T00:00:00Z -- Task 3 Review

### FR-ARCH-1 / Layer Constraint

[OK] FR-ARCH-1 sub-bullet "services/: Business logic + all DB access via Prisma. No Express types (Request/Response)" -- The service file imports only `Prisma` from `@prisma/client`, `prisma` from `../lib/prisma.js`, `AppError` from `../middleware/errorHandler.js`, and shared types. No `Request`, `Response`, or `NextFunction` from express appear anywhere in the file.

### FR-NOTE-5 — Cursor

[OK] FR-NOTE-5 "invalid cursor" → 400 -- `decodeCursor` wraps all parsing in try/catch and throws `new AppError(400, 'VALIDATION_FAILED', 'Invalid pagination cursor')` on any malformed input (bad base64url, non-object JSON, missing lastId/lastValue fields).

[OK] FR-NOTE-5 "Cursor is opaque base64 of { lastId, lastValue }" — base64url encoding -- `encodeCursor` calls `Buffer.from(...).toString('base64url')` (RFC 4648 §5, no +/=/), satisfying spec.md decision 2.

[OK] FR-NOTE-5 cursor encodes both `lastId` and `lastValue` (ISO timestamp) -- `encodeCursor(lastId, lastValue: Date)` serialises `{ lastId, lastValue: lastValue.toISOString() }`. The `Cursor` interface declares `lastValue: string // ISO 8601 UTC timestamp of the sort field`.

### FR-NOTE-5 — nextCursor null logic

[OK] FR-NOTE-5 "nextCursor null when no more results" -- Lines 278-284: `nextCursor` is initialised to `null`; it is only set when `rows.length === limit + 1` (i.e., there is a next page). When `rows.length < limit + 1`, `nextCursor` remains `null`.

[OK] FR-NOTE-5 nextCursor encoded from last page item when `rows.length === limit + 1` -- When the condition is true, `rows.pop()` removes the sentinel row, then `encodeCursor(last.id, last[sortField])` is called on the final item of the trimmed result set.

### FR-NOTE-5 — Soft-delete filter

[OK] FR-NOTE-5 "returns own non-deleted notes" — `deletedAt: null` always in where -- Line 250: `deletedAt: null` is unconditionally present in the `where` clause regardless of cursor, sort, or tag filters.

### FR-NOTE-6 — Sort

[OK] FR-NOTE-6 "orderBy uses the sort field + `{ id: 'asc' }` tiebreaker" -- Lines 256-259: both the `createdAt` and `updatedAt` branches produce `[{ <field>: sortDir }, { id: 'asc' }]`, satisfying spec.md decision 3 (tiebreaker by `id ASC`).

[OK] FR-NOTE-6 all four sort combinations handled -- `sortField` ∈ `{'createdAt','updatedAt'}` × `sortDir` ∈ `{'asc','desc'}` are all accepted. The two field branches each pass `sortDir` directly, covering all four combinations.

### FR-NOTE-6 — Keyset predicate correctness

[OK] FR-NOTE-6 desc predicate uses `lt` -- For `sortDir === 'desc'`, the OR array is `[{ <field>: { lt: lastDate } }, { <field>: lastDate, id: { gt: lastId } }]`, correctly excluding rows whose sort value is greater than or equal to the cursor's last value (except the tiebreaker branch).

[OK] FR-NOTE-6 asc predicate uses `gt` -- For `sortDir === 'asc'`, the OR array is `[{ <field>: { gt: lastDate } }, { <field>: lastDate, id: { gt: lastId } }]`.

[OK] FR-NOTE-6 tiebreaker branch uses equality on sort field + `id: { gt: lastId }` -- Both asc and desc cases include `{ <field>: lastDate, id: { gt: lastId } }` as the second OR element.

### FR-NOTE-7 — Tag filter AND semantics

[WARN] FR-NOTE-7 AND semantics implementation drifts from spec.md decision 4 -- spec.md decision 4 states "Implemented via Prisma `every` filter on the `tags` relation." The code instead uses `tags: { some: { tagId } }` per tagId, collected into an `AND` array (lines 244-245). Both approaches produce correct AND semantics for this data model (each `some` is an independent EXISTS per tagId), and the FRS text only requires "AND, not OR" without prescribing the Prisma keyword. The drift is from the spec.md implementation note, not the FRS behavioural requirement. Functionally equivalent but reviewers should confirm the `some`-in-AND pattern is intentional.

### FR-NOTE-7 — Ownership validation

[OK] FR-NOTE-7 "validates they belong to current user" — `prisma.tag.findMany` with `userId` + `deletedAt: null` called before main query -- Lines 215-222: `prisma.tag.findMany({ where: { id: { in: tagIds }, userId, deletedAt: null }, select: { id: true } })` is called when `tagIds.length > 0`, before `prisma.note.findMany`. If the count does not match, the service throws immediately.

### FR-NOTE-7 — 422 error code

[OK] FR-NOTE-7 "422 INVALID_TAG — any tagId not owned by user" -- Line 221: `throw new AppError(422, 'INVALID_TAG', 'One or more tag IDs do not belong to the current user')`. Status is 422, code is `INVALID_TAG`, matching both FRS and delta-openapi.yaml `InvalidTag` response.

---

## 2026-06-26T00:01:00Z -- Task 4 Review

### FR-ARCH-1 — Controller layer: no @prisma/client import, no Prisma calls

[OK] FR-ARCH-1 sub-bullet "Controller file calls prisma.* directly or imports @prisma/client" — `notes.controller.ts` imports only from `express`, `@noteapp/shared`, `../middleware/errorHandler.js`, and `../services/notes.service.js`. No `@prisma/client` import and no `prisma.*` call exist anywhere in the file. All DB access is fully delegated to `listNotes` in the service.

[OK] FR-ARCH-1 sub-bullet "Controller only calls service function, validates input, and sends response" — `listNotesController` (lines 49-71) does exactly: validate via `listNotesQuerySchema.safeParse`, parse sort/tagIds, call `listNotes(userId, {...})`, call `res.status(200).json(paginated)`. No business logic beyond parsing query string fields.

[OK] FR-ARCH-1 sub-bullet "Route file contains any logic beyond router registration and .catch(next) wiring" — `routes/notes.ts` contains only `Router()` construction, `router.use(requireAuth)`, and five arrow-function route registrations each of the form `(req, res, next) => controller(req, res).catch(next)`. No Prisma, no business logic.

### FR-NOTE-5 — Query validation

[OK] FR-NOTE-5 sub-bullet "Validation: safeParse called, failure → 400 VALIDATION_FAILED" — controller line 52: `const result = listNotesQuerySchema.safeParse(req.query)`. On failure, lines 53-56 throw `new AppError(400, 'VALIDATION_FAILED', detail)`.

[OK] FR-NOTE-5 sub-bullet "limit max 50, default 20" — `listNotesQuerySchema` in `packages/shared/src/index.ts` lines 53-59: `z.coerce.number().int().min(1, ...).max(50, ...).default(20)`. A `limit` of 51 fails `.max(50)` and triggers 400 VALIDATION_FAILED. A `limit` of 0 or negative fails `.min(1)` equally (satisfying spec.md decision 6). Default 20 applied when absent.

[OK] FR-NOTE-5 sub-bullet "schema imported from @noteapp/shared, not re-defined in controller" — controller line 2: `import { ..., listNotesQuerySchema } from '@noteapp/shared'`. No local redefinition of `listNotesQuerySchema` exists anywhere in `notes.controller.ts`.

[OK] FR-NOTE-5 sub-bullet "Success response: 200 with { items: Note[], nextCursor: string | null }" — controller line 70: `res.status(200).json(paginated)` where `paginated` is the `PaginatedNotes` return type of `listNotes` (`{ items: NoteResponse[], nextCursor: string | null }`), satisfying the FRS "200 with `{ items: Note[], nextCursor: string | null }`" shape.

[OK] FR-NOTE-5 sub-bullet "401 AUTH_TOKEN_INVALID" — auth is enforced by `requireAuth` middleware applied at router level via `router.use(requireAuth)` in `routes/notes.ts` line 13; the middleware runs before `listNotesController` on every request to this router.

### FR-NOTE-6 — Sort parsing

[OK] FR-NOTE-6 sub-bullet "sort.split(':') correctly destructures into [sortField, sortDir]; both passed to listNotes" — controller line 60: `const [sortField, sortDir] = sort.split(':') as ['createdAt' | 'updatedAt', 'asc' | 'desc']`. Both are passed at line 69: `listNotes(userId, { cursor, limit, sortField, sortDir, tagIds })`.

[OK] FR-NOTE-6 sub-bullet "400 VALIDATION_FAILED — invalid sort field or direction" — `listNotesQuerySchema` enforces `sort` via regex `/^(createdAt|updatedAt):(asc|desc)$/` (shared/src/index.ts lines 62-65) with `.default('createdAt:desc')`. Any non-conforming sort value fails `safeParse` and the controller throws 400 VALIDATION_FAILED before `split` is reached. An absent `sort` defaults to `'createdAt:desc'`.

### FR-NOTE-7 — tagIds parsing

[OK] FR-NOTE-7 sub-bullet "rawTagIds split by comma, trimmed, empty strings filtered; result passed as tagIds: string[] to service" — controller lines 62-67: `rawTagIds ? rawTagIds.split(',').map((t) => t.trim()).filter(Boolean) : []`. The result is passed as `tagIds` to `listNotes` at line 69.

[OK] FR-NOTE-7 sub-bullet "empty ?tagIds= treated as no filter" — `?tagIds=` produces `rawTagIds = ""`. The truthy check `rawTagIds ?` evaluates to falsy for an empty string, so `tagIds` becomes `[]`. The service then skips the ownership check and tag filter entirely (lines 215-222 of notes.service.ts: `if (tagIds.length > 0)`). Spec.md decision 4 satisfied.

[OK] FR-NOTE-7 sub-bullet "400 VALIDATION_FAILED — malformed tagIds" — `tagIds` is typed as `z.string().optional()` in the schema; any non-string value fails Zod coercion, returning 400. Comma-format parsing happens after validation passes.

### SDS — Route conventions

[OK] SDS "Plural names: /notes" — `app.use('/notes', notesRouter)` in `apps/api/src/index.ts` line 18 mounts the router at the plural path `/notes`.

[OK] SDS "All responses JSON" — controller line 70: `res.status(200).json(paginated)` uses Express `.json()` which sets `Content-Type: application/json` automatically.

[OK] SDS "Auth header: Authorization: Bearer <jwt>" — `requireAuth` middleware is applied via `router.use(requireAuth)` at line 13 of `routes/notes.ts`, covering the entire router including the `GET /` list route. Auth is not applied per-handler.

### Route ordering

[OK] "GET / registered before GET /:id" — `routes/notes.ts` lines 19-25: `router.get('/', ...)` is registered at line 19, `router.get('/:id', ...)` at line 23. `GET /` is registered first.

### Coverage gaps (FR-NOTE-5, FR-NOTE-6, FR-NOTE-7 integration scenarios)

[COVERAGE] FR-NOTE-5 has no integration test for scenario NOTE-LIST-S1 (first page, default limit, 20 items, nextCursor non-null) — `notes.test.ts` covers NOTE-CREATE through NOTE-DELETE (S1-S2) but contains zero tests for `GET /notes`. The `notes.controller.test.ts` also does not import or test `listNotesController` (coverage comment lists CTRL-NOTE-C1/C2/G1/U1/U2/D1 only; `listNotesController` is absent from both the mock setup and the test cases).

[COVERAGE] FR-NOTE-5 has no integration test for scenario NOTE-LIST-S2 (second page via cursor, nextCursor null at end).

[COVERAGE] FR-NOTE-5 has no integration test for scenario NOTE-LIST-S3 (limit > 50 → 400).

[COVERAGE] FR-NOTE-5 has no integration test for scenario NOTE-LIST-S4 (invalid cursor → 400).

[COVERAGE] FR-NOTE-5 has no integration test for scenario NOTE-LIST-S5 (soft-deleted notes excluded from list).

[COVERAGE] FR-NOTE-6 has no integration test for scenarios NOTE-LIST-SORT-S1 through NOTE-LIST-SORT-S5 (none of the four sort combinations or invalid sort rejection are tested).

[COVERAGE] FR-NOTE-7 has no integration test for scenarios NOTE-LIST-TAG-S1 (single tag filter), NOTE-LIST-TAG-S2 (AND semantics), or NOTE-LIST-TAG-S3 (foreign tagId → 422).

[COVERAGE] FR-NOTE-5 has no unit test for `listNotesController` validating the controller layer in isolation (e.g., safeParse failure path, correct service call arguments, 200 response shape). `notes.controller.test.ts` vi.mock does not include `listNotes` and does not import `listNotesController`.

---

## 2026-06-26T12:00:00Z -- Task 5 Review

### Scenario ID coverage — one test per scenario

[OK] NOTE-LIST-S1 appears in exactly one describe/it block (line 100/101). No duplicate.
[OK] NOTE-LIST-S2 appears in exactly one describe/it block (line 128/129). No duplicate.
[OK] NOTE-LIST-S3 appears in exactly one describe/it block (line 165/166). No duplicate.
[OK] NOTE-LIST-S4 appears in exactly one describe/it block (line 176/177). No duplicate.
[OK] NOTE-LIST-S5 appears in exactly one describe/it block (line 187/188). No duplicate.
[OK] NOTE-LIST-SORT-S1 appears in exactly one describe/it block (line 224/225). No duplicate.
[OK] NOTE-LIST-SORT-S2 appears in exactly one describe/it block (line 268/269). No duplicate.
[OK] NOTE-LIST-SORT-S3 appears in exactly one describe/it block (line 312/313). No duplicate.
[OK] NOTE-LIST-SORT-S4 appears in exactly one describe/it block (line 357/358). No duplicate.
[OK] NOTE-LIST-SORT-S5 appears in exactly one describe/it block (line 402/403). No duplicate.
[OK] NOTE-LIST-TAG-S1 appears in exactly one describe/it block (line 417/418). No duplicate.
[OK] NOTE-LIST-TAG-S2 appears in exactly one describe/it block (line 470/471). No duplicate.
[OK] NOTE-LIST-TAG-S3 appears in exactly one describe/it block (line 518/519). No duplicate.
All 13 scenario IDs (NOTE-LIST-S1..S5, NOTE-LIST-SORT-S1..S5, NOTE-LIST-TAG-S1..S3) are present exactly once. No scenario is duplicated or missing.

### FR-NOTE-5 — Cursor-paginated list acceptance

[OK] NOTE-LIST-S1 sub-bullet "items.length === 20" — line 122: `expect(body.items.length).toBe(20)` asserted.
[OK] NOTE-LIST-S1 sub-bullet "nextCursor is non-null" — lines 123-124: `expect(body.nextCursor).not.toBeNull()` AND `expect(typeof body.nextCursor).toBe('string')` both asserted.
[OK] NOTE-LIST-S2 sub-bullet "items.length === 5" — line 160: `expect(secondBody.items.length).toBe(5)` asserted.
[OK] NOTE-LIST-S2 sub-bullet "nextCursor === null" — line 161: `expect(secondBody.nextCursor).toBeNull()` asserted.
[OK] NOTE-LIST-S3 sub-bullet "status 400" — line 171: `expect(res.status).toBe(400)` asserted.
[OK] NOTE-LIST-S3 sub-bullet "code === 'VALIDATION_FAILED'" — line 172: `expect((res.body as { code: string }).code).toBe('VALIDATION_FAILED')` asserted.
[OK] NOTE-LIST-S4 sub-bullet "status 400" — line 182: `expect(res.status).toBe(400)` asserted.
[OK] NOTE-LIST-S4 sub-bullet "code === 'VALIDATION_FAILED'" — line 183: `expect((res.body as { code: string }).code).toBe('VALIDATION_FAILED')` asserted.
[OK] NOTE-LIST-S5 sub-bullet "soft-deleted note absent; items.length === 2 from 3 total where 1 is deleted" — lines 210-216: `expect(body.items.length).toBe(2)`, plus positive contains for note1/note2 IDs and negative for note3.id.

### FR-NOTE-6 — Sort acceptance

[OK] NOTE-LIST-SORT-S1..S4 sub-bullet "uses explicit timestamps — NOT relying on insertion order" — all four sort tests use `prisma.note.create` with explicit `createdAt` and `updatedAt` overrides (e.g., `new Date(base - 2000)`, `new Date(base - 1000)`, `new Date(base)`). Insertion order is never relied upon.
[OK] NOTE-LIST-SORT-S1 sub-bullet "asserts C, B, A order by ID comparison" — lines 261-264: `expect(items[0]!.id).toBe(noteC.id)`, `expect(items[1]!.id).toBe(noteB.id)`, `expect(items[2]!.id).toBe(noteA.id)`.
[OK] NOTE-LIST-SORT-S2 sub-bullet "asserts A, B, C order" — lines 305-308: `expect(items[0]!.id).toBe(noteA.id)`, `expect(items[1]!.id).toBe(noteB.id)`, `expect(items[2]!.id).toBe(noteC.id)`.
[OK] NOTE-LIST-SORT-S3 sub-bullet "asserts updatedAt:desc newest first" — line 352-353: `expect(items[0]!.id).toBe(noteC.id)` where noteC has `updatedAt: new Date(base)` (newest). Asserts only first item; sufficient given explicit timestamps make the ordering deterministic.
[OK] NOTE-LIST-SORT-S4 sub-bullet "asserts updatedAt:asc oldest first" — lines 397-398: `expect(items[0]!.id).toBe(noteA.id)` where noteA has `updatedAt: new Date(base - 2000)` (oldest).
[OK] NOTE-LIST-SORT-S5 sub-bullet "status 400 + VALIDATION_FAILED" — lines 408-409: `expect(res.status).toBe(400)` and `expect((res.body as { code: string }).code).toBe('VALIDATION_FAILED')`.

### FR-NOTE-7 — Tag filter acceptance

[OK] NOTE-LIST-TAG-S1 sub-bullet "items.length === 2 (N1 and N2, not N3)" — lines 460-466: `expect(body.items.length).toBe(2)`, `expect(returnedIds).toContain(n1.id)`, `expect(returnedIds).toContain(n2.id)`, `expect(returnedIds).not.toContain(n3.id)`. Single tag filter with N1 (tagA only), N2 (tagA+tagB), N3 (tagB only) — correct fixture matches spec scenario.
[OK] NOTE-LIST-TAG-S2 sub-bullet "items.length === 1 AND items[0].id === N2.id (AND semantics, not OR)" — lines 512-514: `expect(body.items.length).toBe(1)` and `expect(body.items[0]!.id).toBe(n2.id)`. Fixture has N1 (tagA), N2 (tagA+tagB), N3 (tagB); querying tagIds=A,B correctly returns only N2.
[OK] NOTE-LIST-TAG-S3 sub-bullet "status 422 AND code === 'INVALID_TAG'" — lines 529-530: `expect(res.status).toBe(422)` and `expect((res.body as { code: string }).code).toBe('INVALID_TAG')`.

### Test isolation

[OK] `beforeEach` deletes notes first (NoteTag cascade) then tags for both users (lines 85-89): `prisma.note.deleteMany({ where: { userId: { in: [ownerId, otherId] } } })` followed by `prisma.tag.deleteMany({ where: { userId: { in: [ownerId, otherId] } } })`. Users are kept alive across tests.
[OK] `afterAll` disconnects prisma (line 93): `prisma.$disconnect()` called.
[OK] `beforeAll` creates both users exactly once (lines 65-83). Each test begins with a clean slate of notes/tags from `beforeEach`.

### Setup pattern — matches notes.test.ts

[OK] Uses supertest `request` imported from `'supertest'` (line 25).
[OK] Same express app construction: `express.json()`, `cookieParser()`, `createAuthRouter()` on `/auth`, `notesRouter` on `/notes`, `errorHandler` (lines 36-41). Mirrors `index.ts` mount order.
[OK] `bearer()` helper defined at line 59 as `(token: string) => ({ Authorization: \`Bearer \${token}\` })` — identical pattern to notes.test.ts.

### Summary

All 13 scenario IDs are covered exactly once, with no duplicates or omissions. Every FR-NOTE-5, FR-NOTE-6, and FR-NOTE-7 acceptance sub-bullet has a corresponding assertion in the test file. Sort tests use explicit Prisma timestamp overrides (not insertion order). Test isolation is correct. No findings of FAIL, WARN, SEC, or COVERAGE.
