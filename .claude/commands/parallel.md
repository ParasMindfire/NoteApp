You are setting up parallel work across git worktrees for [PARALLEL]
tasks (Rule 7).

This command is invoked when tasks.md has two or more tasks marked
[PARALLEL] that can proceed in different worktrees — most commonly
backend + frontend work after a shared API contract is approved.

You DRAFT shell commands; the user EXECUTES them. You never run git.

Steps:
1. Read tasks.md. Find all [PARALLEL] task pairs/groups.
2. For each parallel group, propose a worktree name based on the
   scope (e.g., apps-api, apps-web, packages-shared).
3. Output a paste-ready block for each worktree:

     git worktree add ../<repo-name>-<scope> <existing-branch>
     # OR for a new branch:
     git worktree add -b <type>/AB-{ticket}-<scope> ../<repo-name>-<scope>

     cd ../<repo-name>-<scope>
     pnpm install

4. Tell the user exactly what to do next:
   - Open a NEW terminal in the new worktree folder
   - Start a fresh `claude` session in that terminal
   - The new Claude session should run /clear and pick up only the
     [PARALLEL] tasks scoped to that worktree

5. After both parallel branches finish, the user merges them
   back through normal PR review — NOT through this command.

6. To clean up after merge:
     git worktree remove ../<repo-name>-<scope>

CRITICAL CONSTRAINTS:
- NEVER run git worktree commands yourself; only draft them.
- Worktrees share .git but NOT node_modules; each needs its own
  `pnpm install`. Tell the user this explicitly.
- Each worktree should run an INDEPENDENT Claude session with /clear.
  Two Claude sessions sharing context is Rule 4 violation.
- Worktrees are ephemeral. They exist only for the duration of the
  parallel work and are removed after merge.

EXAMPLE OUTPUT for tasks.md with:
  - [IMPL] [PARALLEL] apps/api/src/services/notes.service.ts (AB-1004)
  - [IMPL] [PARALLEL] apps/web/src/pages/NotesPage.tsx (AB-1011)

You would output:

  # Worktree 1: backend work
  git worktree add ../note-app-api feat/AB-1004-notes-crud
  cd ../note-app-api && pnpm install
  # Then in a new terminal, in that folder:
  claude
  # /clear, then continue with backend tasks

  # Worktree 2: frontend work
  git worktree add -b feat/AB-1011-notes-list ../note-app-web
  cd ../note-app-web && pnpm install
  # In a new terminal, in that folder:
  claude
  # /clear, then continue with frontend tasks

  # When both branches are merged, clean up:
  git worktree remove ../note-app-api
  git worktree remove ../note-app-web