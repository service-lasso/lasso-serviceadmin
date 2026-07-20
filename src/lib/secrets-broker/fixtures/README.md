# Secrets Broker contract fixtures

`contract-states.json` is a pinned consumer fixture from
`service-lasso/lasso-secretsbroker` contract version `1.1.0` and operation
manifest version `1.0.0`.

- Upstream path: `conformance/fixtures/contract-states.json`
- Upstream issue: `service-lasso/lasso-secretsbroker#133`
- Upstream commit: `3f0bc3207ece9d51a089aac64b699df3ca120cd1`
- Fixture SHA-256: `2bb6332b131cd3f867ef6f0d8f31d00c630857bfa25fe383aa89fc5796e2bcef`
- OpenAPI SHA-256: `b73dccaded02a198b8e56bf97dae05b58d2af7ff2e8cd088f8d5008498cf6efb`

Tests must use these canonical response bodies instead of inventing aggregate
Broker payloads. When the Broker contract changes, update this fixture and the
recorded hashes together, then run the Service Admin unit and build checks.
