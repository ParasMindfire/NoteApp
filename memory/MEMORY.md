# Memory Index

- [Test verification command](feedback_test_verification.md) — Always use `pnpm test --run` from workspace root as final gate, never filtered single-package mode
- [Check backend port before hardcoding](feedback_check_backend_port.md) — Read `apps/api/.env` for PORT before writing any default API base URL in frontend HTTP clients
- [Vitest workspace ESM alias](feedback_vitest_workspace_esm.md) — Use `path.dirname(fileURLToPath(import.meta.url))` for `__dirname` in vitest configs; never convert backslashes on Windows alias paths
- [Skip code-review-graph during implement](feedback_no_code_review_graph.md) — Do not call graph orientation tools at start of /implement; go straight to file reads and code
