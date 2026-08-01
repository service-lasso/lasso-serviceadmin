# Secrets Broker Release Qualification

Issue: service-lasso/lasso-serviceadmin#428

This release gate verifies the real Service Admin, Service Lasso runtime, and
Secrets Broker process chain before a Secrets Broker management release can be
qualified. Browser fixture mode and mock-only client tests are not sufficient
release evidence.

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
