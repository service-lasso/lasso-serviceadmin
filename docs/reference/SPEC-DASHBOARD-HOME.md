# SPEC-DASHBOARD-HOME

## Intent

Operator home must show the job, not vanity counts. Dashboard `/` uses Core
`GET /api/dashboard` JSON already on home (PR-A) plus read-only
`GET /api/metrics`, `GET /api/operator/inbox/counts`,
`GET /api/runtime/instance`, and `GET /api/network` (PR-B).

This is the Service Admin consumer of Core `SPEC-002` `AC-4O` (dashboard),
`AC-4M` / `AC-4AY` (metrics and crash counts), and `AC-4BC` (network exposure
counts). Admin must not invent Core product APIs.

## Scope

- Fleet mix, named failures, unique listen ports, Inbox unread, generation
  lane, Traefik entrypoints vs live backends, and log-line volume on `/`.
- Counts, safe notes, and allowlisted identifiers only.

## Out of scope

- Rebuilding Inbox (`#375`).
- Broker ready / lockout chips (shipped in `#535`).
- Secret values, auto-onboard, env dump, APM, credentials, or filesystem
  paths on home.
- Core or Broker product changes.
- Release 1.0 / GA publication.

## Requirements

- `DH-001` Home splits running vs available vs stopped vs crashed. Running,
  available, and stopped come from `GET /api/dashboard`. Crashed overlays
  `GET /api/metrics` `lastTermination=crashed` while not running. Empty fleet
  is all zeros.
- `DH-002` Named failures show service name, sanitized note, last start, and
  `installed=false` when the service is not installed.
- `DH-003` The Network card counts unique daemon listen ports from dashboard
  endpoints, not `networkExposureCount` link totals.
- `DH-004` Inbox unread is a count-only chip from
  `GET /api/operator/inbox/counts` that links to `/inbox`.
- `DH-005` Generation lane comes from `GET /api/runtime/instance` phase,
  selected/active generation id, and classification. Roots, executable paths,
  command hashes, and advertised URLs stay off home.
- `DH-006` Traefik entrypoints vs live backends come from dashboard listens
  plus `GET /api/network`. Missing `@traefik` is an explicit missing state.
- `DH-007` Log volume shows stdout/stderr line counts from `GET /api/metrics`.
  Paths and command lines stay off home. Stderr volume is not an app error.
- `DH-008` Home withholds secret-looking text, credentials, env dumps, and
  filesystem paths in notes, warnings, chips, routes, logs, and fixtures.
- `DH-009` Counts stay the same after a refresh when source JSON is unchanged.
- `DH-010` Missing Traefik, unavailable metrics, or unavailable Inbox counts
  do not hide dashboard JSON chips. Those chips show missing/unavailable
  instead of fake zeros where zero would lie.

## Acceptance Criteria

- Empty fleet, all-running, mixed crash/stopped, named failure,
  Inbox zero vs unread, missing Traefik, metrics unavailable, redaction, and
  refresh persistence are covered by tests.
- No secret values, credentials, or paths appear in home evidence.

## Tests and Evidence

- `src/features/dashboard/dashboard-home-metrics.test.ts`
- `src/features/dashboard/dashboard.test.tsx`
- `src/lib/service-lasso-dashboard/home-runtime.test.ts`
- `npm test` and `npm run build`

## Verification

Open `/` against a runtime with mixed service states. Confirm the Services
card splits the mix, Listen ports is not a link count, named failures include
note / last start / not-installed, Inbox links to `/inbox`, generation and
Traefik chips stay metadata-only, and log volume is counts only.
