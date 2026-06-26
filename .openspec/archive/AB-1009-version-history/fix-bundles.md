# Fix Bundles: AB-1009 — Version History

## FB-1 — Task 4 WARN/COVERAGE disposition (approved 2026-06-27)

**[WARN] TOCTOU in restoreVersion** — `note` state read outside `$transaction`; concurrent PATCH could stale the pre-restore snapshot.
**Decision:** Accept. Identical pattern exists in `updateNote` (notes.service.ts). Fixing only in `restoreVersion` would create inconsistency. FRS does not mandate re-reading inside the transaction. No code change.

**[COVERAGE] `getVersion` VERSION_NOT_FOUND path** — no spec scenario VER-VIEW-S2 exists; tester did not cover this error path.
**Decision:** Add one extra assertion to the Task 9 SUBAGENT brief: `getVersion(ownerId, noteId, 'nonexistent')` → throws `AppError(404, 'VERSION_NOT_FOUND')`. No code change to service.

## FB-2 — Task 9 [FAIL] error shape assertions (approved 2026-06-27)

**[FAIL] RFC 7807 error shape partially untested** — error-path tests (`VER-LIST-S2`, `VER-VIEW-S2`, `VER-RESTORE-S2`, `VER-AUTH-S1`) asserted only `code`; fields `type`, `title`, `status`, `detail` were unchecked. delta-openapi.yaml `Error` schema requires all five fields.
**Decision:** Add four assertions per error-path test in `versions.test.ts`: `type` contains the code string, `title` is truthy, `status` matches HTTP status, `detail` is truthy. Applied to all four error scenarios.

