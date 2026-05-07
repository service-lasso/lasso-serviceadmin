# Secrets Broker setup wizard

Status: first UI slice for issue #37  
Scope: Service Admin operator UI only; no live secret resolution or value reveal.

## Purpose

The setup wizard gives operators a safe, guided place to configure and test local and external Secrets Broker sources. It must help with blank installs, existing locked vaults on new machines, external-source authentication, blocked service dependencies, OpenClaw exec adapter checks, and generated secret write-back review.

## First slice

The first implementation is a static/stubbed UI contract that can be wired to live broker APIs later. It must:

- expose local encrypted vault, file source, exec adapter, and external manager setup paths;
- show safe copyable examples without resolved secret values;
- provide test-result states for ready, locked, auth required, degraded, policy denied, and write-back review;
- show affected refs/services before prompting for auth or unlock repair;
- warn on risky file/exec settings;
- require explicit confirmation/audit reason for destructive or broad actions in later live flows.

## Security rules

- Never render resolved secret values in setup tests.
- Mask example values and use `SecretRef`/namespace examples instead of plaintext.
- Treat raw reveal and bulk operations as separate privileged workflows.
- Show policy decisions and audit links without logging values.
- Prefer least-privilege examples for OpenClaw namespaces and file paths.

## Validation expectations

Tests should cover the operator-visible contract rather than live secrets:

- happy path ready state;
- failed source test/degraded state;
- risky exec or file configuration warning;
- cancel/safe no-op behavior;
- locked vault/new-machine import state;
- external auth-required state;
- policy-denied state;
- no plaintext secret values in rendered examples.
