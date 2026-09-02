# SPEC-TRUSTED-INGRESS-PROXY

## Intent

Harden the packaged Service Admin runtime proxy so it is the loopback-only
browser-to-Core ingress for Core `SPEC-002` `AC-4BX` (Admin #566, Core #1025).
Direct-port callers cannot mint trusted identity or remote local-root. Protected
Traefik identity reaches Core only as canonical Service Lasso headers. Missing
or malformed ingress context fails closed.

## Binding

- Core `SPEC-002` `AC-4BX`
- Core issue `service-lasso/service-lasso#1025` (Core residual CLOSED)
- Admin issue `service-lasso/lasso-serviceadmin#566`

## Scope

- Packaged `runtime/server.js` proxy for `/api/*`.
- Strip browser-supplied canonical identity, forwarded-client, authorization,
  and cookie headers on untrusted direct-port requests.
- Accept Traefik `X-Service-Lasso-User`, `Workspace`, `Roles`, and `Actor` only
  from the loopback-bound protected ingress path.
- Forward canonical user, workspace, roles, actor, original-client, and the
  exact trusted-ingress marker Core consumes.
- Preserve local loopback as `local-root` without manufacturing remote identity.
- Keep credentials out of browser responses, logs, tests, and evidence.

## Out of scope

- Core request-policy, Traefik generation, or Broker product changes.
- Leftover Admin PRs targeting the promotion branch.
- Release 1.0 / GA publication.

## Acceptance Criteria

- `TIP-001`: Untrusted direct-port requests never forward identity,
  forwarded-client, authorization, or cookie headers to Core.
- `TIP-002`: A complete Traefik ingress set (user plus original client address,
  with optional agreeing actor/workspace/roles) is forwarded as canonical Core
  headers plus `x-service-lasso-trusted-ingress: serviceadmin-loopback`.
- `TIP-003`: Missing or malformed Traefik ingress context fails closed at Admin
  and does not reach Core as local-root or trusted identity.
- `TIP-004`: Direct-port spoofed canonical headers (`zitadel-user-id`,
  `trusted-ingress`, `client-address`, internal proxy markers) are discarded
  and do not become trusted identity.
- `TIP-005`: Loopback with no Traefik identity remains local-root (proxy markers
  only; no manufactured remote actor or original-client header).
- `TIP-006`: Proxy responses, logs, and tests contain no credentials, cookies,
  bearer tokens, or session material.

## Tests and Evidence

- Runtime proxy tests for spoofed direct-port headers, complete Traefik
  forwarding, fail-closed incomplete context, loopback local-root, and
  credential-safe responses.
- `pnpm test:runtime` targeted packaged-proxy tests.

## Documentation Impact

- This spec.
- Admin issue #566 spec binding.
