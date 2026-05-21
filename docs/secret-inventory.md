# Secret inventory metadata table

Issues: service-lasso/lasso-serviceadmin#39, service-lasso/lasso-serviceadmin#106

The secret inventory surface is an advanced Secrets Broker planning view for metadata/state-first ref visibility. It is intentionally not a password vault and does not resolve secret payloads.

## Current behavior

- Uses deterministic local fixture data only.
- Shows namespace/ref id, source/backend, owning service/workspace, presence state, key version, last updated, last used, expiry/rotation status, and adjacent metadata links.
- Links to provider metadata, ref usage, and audit views where applicable.
- Shows unavailable privileged operations as explanatory text, not controls.
- The Secrets Broker Secrets page also exposes a Stage 1 bulk campaign dry-run planner. Operators can select multiple metadata rows, choose a campaign operation, and generate safe per-ref/aggregate capability, policy, risk, audit, and blocker metadata.
- The bulk planner is non-mutating. Its apply button is unavailable in this stage and the generated plan contains refs, owners, providers, policy names, blockers, and expected actions only.

## Not implemented in this slice

This slice does **not** implement:

- plaintext value rendering
- raw reveal controls
- clipboard/copy value controls
- backend reads or writes
- bulk edit or bulk rotation apply operations
- provider credential access
- arbitrary password-vault/note storage behavior
- backend enforcement claims

## Future requirements before privileged workflows

Any future raw reveal or mutation workflow must be separate from this inventory table and must define:

- authenticated identity requirements
- policy decision inputs
- audit reason and audit event behavior
- timeout/cancellation behavior
- no-logging/no-export boundaries for revealed values
- tests proving values do not leak into ordinary UI, logs, diagnostics, support bundles, or table fixtures

Any future bulk apply workflow must build on the Stage 1 dry-run planner and must add fresh revalidation, audit reason capture, explicit confirmation for high-risk plans, per-ref policy enforcement, operation IDs, partial outcome reporting, and tests proving unsupported, denied, auth-required, missing-provider, stale-plan, success, and partial-failure states remain value-safe.

## Secret-safety boundary

Rows may contain refs, status, ownership, and rotation metadata. Rows must not contain bearer/access/refresh/id tokens, provider tokens, API keys, auth cookies, private keys, recovery material, passwords, raw environment values, or credential payloads.
