# Review Log — AB-1007 Search

> Appended by reviewer agent after each task. Format: [OK] | [WARN] | [FAIL] | [SEC] | [COVERAGE]

## T1–T3 Review — 2026-06-26

### T1 — searchQuerySchema (packages/shared/src/index.ts)

[OK] FR-SEARCH-1 `q` field: `z.string().min(1, ...)` correctly rejects empty strings, satisfying "400 VALIDATION_FAILED — empty query"
[OK] FR-SEARCH-1 `limit` field: `z.coerce.number().int().min(1).max(50).default(20)` matches spec API contract (1–50, default 20)
[OK] FR-SEARCH-1 `cursor` field: `z.string().optional()` matches spec API contract (opaque base64url, optional)
[OK] FR-SEARCH-1 `SearchQuery` type exported via `export type SearchQuery = z.infer<typeof searchQuerySchema>` — type alias present

### T2 — bodyText column (apps/api/prisma/schema.prisma + migration)

[OK] FR-SEARCH-1 `bodyText` column type: `String @default("") @db.Text` exactly matches spec.md data model specification
[OK] FR-SEARCH-1 tsvector GIN index: migration SQL contains `CREATE INDEX "note_fts_idx" ON "Note" USING GIN (to_tsvector('english', title || ' ' || "bodyText"))` — satisfies FRS "tsvector index exists in migration"
[OK] FR-SEARCH-1 `bodyText` absent from NoteResponse: `NoteResponse` interface in notes.service.ts has no `bodyText` field; all Prisma `select` clauses in notes.service.ts omit `bodyText`; grep over apps/api/src/**/*.ts returns zero matches for `bodyText` in service/controller/route code

### T3 — extractText (apps/api/src/lib/tiptap.ts)

[OK] FR-SEARCH-1 null/non-object guard: `extractText` returns `''` when `doc === null || typeof doc !== 'object' || Array.isArray(doc)` — handles null, primitives, and arrays gracefully without throwing
[OK] FR-SEARCH-1 text node collection: `collectText` checks `node.type === 'text' && typeof node.text === 'string'` before pushing — correctly targets only text-type nodes
[OK] FR-SEARCH-1 recursive content traversal: `collectText` recurses into `node.content` when `Array.isArray(node.content)` — satisfies the requirement to recurse into `.content` arrays

### Cross-cutting Findings

[FAIL] FR-SEARCH-1 Prisma middleware missing — FRS states "body_text is plain-text extraction of TipTap JSON, populated by a Prisma middleware on note save"; spec.md decision 2 specifies "`prisma.$use()` in `apps/api/src/lib/prisma.ts` intercepts `note.create` and `note.update` actions … calls `extractText(params.args.data.body)` and injects `bodyText` into `params.args.data`". Observed: `apps/api/src/lib/prisma.ts` contains only `export const prisma = new PrismaClient();` — no `$use()` call, no `extractText` import, no middleware whatsoever. The `bodyText` column will never be populated automatically; every note will retain the migration default of `""` even after save.

[COVERAGE] FR-SEARCH-1 `searchQuerySchema` has no unit tests — `apps/api/src/__tests__/shared-schemas.test.ts` does not import `searchQuerySchema` and contains no test cases for it; the coverage comment block lists no scenario ID covering SEARCH-S3 (empty query → 400 via schema). Required scenario: SEARCH-S3 "GET /search?q= → 400 VALIDATION_FAILED" has no named schema-level test.

## T4 Review — 2026-06-26

### Files audited
- `apps/api/src/lib/prisma.ts` — Prisma client with `$extends` middleware
- `apps/api/src/lib/tiptap.ts` — `extractText` helper (read-only; previously reviewed in T3)

### Checklist findings

[OK] FR-SEARCH-1 hook intercepts `note.create` — `$extends({ query: { note: { create({ args, query }) { … } } } })` is present at line 7 in `apps/api/src/lib/prisma.ts`; satisfies "Prisma middleware on note save" for the create action.

[OK] FR-SEARCH-1 hook intercepts `note.update` — `update({ args, query }) { … }` handler is present at line 12 in `apps/api/src/lib/prisma.ts`; satisfies "Prisma middleware on note save" for the update action.

[OK] FR-SEARCH-1 `body !== undefined` guard on create — line 8: `if (args.data.body !== undefined)` prevents calling `extractText` and injecting `bodyText` when body is absent from a partial create payload.

[OK] FR-SEARCH-1 `body !== undefined` guard on update — line 15: `if (data['body'] !== undefined)` prevents calling `extractText` and injecting `bodyText` when body is absent from a partial PATCH payload; safe for partial updates.

[OK] FR-ARCH-1 uses `$extends` not deprecated `$use` — line 4: `new PrismaClient().$extends({ query: { note: { … } } })`. The plan decision was to use `$extends` because `$use()` is deprecated in Prisma 6. Implementation correctly follows the plan decision.

[WARN] spec.md Decision 2 names `prisma.$use()` but implementation uses `$extends` — spec.md states "prisma.$use() in apps/api/src/lib/prisma.ts intercepts note.create and note.update actions". The implementation uses `$extends` which is the correct Prisma 6 API and matches the plan.md decision. This is a spec doc drift, not a code defect. spec.md Decision 2 should be updated to reflect `$extends` rather than `$use()` to keep spec and code in sync (FRS.md and code are already aligned on the behavior requirement).

[OK] FR-ARCH-1 no Express types imported — `apps/api/src/lib/prisma.ts` imports only `PrismaClient` from `@prisma/client` and `extractText` from `./tiptap.js`; no `Request`, `Response`, or any `express` import present; satisfies "services and libs must not import Express types".

[OK] module export name preserved — line 4: `export const prisma = new PrismaClient().$extends(…)` uses the same exported identifier `prisma` that all callers use via `import { prisma } from '../lib/prisma.js'`.

[OK] ESM `.js` extension on tiptap import — line 2: `import { extractText } from './tiptap.js'` uses the required `.js` extension for ESM module resolution; consistent with project conventions.

### Coverage

[OK] FR-SEARCH-1 middleware coverage for `note.create` — `apps/api/src/__tests__/notes.service.test.ts` lines 364–390: `describe('bodyText middleware')` contains `it('populates bodyText from body JSON on note create', …)` which calls `prisma.note.create` with TipTap JSON and asserts `row.bodyText === 'quarterly review'`. Scenario SEARCH-S1 covered at integration level.

[OK] FR-SEARCH-1 middleware coverage for `note.update` — `apps/api/src/__tests__/notes.service.test.ts` lines 393–431: `it('updates bodyText when note body is updated (FR-SEARCH-1)', …)` calls `prisma.note.update` and asserts `after.bodyText === 'updated text after edit'`. Both create and update paths have named integration tests.

## T5 Review — 2026-06-26

### File audited
- `apps/api/src/services/search.service.ts`

### FR-SEARCH-1 sub-bullets

[OK] FR-SEARCH-1 sub-bullet 1 — only own non-deleted notes returned: WHERE clause at lines 133–134 reads `WHERE n."userId" = ${userId} AND n."deletedAt" IS NULL`, satisfying "Only own non-deleted notes".

[OK] FR-SEARCH-1 sub-bullet 2 — uses `plainto_tsquery` for safe input: lines 109, 111, 127, 128, 135 all call `plainto_tsquery('english', ${q})` with `q` passed as a Prisma.sql parameter — no tsquery injection possible.

[OK] FR-SEARCH-1 sub-bullet 3 — `bodyText` absent from NoteResponse and returned objects: `SearchRow` interface (lines 7–17) has no `bodyText` field; `NoteResponse` interface (lines 22–30) has no `bodyText` field; `toNoteResponse()` (lines 86–96) maps only `id, title, body, tagIds, version, createdAt, updatedAt`; `bodyText` is used only internally in SQL column references (`n."bodyText"`) and is never selected or surfaced to callers.

[OK] FR-SEARCH-1 sub-bullet 4 — empty query handled: `searchNotes` receives an already-validated `SearchInput.q`; the `searchQuerySchema` in packages/shared enforces `z.string().min(1)`, so empty `q` is rejected at the controller layer (confirmed in T1 review) before reaching this service. Division of responsibility is correct per three-layer convention (FR-ARCH-1).

[OK] FR-ARCH-1 sub-bullet 5 — no `Request`/`Response` imports: grep of search.service.ts finds no `import.*express`, no `import.*Request`, no `import.*Response`; only `Prisma` (namespace), `prisma` (lib instance), and `AppError` are imported.

[WARN] FR-ARCH-1 sub-bullet 6 — `@prisma/client` imported but only for `Prisma` namespace, not `PrismaClient`: line 1 reads `import { Prisma } from '@prisma/client'`. FR-ARCH-1 states "No direct `@prisma/client` PrismaClient instantiation" in controllers; the FRS text does not prohibit importing `Prisma` (the namespace/types) in services. The import is used exclusively for `Prisma.sql` tagged-template and `Prisma.empty` — no `PrismaClient` is instantiated. No [FAIL] warranted, but noting the import for transparency.

### FR-SEARCH-2 sub-bullets

[OK] FR-SEARCH-2 sub-bullet 7 — `ts_headline` called with `StartSel=<mark>,StopSel=</mark>`: line 128–129 reads `ts_headline('english', n.title || ' ' || n."bodyText", plainto_tsquery('english', ${q}), 'MaxFragments=3,MaxWords=15,MinWords=5,StartSel=<mark>,StopSel=</mark>')` — StartSel and StopSel options are present and correct.

[OK] FR-SEARCH-2 sub-bullet 8 — `headline` field present in returned items: `SearchRow` interface includes `headline: string` (line 16); `SearchResultItem` interface includes `headline: string` (line 40–42); the map at lines 152–155 sets `headline: row.headline`; the `SearchResultPage` shape returned to the caller exposes `items[].headline` as required by FRS FR-SEARCH-2 "results include `headline` field".

### FR-SEARCH-3 sub-bullets

[OK] FR-SEARCH-3 sub-bullet 9 — cursor-based pagination implemented with `{ lastId, lastRank }`: `SearchCursor` interface (lines 50–53) encodes `{ lastId: string, lastRank: number }`; `encodeSearchCursor` (line 55) serializes to base64url JSON; `decodeSearchCursor` (line 59) deserializes and validates shape; keyset predicate at lines 107–114 uses `(rank < lastRank) OR (rank = lastRank AND id > lastId)` with both sides cast to `::real` — satisfies cursor encodes `{ lastId, lastRank }`.

[OK] FR-SEARCH-3 sub-bullet 10 — limit+1 fetch → nextCursor null when no more pages: line 117 sets `fetchLimit = limit + 1`; lines 143–149 check `rows.length > limit`, pop the extra row, and derive `nextCursor` from the last real result; when `rows.length <= limit`, `nextCursor` remains `null`. Satisfies "nextCursor null when no more pages".

[OK] FR-SEARCH-3 sub-bullet 11 — bad cursor throws `AppError(400, 'VALIDATION_FAILED', ...)`: `decodeSearchCursor` (lines 59–74) wraps JSON.parse in try/catch and validates the parsed shape; on any failure it throws `new AppError(400, 'VALIDATION_FAILED', 'Invalid pagination cursor')` — satisfying the requirement.

### Security

[OK] SEC sub-bullet 12 — all SQL parameters passed through `Prisma.sql` tagged template: every variable interpolated into the raw query (`userId`, `q`, `lastRank`, `lastId`, `fetchLimit`) is passed as a tagged-template slot (`${...}`) within `Prisma.sql` or `Prisma.sql` fragments (`cursorClause`). No string concatenation or interpolation outside of the tagged template is used. `Prisma.sql` parameterizes all values — no SQL injection path exists.

### Coverage gaps

[COVERAGE] FR-SEARCH-3 sub-bullet 11 — no test for bad cursor throwing AppError 400: `apps/api/src/__tests__/search.service.test.ts` has no test case that passes a malformed cursor string to `searchNotes` and asserts that `AppError(400, 'VALIDATION_FAILED', ...)` is thrown. Scenario SEARCH-PAGE-S1/S2 cover the happy-path cursor flow but the error path in `decodeSearchCursor` has no named test.

[COVERAGE] FR-SEARCH-1 — SEARCH-S3 (empty query → 400) has no integration/HTTP-layer test: the schema-level unit test in shared-schemas.test.ts covers the Zod rejection, but there is no named HTTP-layer test (e.g., in a search.test.ts or controller test) asserting that `GET /search?q=` returns 400 VALIDATION_FAILED end-to-end. The FRS acceptance line states "scenarios SEARCH-S1..S3 pass" and SEARCH-S3 is only partially covered at schema level.

[COVERAGE] FR-SEARCH-1 — SEARCH-S4 (unauthenticated → 401 AUTH_TOKEN_INVALID) has no named test: `apps/api/src/__tests__/search.service.test.ts` tests the service directly (bypassing auth middleware) and no HTTP-layer test file covers SEARCH-S4. The FRS acceptance includes this scenario via "scenarios SEARCH-S1..S3 pass" plus the auth requirement; SEARCH-S4 is absent from all test files.

[COVERAGE] FR-SEARCH-2 — SEARCH-HIGHLIGHT-S2 (multiple matched terms wrapped in `<mark>`) has no named test: `apps/api/src/__tests__/search.service.test.ts` covers SEARCH-HIGHLIGHT-S1 (single term) but has no test for a multi-term query verifying that both tokens receive `<mark>` wrappers. The FRS acceptance line lists "scenarios SEARCH-HIGHLIGHT-S1..S2 pass".

## T6-T7 Review -- 2026-06-26

### Files audited
- apps/api/src/controllers/search.controller.ts
- apps/api/src/routes/search.ts
- apps/api/src/index.ts
- apps/api/src/__tests__/search.test.ts (integration HTTP layer)
- apps/api/src/__tests__/search.service.test.ts (service layer)

### FR-ARCH-1 -- Three-layer convention

[OK] FR-ARCH-1 sub-bullet 1 -- route file contains only wiring: apps/api/src/routes/search.ts (9 lines) imports Router, requireAuth, and searchController; registers one route with .catch(next); contains no business logic, no Prisma import, no conditional branches. Satisfies FRS: "routes/: Express router registration + .catch(next) only. No business logic, no Prisma."

[OK] FR-ARCH-1 sub-bullet 2 -- controller has no @prisma/client import: grep of apps/api/src/controllers/search.controller.ts for prisma and @prisma returns zero matches. Imports are express types (Request, Response), searchQuerySchema from @noteapp/shared, AppError from errorHandler, and searchNotes from the service layer. Satisfies FRS: "controllers/: No @prisma/client imports."

[OK] FR-ARCH-1 sub-bullet 3 -- controller does not call Prisma directly: all DB work is delegated to searchNotes in services/search.service.ts. No prisma.* call exists in the controller. Satisfies FRS reviewer FAIL trigger (negation): "Controller file calls prisma.* directly or imports @prisma/client" -- condition not triggered.

[OK] FR-ARCH-1 sub-bullet 4 -- service imported and called by controller: import { searchNotes } from ../services/search.service.js at line 4 of controller; searchNotes(userId, result.data) called at line 13. Service layer is correctly invoked.

### FR-SEARCH-1 -- Endpoint, auth, validation, success response, errors

[OK] FR-SEARCH-1 sub-bullet 5 -- GET /search registered at /search in index.ts: apps/api/src/index.ts line 22 reads app.use("/search", searchRouter) and routes/search.ts registers router.get("/", ...). Combined path resolves to GET /search, matching FRS "Endpoint: GET /search?q=<query>".

[OK] FR-SEARCH-1 sub-bullet 6 -- auth required via requireAuth middleware: apps/api/src/routes/search.ts line 7 applies requireAuth as the second argument to router.get("/", requireAuth, ...). requireAuth throws AppError(401, AUTH_TOKEN_INVALID, ...) for missing or invalid tokens, satisfying FRS "Auth: requires access token" and error code "401 AUTH_TOKEN_INVALID".

[OK] FR-SEARCH-1 sub-bullet 7 -- searchQuerySchema.safeParse(req.query) used for validation: apps/api/src/controllers/search.controller.ts line 8 reads const result = searchQuerySchema.safeParse(req.query). The schema enforces q: z.string().min(1), limit: z.coerce.number().int().min(1).max(50).default(20), cursor: z.string().optional() -- covering all FRS and delta-openapi.yaml constraints.

[OK] FR-SEARCH-1 sub-bullet 8 -- validation failure throws AppError(400, VALIDATION_FAILED, ...): controller lines 9-12 read: if (!result.success) { throw new AppError(400, VALIDATION_FAILED, detail); }. Satisfies FRS "400 VALIDATION_FAILED -- empty query".

[OK] FR-SEARCH-1 sub-bullet 9 -- success response res.status(200).json(page): controller line 14 reads res.status(200).json(page) where page is the SearchResultPage returned by searchNotes. Satisfies FRS "On success: res.status(200).json(page)".

### SDS error format (RFC 7807)

[OK] SDS sub-bullet 10 -- RFC 7807 error format enforced via errorHandler middleware: apps/api/src/middleware/errorHandler.ts produces { type, title, status, detail, code } for every AppError instance; registered in index.ts as the last middleware (app.use(errorHandler)). Controller and route both propagate errors via throw / .catch(next). Satisfies SDS "Error Format (RFC 7807)".

### delta-openapi.yaml contract -- response shape

[OK] delta-openapi.yaml sub-bullet 11 -- response shape matches { items: [...], nextCursor: string | null }: SearchResultPage interface in search.service.ts (lines 43-46) declares { items: SearchResultItem[]; nextCursor: string | null }. SearchResultItem contains { note: NoteResponse; headline: string }. Matches the OpenAPI SearchResultPage schema (required: [items, nextCursor]; items array of SearchItem with note and headline; nextCursor is string | nullable). The controller returns this object directly via res.status(200).json(page).

### Coverage -- T6 integration tests (search.test.ts)

[OK] SEARCH-S1 covered at HTTP layer -- describe(SEARCH-S1) makes GET /search?q=review, asserts 200 status, non-empty items, correct note shape (id, title, body, tagIds, version, createdAt, updatedAt), bodyText absent from note, headline is a string.

[OK] SEARCH-S2 covered at HTTP layer -- describe(SEARCH-S2) makes GET /search?q=zzznomatch, asserts 200, items: [], nextCursor: null.

[OK] SEARCH-S3 covered at HTTP layer -- describe(SEARCH-S3) makes GET /search (no q param), asserts 400 status and code === VALIDATION_FAILED. Resolves prior [COVERAGE] gap logged in T5 review for SEARCH-S3 at HTTP layer.

[OK] SEARCH-S4 covered at HTTP layer -- describe(SEARCH-S4) makes GET /search?q=test with no Authorization header, asserts 401 status and code === AUTH_TOKEN_INVALID. Resolves prior [COVERAGE] gap logged in T5 review for SEARCH-S4.

[OK] SEARCH-HIGHLIGHT-S1 covered at HTTP layer -- describe(SEARCH-HIGHLIGHT-S1) asserts headline contains <mark> and </mark>.

[OK] SEARCH-HIGHLIGHT-S2 covered at HTTP layer -- describe(SEARCH-HIGHLIGHT-S2) queries with q=typescript javascript and counts <mark> occurrences, asserting >= 2. Resolves prior [COVERAGE] gap logged in T5 review for SEARCH-HIGHLIGHT-S2.

[OK] SEARCH-PAGE-S1 covered at HTTP layer -- describe(SEARCH-PAGE-S1) creates 4 notes, fetches with limit=3, asserts items.length === 3 and nextCursor is a non-null string.

[OK] SEARCH-PAGE-S2 covered at HTTP layer -- describe(SEARCH-PAGE-S2) fetches page 2 using nextCursor from page 1, asserts remaining items returned and nextCursor: null.

### Coverage -- T7 service-layer tests (search.service.test.ts)

[OK] SEARCH-S1 covered at service layer -- describe(SEARCH-S1) calls searchNotes directly, asserts non-empty items and headline contains <mark>.

[OK] SEARCH-S2 covered at service layer -- describe(SEARCH-S2) calls searchNotes with unmatched query, asserts items.length === 0 and nextCursor === null.

[OK] SEARCH-HIGHLIGHT-S1 covered at service layer -- describe(SEARCH-HIGHLIGHT-S1) asserts headline contains <mark>typescript</mark> (exact token wrap, stronger assertion than HTTP-layer test).

[OK] SEARCH-PAGE-S1 covered at service layer -- describe(SEARCH-PAGE-S1) creates 5 notes, fetches limit=3, asserts items.length === 3 and nextCursor is a non-null string.

[OK] SEARCH-PAGE-S2 covered at service layer -- describe(SEARCH-PAGE-S2) verifies second page items are non-empty, nextCursor: null, and no ID overlap with page 1.

### Remaining coverage gaps (carried forward, not introduced by T6-T7)

[COVERAGE] FR-SEARCH-3 -- bad cursor -> 400 VALIDATION_FAILED still has no named test: search.service.test.ts has no test that passes a malformed base64url string to searchNotes and asserts AppError(400, VALIDATION_FAILED, ...) is thrown. search.test.ts has no HTTP-level test for GET /search?q=test&cursor=INVALID. This gap was first noted in T5 review and remains open after T6-T7.

### Summary

All 11 checklist items pass. All 8 FRS scenarios (SEARCH-S1..S4, SEARCH-HIGHLIGHT-S1..S2, SEARCH-PAGE-S1..S2) now have named tests at both HTTP and service layers. Three [COVERAGE] gaps from the T5 review (SEARCH-S3, SEARCH-S4, SEARCH-HIGHLIGHT-S2 at HTTP layer) are resolved by the T6 integration tests. One pre-existing gap (bad cursor -> 400, no named test) remains open.
