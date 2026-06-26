# Fix Bundles — AB-1005 Notes List, Sort, and Tag Filter

## Bundle 1 — Task 3 WARN: spec.md decision 4 wording (approved)

**Finding:** [WARN] spec.md decision 4 said "Implemented via Prisma `every` filter" but code
correctly uses `some`-in-AND pattern. Reviewer confirmed code is correct; spec wording was wrong.

**Changes applied:**
- `spec.md` decision 4: replaced `every` filter description with `AND: tagIds.map(...)` / `some`
  pattern and added explanation of why `every` would be semantically wrong for this use case.

**FRS change:** none — FRS only requires AND semantics, not a specific Prisma keyword.
**Code change:** none — implementation was already correct.
