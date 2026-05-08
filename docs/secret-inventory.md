# Secret inventory metadata table

Issue: service-lasso/lasso-serviceadmin#39

The secret inventory surface is an advanced Secrets Broker planning view for metadata/state-first ref visibility. It is intentionally not a password vault and does not resolve secret payloads.

## Current behavior

- Uses deterministic local fixture data only.
- Shows namespace/ref id, source/backend, owning service/workspace, presence state, key version, last updated, last used, expiry/rotation status, and adjacent metadata links.
- Links to provider metadata, ref usage, and audit views where applicable.
- Shows unavailable privileged operations as explanatory text, not controls.

## Not implemented in this slice

This slice does **not** implement:

- plaintext value rendering
- raw reveal controls
- clipboard/copy value controls
- backend reads or writes
- bulk edit or bulk rotation operations
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

## Secret-safety boundary

Rows may contain refs, status, ownership, and rotation metadata. Rows must not contain bearer/access/refresh/id tokens, provider tokens, API keys, auth cookies, private keys, recovery material, passwords, raw environment values, or credential payloads.
