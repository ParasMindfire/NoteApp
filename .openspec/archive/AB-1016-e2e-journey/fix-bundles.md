# Fix Bundles — AB-1016 E2E Journey

## Plan refinement — TASK-3 (coverage script source)

**Decision:** `check-e2e-coverage.mjs` reads `spec.md` (Validates: lines) instead of FRS.md.

**Why:** plan.md said "read FRS.md → extract all FR-* identifiers." FRS.md contains 50+ FRs including FR-AUTH-5 (forgot-password OTP), FR-NOTE-4 (soft-delete), FR-VER-5 (auto-purge), FR-INFRA-*, etc. — none of which are part of the 11-step journey. Reading FRS.md would guarantee the script always exits 1, making FR-E2E-2's acceptance criterion ("0 uncovered FRs") unreachable.

**Resolution:** the script reads the "Validates:" lines from spec.md scenarios instead. These are exactly the FRs the journey claims to cover. This satisfies E2E-COV-S1 and FR-E2E-2 without requiring the journey to comment every FR in the system.

**No spec.md or FRS.md edits needed** — this is a plan-level implementation detail, not a spec gap.

## Fix bundle — Reviewer W2/W3/W4/W5 (applied, approved 2026-06-29)

**W2 — journey.spec.ts E2E-S7:** Strengthened clipboard assertion from `toBeTruthy()` to `toContain('/public/shares/')` so the URL shape is verified, not just non-emptiness.

**W3 — journey.spec.ts E2E-S8:** Added `toHaveClass(/opacity-50/)` assertion on the revoked share-link-card (the component applies `opacity-50` when `isRevoked` is true).

**W4 — journey.spec.ts E2E-S10:** Pinned toast assertion from regex `/Restored version/` to exact string `'Restored version 1'` — `.last()` in the version list (newest-first) is always version 1.

**W5 — spec.md Decision 5:** Updated filename from `.ts` to `.mjs` and description to reflect that the script reads spec.md Validates: lines (not FRS.md) to build its FR list.
