# Secrets Broker contract consumption

Service Admin must treat Secrets Broker as a versioned external service. The
shared client in `src/lib/secrets-broker/client.ts` is the only production query
layer for Broker-backed pages; UI components must not infer fields or fall back
to fixtures when a live response is unavailable.

## Canonical overview reads

The client reads each concern independently through the Service Lasso runtime
proxy:

| Concern | Broker route | Required for overview |
| --- | --- | --- |
| Process status | `GET /status` | Yes |
| Typed readiness/outcome | `GET /state` | Yes |
| Contract version and advertised operations | `GET /capabilities` | Yes |
| Source lifecycle and capability arrays | `GET /v1/sources/status` | Yes |
| Provider support and limitations | `GET /v1/providers/capabilities` | No |
| Configured provider state | `GET /v1/providers/config/status` | No |
| Redacted telemetry | `GET /v1/telemetry` | No |
| Metadata-only audit/operational events | `GET /v1/events?limit=1` | No |

A missing required route produces an explicit `unsupported`, `denied`, or
`unavailable` state. Optional route failures disable only the affected UI
capability and remain visible in `overview.routes`.

## Compatibility policy

Service Admin supports Secrets Broker contract versions `>=1.0.0 <2.0.0`.
Additive `1.x` releases remain compatible. A missing or malformed version, an
older major version, or a newer major version fails closed: Broker diagnostics
and raw advertised capability names remain visible, but all Broker-backed UI
actions, telemetry, and audit availability are disabled.

The compatibility result includes a deterministic recovery direction:

- Upgrade Secrets Broker when its contract is older than the supported range.
- Repair or upgrade Secrets Broker when its version is missing or malformed.
- Upgrade Service Admin before using a Broker on a newer contract major.

For a planned major upgrade, deploy a Service Admin release that accepts the
new Broker contract before upgrading Secrets Broker. This keeps administrative
actions unavailable rather than allowing an older UI to guess at changed
semantics.

## Mapping rules

- Source identity comes from `sourceId`, `kind`, and `displayName`.
- The exact Broker `lifecycle.state`, `outcome`, `nextAction`, namespaces, and
  capability strings remain available on each normalised source.
- Contract `1.1.x` and later must include a compatible operation manifest.
  Missing, malformed, or unsupported manifests fail closed.
- UI action gates are exact intersections between the global operation record
  and the selected ready source/connection record. A mutation requires maturity
  `executable` or `validated` on both records.
- `dry-run`, `planned`, `unavailable`, malformed, and unknown operation maturity
  never enable apply. Unknown values remain visible for diagnostics.
- Contract `1.0.x` retains the legacy endpoint/capability intersection during
  the compatible transition window; newer contracts never fall back to it.
- Legacy endpoint and capability-name arrays remain diagnostic data and cannot
  override a connection-scoped operation record.
- Provider limitations are data, not prose inferred by the UI.
- Audit is available only when the events response is metadata-only and contains
  no value material.
- Telemetry and audit are never inferred from source status.

## Consumer conformance

`src/lib/secrets-broker/fixtures/contract-states.json` is pinned from Broker
contract version `1.0.0`. Its adjacent README records the upstream commit and
SHA-256 checksums. Tests use canonical fixture responses for state, lifecycle,
and event safety. Update the fixture, provenance, client mapping, and tests in
one change whenever the Broker contract changes.

Deterministic fixture data remains available only when
`VITE_SERVICE_LASSO_ENABLE_STUB_DATA=true`; it is not a production or default
fallback.
