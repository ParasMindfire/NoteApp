# Project: Note-Taking App

## Non-Negotiable Rules
- One ticket per session. Run /clear between tickets.
- Every ticket: /spec → human approval → /plan → human approval
  → /tasks → human approval → /implement → archive → /pr
- Ask [y/n] before EVERY file write. No silent writes.
- All shared types and Zod schemas live ONLY in packages/shared.
- Soft delete only — set deletedAt, never DELETE FROM notes.
- Context7 MCP must verify every external library API call.
- Conventional commits: feat(scope): description AB#xxxx

## Implementation Model
- Main Claude (this session) is the implementer.
- After EACH completed task in tasks.md, invoke watcher agents:
    1. Tester agent — writes/runs tests from spec scenarios
    2. Reviewer agent — audits code vs spec.md + FRS.md
- If watchers find gaps, propose a single FIX BUNDLE
  (spec edit + FRS edit if needed + code fix) for one user approval.
- Spec and FRS are LIVING documents during /implement.

## Tech Stack (Fixed)
Frontend: React 19 + TS + Vite + TanStack Query + Zustand + TipTap + shadcn/ui
Backend:  Node 22 + Express 5 + TS
DB:       PostgreSQL 16 + Prisma
Auth:     JWT (15min) + refresh token (7d, DB-stored)
Search:   PostgreSQL FTS
Testing:  Vitest + Supertest + Playwright

## Model Selection (Rule 8)
Use the right Claude model for each kind of work:
- **Haiku** — boilerplate generation, simple file edits, repetitive
  refactors, test scaffolding
- **Sonnet** — default for /implement, code writing, refactoring,
  debugging, tester agent work
- **Opus + ultrathink** — /spec drafting (architecture decisions),
  /plan for complex tickets, reviewer agent audits, fix bundle
  diagnosis for non-trivial gaps

Mention the recommended model when invoking subagents. Main session
defaults to Sonnet unless the task is clearly architectural.

## Subagent Delegation (Rule 6)
- Tasks estimated >45 minutes MUST be delegated to a subagent.
- NEVER create or use a `session-context.md` file as a workaround
  to keep work in the main session. Subagents are the only
  approved way to extend long-running work.
- Subagent briefs include: scope, files allowed, scenario IDs covered,
  recommended model.

## Parallelism (Rule 7)
- Tasks marked [PARALLEL] in tasks.md run in separate git worktrees
  via the /parallel slash command.
- Frontend and backend work MUST run in separate worktrees when
  proceeding simultaneously (typical for AB-1010 onwards once a
  backend dependency is merged).

## Out of Scope
- Realtime collab, file attachments, mobile, OAuth, folders, real email

## Definition of Done
- openspec validate passes
- /review shows all [OK] (run in a FRESH terminal -- Rule 16)
- pnpm build: 0 errors, 0 warnings
- pnpm lint --max-warnings 0
- pnpm test --coverage: all green, ≥80% on new code
- Every spec scenario has exactly one named test
- All error HTTP status codes match SDS API contracts exactly
- Happy path + all error scenarios manually smoke tested by user
- openspec archive completed
- spec.md, FRS.md, code all in sync (no orphaned fix bundles)
- PR description lists every FR covered + every scenario tested