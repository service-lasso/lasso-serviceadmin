# Health Checks

Health checks determine how Service Lasso reports runtime health.

## Common health models

Typical checks include:

- HTTP endpoint checks
- TCP port checks
- file-based checks
- process/runtime checks

## Recommended baseline

For most services:

1. one fast liveness check
2. one readiness check for critical dependencies

## Health states

Service health should map to clear operator states:

- `healthy`
- `warning`
- `critical`

## Operator expectations

When checks fail, Runtime should make it obvious:

- what failed
- when it failed
- what service is affected
