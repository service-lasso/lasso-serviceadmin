# Optional Service Admin page classification

Issue: service-lasso/lasso-serviceadmin#107

Parent feedback: service-lasso/lasso-serviceadmin#97

This classification decides which optional Service Admin pages remain in primary navigation for the current on-prem-first product shape. Deferred pages keep their direct routes and existing tests so already-built metadata surfaces do not regress, but they are not promoted in the sidebar until the owning runtime, broker, or identity contract is ready.

| Page | Decision | Current route | Navigation action | Linked implementation issue | Reason |
| --- | --- | --- | --- | --- | --- |
| ZITADEL Sessions | Defer | `/auth-session` | Hide from primary sidebar | service-lasso/lasso-serviceadmin#65 | The page is a metadata-only trusted identity preview. It should return to navigation only when a consumer app/facade provides trusted ZITADEL session and role metadata. Service Admin must stay optional-auth for local development. |
| Fleet overview | Defer | `/fleet-overview` | Hide from primary sidebar | service-lasso/lasso-serviceadmin#68; runtime prerequisite service-lasso/service-lasso#494 | The existing page is a planning surface for future multi-instance visibility. On-prem-first operation should prioritize the current local instance until runtime instance identity/registry support is available. |
| Support Bundle | Keep now | `/support-bundle` | Keep visible under Operations | service-lasso/lasso-serviceadmin#66 | Secret-safe local diagnostics are useful for on-prem support and do not require fleet, hosted support, ZITADEL, or external broker credentials. |
| Policy Simulation | Defer | `/secrets-policy-simulation` | Hide from primary sidebar | service-lasso/lasso-serviceadmin#67; broker policy baseline service-lasso/lasso-secretsbroker#56 | The existing page is a metadata-only dry-run preview. It should return to navigation after the Service Lasso service policy assignment and broker-backed policy-evaluation contract are explicit enough for operators to trust the result. |

## Exact UI changes

- Removed the `Fleet Overview` sidebar item that pointed to `/fleet-overview`.
- Removed the `ZITADEL Session` sidebar item that pointed to `/auth-session`.
- Removed the `Policy Simulation` sidebar item that pointed to `/secrets-policy-simulation`.
- Kept the `Support Bundle` sidebar item pointing to `/support-bundle`.

## Route retention

The deferred routes remain registered:

- `/auth-session`
- `/fleet-overview`
- `/secrets-policy-simulation`

Keeping the routes lets existing implementation tests prove the metadata-only surfaces remain safe while product navigation stays focused on current operator workflows.
