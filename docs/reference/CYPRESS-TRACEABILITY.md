# Cypress Traceability

Repo: `lasso-@serviceadmin`
Spec: `docs/openspec-drafts/SPEC-UI-ADMIN-SERVICE.md`

## Purpose

Record the current mapping from UI OpenSpec requirements/sections to executable Cypress coverage.

## Acceptance criteria mapping

| Spec item | Meaning | Cypress coverage |
| --- | --- | --- |
| AC-UI-001 | optional operator UI, not privileged core | `cypress/e2e/ui-spec-traceability.cy.js` → `AC-UI-001 and section 1...` |
| AC-UI-002 | UI consumes runtime/API/state over HTTP | `cypress/e2e/ui-spec-traceability.cy.js` → `AC-UI-002 and section 2...`; `cypress/e2e/api-contract.cy.js` |
| AC-UI-003 | operator route/navigation model exists | `cypress/e2e/ui-spec-traceability.cy.js` → `AC-UI-003 and section 3...`; `cypress/e2e/ui-routes.cy.js` |
| AC-UI-004 | minimum dashboard surface | `cypress/e2e/ui-spec-traceability.cy.js` → `AC-UI-004 and section 4...`; `cypress/e2e/ui-routes.cy.js` |
| AC-UI-005 | minimum service-detail surface | `cypress/e2e/ui-spec-traceability.cy.js` → `AC-UI-005 and section 5...`; `cypress/e2e/ui-routes.cy.js` |
| AC-UI-006 | named service actions with feedback | `cypress/e2e/ui-spec-traceability.cy.js` → `AC-UI-006 and section 6...`; `cypress/e2e/ui-actions.cy.js` |
| AC-UI-007 | logs/state/network/installed/runtime surfacing | `cypress/e2e/ui-spec-traceability.cy.js` → `AC-UI-007 and section 7...`; `cypress/e2e/ui-routes.cy.js` |
| AC-UI-008 | API-driven, not donor-inline implementation | `cypress/e2e/ui-spec-traceability.cy.js` → `AC-UI-008, AC-UI-009, and section 9...`; `cypress/e2e/api-contract.cy.js` |
| AC-UI-009 | open questions are explicitly recorded | `cypress/e2e/ui-spec-traceability.cy.js` → `AC-UI-008, AC-UI-009, and section 9...` |

## Section mapping

| Spec section | Cypress coverage |
| --- | --- |
| 1. UI role | `ui-spec-traceability.cy.js` section 1 test |
| 2. API-driven relationship to core | `ui-spec-traceability.cy.js` section 2 test; `api-contract.cy.js` |
| 3. High-level route/navigation direction | `ui-spec-traceability.cy.js` section 3 test; `ui-routes.cy.js` |
| 4. Minimum dashboard contract | `ui-spec-traceability.cy.js` section 4 test |
| 5. Minimum service-detail contract | `ui-spec-traceability.cy.js` section 5 test |
| 6. Minimum action surface | `ui-spec-traceability.cy.js` section 6 test; `ui-actions.cy.js` |
| 7. Logs / state / network / installed views | `ui-spec-traceability.cy.js` section 7 test; `ui-routes.cy.js` |
| 8. Dependency visualization direction | `ui-spec-traceability.cy.js` section 8 test |
| 9. Base/adaptation direction | `ui-spec-traceability.cy.js` section 9 test |

## Current note

This gives the repo explicit spec-to-test traceability for the current UI draft. It does not mean every future implementation detail is frozen; it means each current spec item now has an intentional test anchor instead of only broad route smoke coverage.
