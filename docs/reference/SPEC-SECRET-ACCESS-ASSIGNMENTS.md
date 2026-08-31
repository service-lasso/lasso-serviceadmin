# SPEC-SECRET-ACCESS-ASSIGNMENTS

## Intent

Replace leftover Policy Simulation with a metadata-only inspector of live
`broker.accessPolicy` assignments so operators can see which service may use
which broker namespace/ref and operation.

## Scope

- Read grants from live `service.json` documents (`GET /api/services/:id/config`).
- Read missing import assignment from Core `GET /api/secrets/audit`.
- Bind field names to Core `docs/reference/service-secret-access-policy.md`.
- Keep `/secrets-broker/policy-simulation` as a redirect onto Security Secret access.

## Out of scope

- Vault policy language or scenario playgrounds.
- Operational controls, lockout, telemetry, or audit-event consoles (#118).
- Rendering secret values, tokens, or recovery material.

## Acceptance Criteria

- Leftover Policy Simulation playground is unreachable.
- The inspector lists service id, namespace, refs, operations, and purpose.
- Empty and unavailable states are explicit.
- Missing assignment is visible as metadata, not a fixture outcome dropdown.

## Tests and Evidence

- Parser tests against metadata-only fixtures.
- Security page tests for assigned/missing copy and no Policy Simulation control.
- Redirect test for `/secrets-broker/policy-simulation`.
- `npm test` and `npm run build`.

## Documentation Impact

- `docs/help/security-secret-access-assignments.md`
- `docs/release/release-1-product-decisions.md`

## Verification

Open Security → Secret access against a runtime with declared
`broker.accessPolicy` grants. Confirm purpose and operations render, missing
imports show as Missing, and no secret values appear.
