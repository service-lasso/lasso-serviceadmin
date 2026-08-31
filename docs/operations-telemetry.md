# Operations telemetry

Issue: service-lasso/service-lasso#635

Service Admin exposes Operations / Telemetry as a metadata-only operator surface for Service Lasso runtime and Secrets Broker telemetry status.

Current behavior:

- Core runtime status is read from `/api/telemetry`.
- Secrets Broker service telemetry status is read through the core runtime route `/api/services/@secretsbroker/telemetry`.
- The browser does not call the broker loopback endpoint directly; core remains the operator-visible API boundary.
- Rows may show service id, version/tag, artifact asset, signal kind, health/readiness, phase, outcome, trace id posture, span id posture, `traceparent` posture, and Service Lasso correlation id posture.
- Rows may show core W3C trace propagation posture and response header names. They must show whether incoming/raw header values are returned, not the values themselves.
- Cross-service rows may compare core trace propagation posture with the `@secretsbroker` service telemetry trace-context posture.
- Rows must not show OTLP endpoints, OTLP headers, auth headers, cookies, provider tokens, credentials, raw request or response bodies, query strings, raw secret values, private keys, recovery material, or environment values.

This page is a status/review surface only. It does not configure exporters and does not send telemetry.
