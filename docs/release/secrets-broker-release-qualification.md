# Secrets Broker Release Qualification

Issue: service-lasso/lasso-serviceadmin#428

This release gate verifies the real Service Admin, Service Lasso runtime, and
Secrets Broker process chain before a Secrets Broker management release can be
qualified. Browser fixture mode and mock-only client tests are not sufficient
release evidence.

The release candidate must be built from the active `develop` lineage. Each OS
artifact is extracted and its real `runtime/server.js` is launched against a
bounded runtime API before publication. The runtime binds only to loopback,
strips browser credentials, and forwards only normalized identity supplied by
the protected Service Lasso ingress.

## Artifact Rule

Qualification runs must use one of:

- packaged release artifact
- exact release candidate

Runs must record all version points:

- expected version
- catalog version
- installed version
- live runtime version

## Platform Rule

Required transports:

- Windows named pipe
- Linux Unix socket

Loopback development transport is compatibility-only evidence and cannot replace
either required transport.

## Journey Rule

The executable contract is defined in
`src/lib/service-lasso-dashboard/secrets-release-qualification.ts`.

The matrix covers:

- fresh setup and existing-vault restart
- ready, locked, setup-needed, auth-required, denied, degraded, and unavailable states
- inventory search, filter, and pagination
- reveal with expiry
- create, edit, reset, rotate, policy, and delete/decommission
- provider validate, configure, and reconnect
- migration and bulk campaign
- audit, telemetry, events, and lockout
- backup, key rotation, and restore
- topology and startup impact

Durable mutation journeys require restart proof. Every value-bearing or
security-sensitive journey requires audit proof and no-leak sentinels.

### Fresh setup contract

Service Admin must consume only `service-lasso.setup-status.v1` from
`GET /api/setup/status` and initialize the broker with
`POST /api/setup/bootstrap`. The shell remains locked until the runtime reports
that setup mode is off and the broker vault is ready.

The browser may render setup state, broker readiness, the safe OS operator
name, trust-policy flags, blockers, and the number of provisioned declarations.
It must never receive or render a vault path, master key, broker token, signing
key, credential, or secret value. A remote setup token is transient request
input: do not persist it and clear it after success or failure.

The obsolete generated-key reveal, copy, download, print, and acknowledgement
flow is not part of the production contract.

## Executable packaged-browser gate

`pnpm test:secrets:real-browser` launches a real packaged Service Admin, a
built Service Lasso Core candidate, and a built Secrets Broker candidate in an
isolated workspace. It then runs the Cypress lifecycle journey without fixture
mode. The required inputs are:

- `SERVICE_LASSO_TEST_CORE_ROOT`: Core checkout with a current `dist/` build
- `SERVICE_LASSO_TEST_BROKER_BINARY`: exact Broker candidate executable
- optional `SERVICE_LASSO_TEST_ADMIN_ROOT`: extracted Admin candidate; otherwise
  `output/package/@serviceadmin-<platform>` is used

The comprehensive journey uses the production Core vault-enrollment and scoped
generated-secret writeback paths before opening the browser. It then proves
authenticated runtime identity, inventory search/filter/page
controls, edit/reset dry-run and apply, policy capability preview, bounded
reveal and clear, Core-orchestrated linked-consumer rotation, decommission,
reload-persistent tombstone restore, encrypted backup create/verify/restore,
master-key rotation followed by a fresh verified backup, and live provider
validation. It also launches a bounded loopback Vault KV v2 target and proves
both single-ref migration and a durable, revalidated, high-risk-confirmed bulk
campaign through real Broker write plus independent read-back verification.
Separate real Vault targets return HTTP 403 and HTTP 503 so the same browser
journey proves policy-denied and unavailable remote writes remain unapplied,
retain the local source as authoritative, and render destructive recovery
guidance instead of success styling.
The authenticated operations card reads live low-cardinality telemetry, verifies
the Broker's no-value safety contract, filters bounded metadata-only events,
traverses the next/previous cursor boundary after the event set exceeds one
page, and performs an exact confirmed lockout-clear check with an audit reason. The
check deliberately uses an inactive scope and proves the safe `not_found`
outcome is audited and immediately visible as a `lockout_cleared` event.
`pnpm test:secrets:real-lockout-browser` complements that comprehensive journey
by driving three invalid token requests against the real Windows named pipe,
observing the active low-cardinality lockout in telemetry, clearing the exact
scoped lockout in Service Admin with confirmation and an audit reason, and
verifying both the zero counter and durable `lockout_cleared` event.
`pnpm test:secrets:real-first-run-browser` starts from an unenrolled workspace,
verifies the visible setup-required UI, submits the protected production
bootstrap, observes the setup-complete and trusted-identity transition, proves
declared generated-secret provisioning, and starts the linked consumer without
exposing value or key material.
The UI separately renders real `source_auth_required` and `invalid_ref`
provider states, then stops the Broker through Core, renders the unavailable
management state with an explicit retry, restarts the Broker, and recovers the
inventory without reloading Core. Linked rotation must prove that Core derived
the consumer action from its manifest, committed the durable rotation
operation, restarted the initially running consumer, and cleared the candidate
value from browser state. Direct Broker rotation is not acceptable for a linked
secret.

If a transient Broker inventory request fails, the UI exposes an explicit
`Retry inventory` control; the real-browser gate exercises that recovery path
instead of requiring a page/process restart. Screenshots and video are disabled
because a controlled reveal is part of the journey.

After the browser closes, the runner reads the Broker audit JSONL from the
isolated workspace before teardown. It bounds event count/bytes and field names,
rejects candidate values and audit reasons, recomputes every `sha256:` event
hash from the persisted metadata, verifies the chain from `genesis`, and
requires lifecycle operations for rotation, create/edit/reset, policy preview,
reveal, decommission, restore, backup, key rotation, provider validation,
provider migration, bulk campaign create/revalidate/apply, and the audited
lockout-clear operation. The final result
emits only revision, binary digest, artifact name, and audit-event count, then
requires exact process and temporary-workspace cleanup.

The latest local Windows candidate evidence (2026-08-15) passed the 1/1
comprehensive packaged Cypress journey in 9m51s with 104 chained audit events,
the 1/1 active-lockout journey in 48s with 29 chained audit events, and the 1/1
first-run journey in 59s with 18 chained audit events. All three runs produced
zero screenshots/video and exact isolated-process/workspace
cleanup. The candidate Broker SHA-256 was
`47052a2acebda41dd9ab67090fdc1a5adba86de4a203d271ef911afe8e016a32`.
The verified Admin Windows ZIP SHA-256 was
`9a293ff0317d40315d57e39be97f588126782c5c28882dfebdd10a977bb32312`.
This is strong local release evidence, not permission to claim a published or
cross-platform release.

`.github/workflows/real-secrets-broker.yml` runs the same gate on Windows,
Ubuntu, and Apple Silicon macOS. It checks out Core from `develop` and Secrets
Broker from its release lineage on `main`, records both exact revisions, builds
both from source, packages the Admin candidate on the target OS, verifies the
extracted artifact, and then runs the real browser journey. This is the
release-blocking subset; capabilities that remain fail-closed (provider
configuration persistence and non-registered migration targets) are never
reported as successful.

The current packaged browser journeys cover a locked portable vault and an
active Windows named-pipe lockout, and fresh first-run enrollment, but do not
yet claim real-browser coverage
for timed lockout expiry. Expiry remains covered by Broker contract tests and
must not be called browser-qualified until an isolated real-process scenario is
added. The comprehensive release fixture deliberately pre-enrolls through
production Core APIs so setup timing cannot obscure the later management
matrix; the separate first-run gate owns that exact enrollment evidence. Hosted
Windows, Ubuntu, and Apple Silicon runs on exact published commits, the real
alternate-Windows-principal named-pipe denial, and final release artifact/pin
verification remain go-live gates.
