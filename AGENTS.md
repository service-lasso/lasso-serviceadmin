# Service Admin delivery rules

- Normal development starts from current `develop`, uses an issue-scoped
  `feature/`, `fix/`, `docs/`, or `chore/` branch, and targets `develop` by PR.
- Do not inspect, fetch, compare, branch from, merge from, or target the
  promotion branch during normal development. Promotion-branch access is
  limited to the explicitly authorized #550 reconciliation/final release role.
- Never push directly to a protected branch, force-push, weaken a failed audit
  or browser gate, or publish from an ordinary branch push.
- Preserve unrelated dirty, active, ambiguous, external, and historical
  worktrees. Use a fresh issue-scoped worktree.
- Release claims require the exact installed Admin/Core/Broker packages and
  Windows, Linux, and macOS browser/runtime evidence; fixtures and source builds
  are not final acceptance.

