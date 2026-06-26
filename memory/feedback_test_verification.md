---
name: feedback-test-verification
description: Tester agent must always run pnpm test --run from workspace root as final gate, not just write tests
metadata:
  type: feedback
---

Always use `pnpm test --run` from the workspace root as the final test gate after the tester agent writes tests. This runs the full Vitest suite including the pre-commit hook's test step, not just a filtered single-package mode.

**Why:** User wants Husky pre-commit test step validated on every tester invocation, not just test authoring.

**How to apply:** In every tester agent brief (BACKEND, FRONTEND, INFRA, E2E), include: "After writing tests, run `pnpm test --run` from the workspace root and report the full pass/fail summary."
