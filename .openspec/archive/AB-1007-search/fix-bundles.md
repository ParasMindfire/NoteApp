# Fix Bundles — AB-1007 Search

> Proposed fix bundles (spec edit + FRS edit if needed + code fix) awaiting user approval.

## FB-1 — T4 spec drift: $use → $extends (APPLIED)

**Finding:** [WARN] T4 reviewer — spec.md Decision 2 named `$use()` but implementation uses `$extends()`.
**Root cause:** plan.md correctly switched to `$extends` (non-deprecated); spec.md was not updated.
**Fix applied:** spec.md Decision 2 updated to name `$extends()` with a parenthetical explaining the switch.
**FRS change:** none (FRS describes behavior, not the Prisma API used).
**Code change:** none (code was already correct).

## FB-2 — T5 float precision in cursor predicate (APPLIED)

**Finding:** [FAIL] Tester — SEARCH-PAGE-S2 returned empty page 2. `ts_rank()` returns PostgreSQL `real` (4-byte float); Prisma passes JS `number` as `double precision` (8-byte float). Type promotion causes `=` comparison to silently fail.
**Root cause:** Float type mismatch between `ts_rank()` output and parameterized value.
**Fix applied:** Cast both sides of the cursor predicate to `::real` in `search.service.ts` cursor clause.
**FRS change:** none.
**Spec change:** none.

## FB-3 — Missing SEARCH-PAGE-S3 scenario + bad cursor test (APPLIED)

**Finding:** [COVERAGE] T5/T6-T7 reviewer — FRS FR-SEARCH-3 lists "400 VALIDATION_FAILED — invalid cursor" but no named test covered it.
**Root cause:** spec.md scenarios only listed SEARCH-PAGE-S1..S2; the invalid cursor error path was omitted.
**Fix applied:**
  - spec.md: added scenario SEARCH-PAGE-S3 (malformed cursor → 400 VALIDATION_FAILED)
  - search.test.ts: added `"SEARCH-PAGE-S3: rejects malformed cursor with 400 VALIDATION_FAILED"`
**FRS change:** none (FR-SEARCH-3 already covers this error).
**Code change:** none.
