# Secret-safe support bundle export

Issue: service-lasso/lasso-serviceadmin#66

The Service Admin support bundle surface provides a local diagnostics preview and export payload for support triage. It is intentionally secret-safe by default.

## Included diagnostics

The bundle preview and payload include:

- service inventory: service id, version/source ref, and lifecycle state
- runtime and health summaries: check ids, health status, and diagnostic refs
- Secrets Broker source statuses: provider refs, lifecycle state, and safe error codes
- selected recent error/log excerpts after line-level redaction
- a redaction report with counts and source refs only
- a machine-readable manifest containing generated timestamp, section list, and redaction policy

## Excluded or redacted material

The bundle must not include raw values for:

- secret values
- provider tokens
- API keys
- auth cookies
- private keys
- recovery material
- passwords
- unredacted environment values
- raw ZITADEL/OIDC bearer, access, refresh, or id tokens
- raw session/client secret material

The UI uses policy text and redacted placeholders such as `[REDACTED_SECRET]` and `[REDACTED_AUTHORIZATION]`; placeholders are not credential material.

## Operator workflow

1. Open **Support Bundle** in Service Admin.
2. Review the warning and included section preview.
3. Inspect the manifest and redaction policy.
4. Prepare the export payload for local review.
5. Share only after operator review in the support workflow.

No upload is performed by this UI.

## Local development

This is a local diagnostics surface. It does not require a remote support backend, ZITADEL protected mode, or Secrets Broker provider credentials to render in local development.
