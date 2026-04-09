# lasso-@serviceadmin

Optional operator UI for Service Lasso.

This repo now carries a cleaned Service Lasso-focused admin shell, local UI docs/OpenSpec drafts, and explicit harness-backed API stubs for the first control-plane slice.

## Current scope

Implemented now:

- dashboard
- services list
- service detail
- dependencies
- runtime
- logs
- network
- installed state
- operator settings

Included supporting material:

- `docs/openspec-drafts/OPENSPEC-TRACKER.md`
- `docs/openspec-drafts/SPEC-UI-ADMIN-SERVICE.md`
- `docs/reference/DECISION-CONTEXT.md`
- `docs/reference/SERVICEADMIN-NAV-AND-API.md`
- `docs/reference/UI-STATE-REVIEW.md`
- `docs/reference/SHADCN-ADMIN-REVIEW.md`
- `docs/reference/SHADCN-ADMIN-MAP.md`
- `docs/reference/SHADCN-ADMIN-REMOVAL-TARGETS.md`

## Stub status

The UI is now backed by a real served local stub API for testing.

The stub contract lives under `src/lib/service-lasso-api/` and is exposed at `/api/*` during `npm run dev` and `npm run preview`.

Implemented stub endpoints:

- `GET /api/health`
- `GET /api/runtime/status`
- `POST /api/runtime/actions/:action`
- `GET /api/services`
- `GET /api/services/:serviceId`
- `POST /api/services/:serviceId/actions/:action`
- `GET /api/dependencies`
- `GET /api/network`
- `GET /api/installed`
- `GET /api/settings`

That means the UI is no longer reading fake in-memory client returns directly. It now exercises a real HTTP API shape that can later be swapped to the actual Service Lasso backend.

## Dev

```bash
npm install --legacy-peer-deps
npm run lint
npm run format:check
npm run build
npm run dev
```

Dev server:
- listens on `0.0.0.0:17700`
- serves the stub API from the same origin at `/api/*`

Preview / long-running local serve:

```bash
npm run serve:e2e
```

That preview server also binds to `0.0.0.0:17700`.

## Cypress

```bash
npm run cy:open
npm run cy:run
npm run test:e2e
```

Current Cypress files:
- `cypress/e2e/api-contract.cy.js`
- `cypress/e2e/ui-routes.cy.js`
- `cypress/e2e/ui-actions.cy.js`
- `cypress/e2e/ui-spec-traceability.cy.js`

Traceability reference:
- `docs/reference/CYPRESS-TRACEABILITY.md`

## Direction

The UI stays:

- optional
- API-driven
- operator-focused
- separate from privileged runtime/bootstrap internals
