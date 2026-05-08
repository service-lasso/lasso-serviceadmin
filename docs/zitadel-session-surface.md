# ZITADEL session and role surface

Issue: `service-lasso/lasso-serviceadmin#65`

Service Admin can render ZITADEL-backed session and role metadata when a consumer app/facade provides it. This surface is intentionally metadata-only.

## Dependency on consumer app/facade integration

The Service Admin UI does not authenticate directly with ZITADEL in this issue. A consumer app/facade is expected to provide safe session metadata such as:

- workspace id
- app id
- auth provider status (`zitadel` or `not-configured`)
- session mode
- metadata update time
- stable subject and organization refs
- role names
- permission decisions and denial reasons

Provider credentials, auth cookies, bearer values, raw session material, client secrets, and recovery material must not be passed into or rendered by this UI.

## Optional local development behavior

ZITADEL remains optional. Service Admin local development flows stay open unless an app explicitly enables protected mode in its facade/configuration. If ZITADEL is not configured, the UI should render a setup-needed state instead of forcing login.

## Supported states

- Signed in: active facade session metadata is available.
- Login required: ZITADEL is configured, but no active local session metadata is available.
- Setup needed: the consumer app has not configured ZITADEL integration.
- Permission denied: a session exists, but required role/permission grants are missing.

## Secret-safety requirements

Render only metadata/status/ref/role/permission text. Do not render:

- provider access material
- auth cookies
- bearer values
- raw session secrets
- ZITADEL client secrets
- recovery keys or private keys
