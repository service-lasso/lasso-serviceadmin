# ZITADEL Session Surface

ZITADEL is an optional identity provider service for Service Lasso deployments. Service Admin may display local access metadata where it helps operators understand permissions, but it does not own ZITADEL login, user administration, or session lifecycle screens.

## Ownership

- `lasso-zitadel` owns provider setup, provider health, and identity-provider session concepts.
- Consuming app facades own user-facing login and account-session workflows.
- Service Admin owns local runtime/security facts and must not render secret, cookie, bearer, or session-token values.

## Service Admin Contract

- Do not expose `/auth-session` as a Service Admin product page.
- Keep `/users` as a compatibility redirect to Security, not as a user-management or ZITADEL Sessions page.
- Generic provider names are acceptable in Security evidence when they describe role mappings, permissions, or rotation impact without taking over the provider workflow.

## Validation

Route and app-screen tests must prove that retired identity pages are not required operator screens. Security tests may continue to assert safe, metadata-only provider copy.
