# Release 1 Admin product decisions

This record defines the Admin surfaces shipped for the Service Lasso Release 1 local-store product.

## Decisions

| Area | Release 1 decision | Enforced surface |
| --- | --- | --- |
| Fleet | Retired | No navigation or command-menu entry is shipped. |
| Sessions | Retired | No navigation or command-menu entry is shipped. ZITADEL owns identity sessions. |
| Policy Simulation | Replaced | Security → Secret access lists live `broker.accessPolicy` grants (service id, namespace, refs, operations, purpose) plus missing Core audit assignments. `/secrets-broker/policy-simulation` redirects there. |
| Support Bundle | Hidden | No GA navigation or command-menu entry is shipped. Diagnostic bundle capability remains outside the GA surface until released-artifact evidence exists. |

## Release 1 security assignment contract

The Security page presents a read-only view of actual runtime evidence:

- service id, namespace, refs, operations, and purpose from `broker.accessPolicy`;
- missing or malformed import assignments from Core `GET /api/secrets/audit`;
- empty and unavailable states when no grants exist or the runtime cannot be read.

The page must fail visibly when the runtime evidence is unavailable. It must not turn a fixture, prediction, or proposed assignment into an enforcement claim. Leftover `/secrets-broker/policy-simulation` must redirect to this inspector.

## Validation

`src/test/release-surface.test.ts` prevents retired or hidden decisions from reappearing in the shipped navigation. `src/test/app-screens.test.tsx` verifies that the Security page has no Policy Simulation control and renders the actual service manifest assignment result.

Cross-platform GA validation remains bound to the final downloaded Core, Broker, Admin, and npm artifacts. Source tests alone do not change a capability ledger row to validated.
