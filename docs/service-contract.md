# Service Contract

This starter repo demonstrates the first-pass Service Lasso service contract.

Key starter files:
- `service.json` - service manifest
- `verify/service-harness.json` - harness validation contract
- `scripts/verify.*` - thin wrappers that call the shared harness binary
- `scripts/package.*` - reference packaging entrypoints
- `runtime/` - sample payload/runtime files
- `config/` - example config inputs
- `docs/service-json-reference.md` - one-stop reference for `service.json` fields, healthcheck setup, and first-pass contract guidance

This starter is intentionally minimal. It is meant to prove the contract shape, not to be a full production service.

## Naming rule (Service Lasso)

When naming Service Lasso services:
- base/system services must use the `@` prefix in service identity naming (for example `@node`, `@python`, `@traefik`)
- do not create new base/system service names without the `@` prefix
- if a service is intended to be base/system-class, correct the name/id to the `@` form immediately and keep manifests/scripts/contracts aligned
