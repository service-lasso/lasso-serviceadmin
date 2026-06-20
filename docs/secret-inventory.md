# Secret inventory metadata table

Issues: service-lasso/lasso-serviceadmin#39, service-lasso/lasso-serviceadmin#106

The secret inventory surface is an advanced Secrets Broker planning view for metadata/state-first ref visibility. It is intentionally not a password vault and does not resolve secret payloads.

## Current behavior

- Uses deterministic local fixture data only.
- Shows namespace/ref id, source/backend, owning service/workspace, presence state, key version, last updated, last used, expiry/rotation status, and adjacent metadata links.
- Links to provider metadata, ref usage, and audit views where applicable.
- Shows unavailable privileged operations as explanatory text, not controls.
- The Secrets Broker Secrets page also exposes a bulk campaign workflow. Operators can select multiple metadata rows, choose a campaign operation, and generate safe per-ref/aggregate capability, policy, risk, audit, operation ID, idempotency, and blocker metadata.
- Supported rotate/reset, update/edit, policy apply/change, and provider migration/remap campaigns can apply only after audit reason, explicit confirmation, and immediate revalidation. Apply results show campaign ID, operation ID, plan token, per-item operation IDs, idempotency keys, typed outcomes, audit status, retry/recovery guidance, and skipped/denied/unsupported/auth-required rows without raw values.

## Not implemented in this slice

This slice does **not** implement:

- plaintext value rendering
- raw reveal controls
- clipboard/copy value controls
- backend reads or writes
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

Bulk policy and provider migration apply operations reuse the same dry-run, audit reason, explicit confirmation, fresh revalidation, operation ID/idempotency, partial-outcome, and redaction boundaries. Their preview/apply rows stay metadata-only and fail closed on unsupported capability, missing provider configuration, auth-required, policy-denied, stale-plan, and recovery-unavailable states.

## Secret-safety boundary

Rows may contain refs, status, ownership, and rotation metadata. Rows must not contain bearer/access/refresh/id tokens, provider tokens, API keys, auth cookies, private keys, recovery material, passwords, raw environment values, or credential payloads.
