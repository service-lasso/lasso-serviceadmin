# Service Actions

Service actions are operator commands exposed by Service Admin.

## Typical actions

- `start`
- `stop`
- `restart`
- `reload`
- `install`
- `uninstall`
- `open_logs`
- `open_config`
- `open_admin`

## Action design rules

- label actions clearly for operators
- avoid ambiguous labels
- keep destructive actions explicit
- prefer idempotent action behavior where possible

## UI expectations

From Service Details and related pages, operators should be able to:

- run relevant actions quickly
- understand when actions are unavailable
- jump to logs/details after action execution
