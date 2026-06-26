# Fix Bundles — AB-1006 Tags CRUD

## Fix Bundle 2 — tags.service.ts coverage below 80% (approved)

**Trigger:** `tags.service.ts` at 72% statements (below 80% DoD threshold); `tags.controller.ts` PATCH validation branch uncovered.

**Code changes only — add 3 tests to `apps/api/src/__tests__/tags.test.ts`:**

1. **TAG-UPDATE-S1** — PATCH /tags/:id with `{ name: 'Renamed' }` → 200, body.name === 'Renamed'
   - Covers `prisma.tag.update` success path in `updateTag` (lines 87–96 of tags.service.ts)

2. **TAG-UPDATE-DUPLICATE-S1** — create two tags, PATCH second to first's name → 409 TAG_NAME_DUPLICATE
   - Covers P2002 catch in `updateTag` (lines 97–99 of tags.service.ts)

3. **TAG-PATCH-VALIDATION-S1** — PATCH /tags/:id with `{ color: 'bad' }` → 400 VALIDATION_FAILED
   - Covers PATCH validation branch in tags.controller.ts (lines 28–29)

---

## Fix Bundle 1 — Task 7 coverage gaps (approved)

**Trigger:** Reviewer [COVERAGE] findings on Task 7 test file.

**Code changes only** (no spec or FRS edits needed — behaviors already specified):

Add two tests to `apps/api/src/__tests__/tags.test.ts`:

1. **TAG-AUTH-S1** — POST /tags with no Authorization header → 401 AUTH_TOKEN_INVALID
   - FRS FR-TAG-2: "401 AUTH_TOKEN_INVALID" listed as error for all tag endpoints
   - Covers `requireAuth` middleware on the `/tags` mount

2. **TAG-UPDATE-NOOP-S1** — PATCH /tags/:id with `{}` body → 200, body matches original tag
   - spec.md decision 5: "PATCH with {} performs no DB write and returns the unchanged tag with 200"
