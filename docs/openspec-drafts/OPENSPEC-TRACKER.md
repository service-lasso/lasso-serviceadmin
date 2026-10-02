# Service Template - OpenSpec Tracker

_Status: working tracker_

## Current repo target
- `service-template`

## Draft Spec Register

| Draft Spec | Area | Status | Main Source Docs | Intended Repo Target | Notes |
| --- | --- | --- | --- | --- | --- |
| `SPEC-SERVICE-TEMPLATE-REPO.md` | Template | `draft` | `docs/reference/SERVICE-TEMPLATE-REPO.md`, `docs/reference/SERVICE-STRUCTURE-REVIEW.md`, `docs/reference/PROPOSED-CODEBASE-STRUCTURE.md` | `service-template` | Canonical template/service-author contract draft. |
| `SPEC-CI-SECURITY-MAINTENANCE.md` | CI/Security | `active draft` | `.github/workflows/*.yml`, `package.json`, `package-lock.json`, `pnpm-lock.yaml`, Cypress qualification harness | `lasso-serviceadmin` | ISS-27 through ISS-30 cover action compatibility, vulnerability hygiene, the supported dependency baseline, and the #670 Monaco-to-DOMPurify production advisory repair. Admin #651/#679 requires fail-closed owned-root admission, Core v3 public-custody binding, native first-child identity evidence and closed private streams; it does not attribute the retained Core exit-1 observation. |
| `SPEC-SERVICEADMIN-REPO-IDENTITY.md` | Repo identity | `draft` | `README.md`, `index.html`, `package.json`, `public/images/*` | `lasso-serviceadmin` | Service Admin identity contract and donor-branding cleanup. |
| `SPEC-SERVICEADMIN-REPO-IDENTITY.md` | Operator UI documentation | `draft` | `docs/help/*`, UI routes, screenshot manifest | `lasso-serviceadmin` | ISS-44 defines complete UI documentation; ISS-45 binds canonical reader guides to verified offline Help Center copies. |
| `SPEC-SERVICEADMIN-SERVICE-ACTIONS.md` | Lifecycle actions | `active draft` | `src/components/service-lifecycle-action-button.tsx`, `src/features/service-detail/index.tsx`, `src/features/services/components/services-columns.tsx` | `lasso-serviceadmin` | Core-owned permission, confirmation, and state-refresh contract for service action surfaces. |
| `SPEC-SERVICEADMIN-RESTART-DIAGNOSTICS.md` | Restart diagnostics | `active draft` | `cypress/e2e/secrets-broker/real-lifecycle.cy.js`, `scripts/service-detail-readiness-diagnostic.mjs` | `lasso-serviceadmin` | Admin #636/#675 and child #672; closed service-detail readiness, pre-click trusted-unlock receipt, and v2 causal envelope are bounded to the real Broker restart caller. Core #1382 retains the original macOS failure and attribution limits; full packaged qualification remains pending. |

## Current focus
1. lock the canonical template repo contract
2. define the minimum sample service + packaging/release path
3. define the first harness-facing validation example shape
4. only then broaden into more detailed template variants if still needed

## Current local source set
- `README.md`
- `docs/openspec-drafts/SPEC-SERVICE-TEMPLATE-REPO.md`
- `docs/openspec-drafts/SPEC-CI-SECURITY-MAINTENANCE.md`
- `docs/openspec-drafts/SPEC-SERVICEADMIN-REPO-IDENTITY.md`
- `docs/openspec-drafts/SPEC-SERVICEADMIN-RESTART-DIAGNOSTICS.md`
- `docs/reference/SERVICE-TEMPLATE-REPO.md`
- `docs/reference/SERVICE-STRUCTURE-REVIEW.md`
- `docs/reference/PROPOSED-CODEBASE-STRUCTURE.md`
- `docs/reference/DECISION-CONTEXT.md`
- `docs/reference/EXAMPLE-REPO-TREE.md`
- `docs/reference/EXAMPLE-service.json`
- `docs/reference/EXAMPLE-service-harness.json`
- `docs/reference/EXAMPLE-verify.ps1`
- `docs/reference/EXAMPLE-verify.sh`

## Shared/adjacent context now copied locally
These are now available inside this folder for standalone review:
- `docs/reference/shared-runtime/QUESTION-LIST-AND-CODE-VALIDATION.md`
- `docs/reference/shared-runtime/ARCHITECTURE-DECISIONS.md`
- `docs/reference/shared-runtime/SERVICE-MANAGER-BEHAVIOR.md`
- `docs/reference/adjacent/SPEC-SERVICE-LASSO-HARNESS.md`

## Current gaps
Still needs explicit implementation-ready work for:
- deciding which starter-file fields are canonical first-pass contract versus illustrative placeholders
- normalizing the exact health schema around `process` default plus explicit `http|tcp|file|variable` overrides
- replacing the starter CI package/test flow with a real released-harness invocation once `service-lasso-harness` exists as a binary

## Current trusted-identity pre-unlock observation

Admin #640 / Core #1382 extends SPEC-SERVICEADMIN-RESTART-DIAGNOSTICS.md RD-006 through RD-010 with helper-scoped failure attribution, closed marker/request metadata, original failure preservation and listener cleanup. Admin #636 post-unlock detail readiness is delivered through #637 and owning Core #1416; its completion does not resolve the historical pre-unlock failure. Full current-head Admin gates and checksum-bound Core Windows/Linux/macOS packaged acceptance remain required for #640 diagnostic delivery.
