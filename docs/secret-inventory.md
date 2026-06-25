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
- Single-secret apply results include post-apply impact evidence: dependent service refs, audit/rollback/recovery refs, fresh-preview requirements, and omitted unsafe fields. Delete/decommission and policy assignment evidence is metadata-only and never includes current values, request/response bodies, provider credentials, cookies, tokens, private keys, recovery material, or raw environment values.
- Single-secret cancellation is recorded as metadata-only operator intent: operation id, ref, action, audit/correlation refs, and fresh-preview recovery guidance. Cancellation evidence never submits a mutation and never stores request/response bodies or secret material.
- Controlled reveal previews include a challenge lifecycle model for pending, authorized, expired, revoked, denied, and audit-unavailable states. Lifecycle evidence records challenge/session refs, expiry, revocation, actor/audit/correlation refs, omitted unsafe fields, and next action guidance only; revealed values stay broker-controlled and hidden from the management table.
- Edit/update previews now show metadata-only change evidence before any submit: operation id, patch plan hash, schema validation status, conflict check ref, rollback ref, dependent consumers, immutable fields, omitted unsafe fields, and safe diff rows. The preview never accepts spreadsheet-style plaintext values and never renders request/response bodies or provider credential material.
- Reset/rotate previews now show metadata-only rotation safety evidence before any submit: operation id, rotation plan ref, idempotency/retry refs, dependent service restart/reload refs, provider capability checks, audit event refs, omitted unsafe fields, and fail-closed blockers. Rotation does not require controlled reveal and never renders generated replacement values.
- Single-secret post-operation support evidence bundles are metadata-only: operation ids, refs, typed outcomes, audit/correlation refs, dependent service refs, screenshot redaction status, diagnostics refs, and storage checks. Reports, screenshots, diagnostics, support bundles, local storage, and session storage omit raw values, request/response bodies, provider credentials, tokens, cookies, private keys, recovery material, and environment values.
- Single-secret operation history review is metadata-only: operators can filter submitted stub operation evidence by action, typed outcome, and safe text refs. History review search is limited to operation ids, refs, row names, provider/owner metadata, audit/correlation refs, policy refs, and next-action text; it does not search raw values, request/response bodies, provider credentials, tokens, cookies, private keys, recovery material, environment values, screenshots, or diagnostics payloads.
- Single-secret and bulk campaign audit reason fields reject secret-like pasted material before it can gate preview, revalidation, or apply. Audit reasons must describe operator intent only; token, credential, cookie, private-key, raw-value, request/response body, provider credential, recovery material, and environment-value text is not retained in the field or modeled as accepted audit metadata.

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
