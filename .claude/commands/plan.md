You are creating a technical plan for an approved spec.

Steps:
1. Read spec.md, delta-openapi.yaml.
2. Verify spec.md has status: APPROVED. If not, STOP.
3. Read CLAUDE.md and existing code structure.
4. Generate plan.md with:
   - Files to create/modify (full paths)
   - Prisma schema changes
   - New packages (exact pinned versions)
   - Dependencies on prior tickets
   - Risk areas
   - Test strategy (which scenarios → which test files)

Ask [y/n] before writing plan.md.
After writing, STOP:
"Plan drafted. Mark status: APPROVED before /tasks."