# Release 1 Admin product decisions

This record defines the Admin surfaces shipped for the Service Lasso Release 1 local-store product.

## Decisions

| Area | Release 1 decision | Enforced surface |
| --- | --- | --- |
| Fleet | Retired | No navigation or command-menu entry is shipped. |
| Sessions | Retired | No navigation or command-menu entry is shipped. ZITADEL owns identity sessions. |
| Policy Simulation | Replaced | The Security page reads `GET /api/secrets/audit` and renders the service manifest secret-access assignments enforced by Core. It does not offer a simulation control. |
| Support Bundle | Hidden | No GA navigation or command-menu entry is shipped. Diagnostic bundle capability remains outside the GA surface until released-artifact evidence exists. |

## Release 1 security assignment contract

The Security page presents a read-only view of actual runtime evidence:

- service identifier and manifest path;
- declared Broker import assignments;
- assignment status: allowed, missing, or malformed;
- the Core audit endpoint and observation time.

The page must fail visibly when the runtime evidence is unavailable. It must not turn a fixture, prediction, or proposed assignment into an enforcement claim.

## Validation

`src/test/release-surface.test.ts` prevents retired or hidden decisions from reappearing in the shipped navigation. `src/test/app-screens.test.tsx` verifies that the Security page has no Policy Simulation control and renders the actual service manifest assignment result.

Cross-platform GA validation remains bound to the final downloaded Core, Broker, Admin, and npm artifacts. Source tests alone do not change a capability ledger row to validated.
