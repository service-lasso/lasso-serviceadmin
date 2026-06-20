# Optional Service Admin page classification

Issue: service-lasso/lasso-serviceadmin#158

Parent feedback: service-lasso/lasso-serviceadmin#97

This classification decides which optional Service Admin pages remain in primary navigation for the current on-prem-first product shape. Deferred pages keep their direct routes and existing tests so already-built metadata surfaces do not regress, but they are not promoted in the sidebar until the owning runtime, broker, or identity contract is ready.

| Page | Decision | Current route | Navigation action | Linked implementation issue | Reason |
| --- | --- | --- | --- | --- | --- |
| ZITADEL Sessions | Defer | `/auth-session` | Hide from primary sidebar | service-lasso/lasso-serviceadmin#65 | The page is a metadata-only trusted identity preview. It should return to navigation only when a consumer app/facade provides trusted ZITADEL session and role metadata. Service Admin must stay optional-auth for local development. |
| Fleet overview | Defer | `/fleet-overview` | Hide from primary sidebar | service-lasso/lasso-serviceadmin#68; runtime prerequisite service-lasso/service-lasso#494 | The existing page is a planning surface for future multi-instance visibility. On-prem-first operation should prioritize the current local instance until runtime instance identity/registry support is available. |
| Support Bundle | Keep as embedded diagnostic action | `/support-bundle` redirects to `/secrets-broker/sources` | Hide standalone page from primary sidebar | service-lasso/lasso-serviceadmin#66 | Secret-safe local diagnostics are useful for on-prem support, but the current export is not wired to a real backend endpoint. The retained operator job is the metadata-only support-bundle review embedded in the Secrets Broker diagnostics context, with export disabled until the real redacted export API exists. |
| Policy Simulation | Keep as Audit Logging context | `/secrets-broker/policy-simulation` redirects to `/operations/audit-logging` | Hide standalone page from primary sidebar | service-lasso/lasso-serviceadmin#67; broker policy baseline service-lasso/lasso-secretsbroker#56; service-lasso/lasso-serviceadmin#125 | The policy dry-run concept is useful, but it should not appear as a complete first-class page until the broker policy contract is live. Related safe metadata belongs with Audit Logging rather than a catch-all controls page. |
| Operational Controls | Remove | `/secrets-broker/operational-controls` redirects to `/operations/audit-logging` | Remove from primary sidebar | service-lasso/lasso-serviceadmin#237 | The catch-all page mixed audit, telemetry, provider, policy, and lockout concerns. Audit/event review belongs under Operations / Audit Logging, while provider and secret actions stay on their owner pages. |

## Exact UI changes

- Removed the `Fleet Overview` sidebar item that pointed to `/fleet-overview`.
- Removed the `ZITADEL Session` sidebar item that pointed to `/auth-session`.
- Removed the standalone `Policy Simulation` sidebar item; legacy route `/secrets-broker/policy-simulation` redirects to `/operations/audit-logging`.
- Removed the `Operational Controls` sidebar item; legacy route `/secrets-broker/operational-controls` redirects to `/operations/audit-logging`.
- Removed the standalone `Support Bundle` sidebar item; legacy route `/support-bundle` redirects to `/secrets-broker/sources`, where the metadata-only support-bundle review remains embedded with export unavailable.

## Route retention

The deferred routes remain registered:

- `/auth-session`
- `/fleet-overview`
- `/support-bundle`
- `/secrets-broker/policy-simulation`

Keeping the routes as direct pages or compatibility redirects lets existing implementation tests prove the metadata-only surfaces remain safe while product navigation stays focused on current operator workflows.
