# Service Admin UI

Service Admin UI is the operator dashboard for inspecting and controlling Service Lasso services.

It is a Service Lasso service package for `@serviceadmin`, built as a Vite/React dashboard and packaged so the Service Lasso runtime can install, configure, start, stop, and verify it like any other managed service.

![Service Admin UI](public/images/service-admin-ui.png)

## Service identity

| Field                | Value                                           |
| -------------------- | ----------------------------------------------- |
| Service id           | `@serviceadmin`                                 |
| Service name         | Service Admin UI                                |
| Repository           | `service-lasso/lasso-serviceadmin`              |
| Local repo           | `C:\projects\service-lasso\lasso-@serviceadmin` |
| Default service port | `17700`                                         |
| Runtime command      | `NODE runtime/server.js`                        |
| Service dependencies | `@node`, `@traefik`                             |
| License              | Apache-2.0                                      |

The canonical service manifest is `service.json`. Release packaging uploads `service.json` as a separate release asset and packages the deployable UI/runtime content separately.

## Runtime API endpoint

This admin UI discovers the Service Lasso runtime/API endpoint from environment, not from hardcoded localhost assumptions.

Current env contract:

- `VITE_SERVICE_LASSO_API_BASE_URL`
- `VITE_SERVICE_LASSO_FAVORITES_ENABLED`
- `VITE_SERVICE_LASSO_LOGS_DEBUG`

Example:

```bash
VITE_SERVICE_LASSO_API_BASE_URL=http://127.0.0.1:3001
VITE_SERVICE_LASSO_FAVORITES_ENABLED=true
```

Current UI runtime behavior:

- if `VITE_SERVICE_LASSO_API_BASE_URL` is set, dashboard service status, health, runtime actions, and logs are read from the live Service Lasso runtime API
- if `VITE_SERVICE_LASSO_API_BASE_URL` is missing, the UI uses local demo stub data for development preview only
- lifecycle and favorite changes are persisted in browser local storage during demo/stub development sessions
- a configured but unavailable runtime API is treated as an error instead of falling back to demo status
- favorites editing is only enabled when `VITE_SERVICE_LASSO_FAVORITES_ENABLED=true`
- favorites are expected to load from `GET /api/services/meta`
- favorites are expected to update through `PATCH /api/services/:serviceId/meta`
- service status is expected to load from `GET /api/dashboard` and `GET /api/dashboard/services`
- bulk start is expected to call `POST /api/runtime/actions/startAll`
- reload is expected to call `POST /api/runtime/actions/reload`
- set `VITE_SERVICE_LASSO_LOGS_DEBUG=true` to enable Logs screen debug output in the browser console outside dev mode
- if the endpoint env var is missing or the favorites flag is not enabled, favorite controls stay visible but disabled

## Service Lasso UI migration rule

The dashboard page shape is a hard invariant, not just inspiration.

Every Service Lasso page must keep the shared dashboard structure:

- template `Header`
- template `Main` content container
- consistent content spacing and section rhythm
- native patterns for cards, tables, forms, dialogs, drawers, and empty/loading/error states

Do not cut a route down to a bare card or ad-hoc layout just because the feature slice is small. If a page exists, it must fit the same proper Service Admin content space as the other pages.

See `docs/reference/MIGRATION-REPORT.md` for the stricter migration rules.

## Local development

Install dependencies:

```bash
npm ci --legacy-peer-deps
```

For editable local installs, use:

```bash
npm install --legacy-peer-deps
```

`npm run test:dev-server` requires the `@service-lasso/service-lasso` devDependency from `node_modules`; run one of the install commands above after a fresh clone or pull.

Start the Vite dev server:

```bash
npm run dev
```

Run the service-package dev server verification:

```bash
npm run test:dev-server
```

Preview on the fixed LAN-test port:

```bash
npm run preview:lan-test
```

## Validation commands

Use the smallest gate that proves the slice, and prefer the full local gate before claiming release readiness:

```bash
npm run format:check
npm run lint
npm run test
npm run build
npm run test:dev-server
npm audit --audit-level=moderate
```

For UI/browser behavior, use the relevant Playwright/Cypress target in addition to the build/test gate.

## Packaging and release

The release workflow packages platform artifacts for the UI/runtime and uploads `service.json` separately.

Expected release artifact shape:

- package archives contain deployable app/runtime content
- `service.json` is a separate release asset
- archives do not embed `service.json`
- generated build/package output is not committed to the repo

## Important docs

| Document                                               | Purpose                                                  |
| ------------------------------------------------------ | -------------------------------------------------------- |
| `service.json`                                         | Canonical Service Lasso service manifest.                |
| `docs/reference/MIGRATION-REPORT.md`                   | Migration/layout constraints and page-shape rules.       |
| `docs/reference/DEPENDENCY-GRAPH-SPEC.md`              | Dependency graph UI behavior and validation notes.       |
| `docs/openspec-drafts/OPENSPEC-TRACKER.md`             | Draft spec tracker for ongoing Service Admin contracts.  |
| `docs/openspec-drafts/SPEC-CI-SECURITY-MAINTENANCE.md` | CI/runtime and dependency-security maintenance contract. |

## Notes for agents

- Keep this repo branded as Service Admin UI / Service Lasso.
- Do not restore donor dashboard README prose, package names, metadata, screenshots, sponsorship copy, or links.
- Keep work scoped to one issue/branch/PR where possible.
- Leave issue comments for meaningful state changes, validation, blockers, and final outcome.
