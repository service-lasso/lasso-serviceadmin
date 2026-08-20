# Multi-instance and fleet overview planning

Issue: service-lasso/lasso-serviceadmin#68

The fleet overview surface is a bounded planning/metadata UI for future Service Lasso multi-instance visibility. The current implementation is intentionally local-only.

## Current behavior

- Shows the current local Service Admin instance.
- Shows future remote instance placeholders so the UI/data model does not assume exactly one instance forever.
- Renders metadata only: instance id/name, local/remote marker, health, version, services count, broker state, last check, discovery ref, registration state, and security boundary.
- Documents discovery assumptions and security boundaries in the UI.

## Not implemented in this slice

This slice does **not** implement:

- remote control
- remote restart/deploy actions
- cross-instance Secrets Broker reads/writes/rotations
- raw secret reveal
- remote log access
- credential storage
- automatic LAN/cloud discovery
- trust establishment or registration workflow

## Future assumptions

Future remote registration should require:

- explicit operator action
- authenticated instance identity
- stable instance refs
- per-instance policy decisions
- audit reasons for any privileged action
- clear separation between metadata visibility and control-plane actions

## Secret-safety boundary

Fleet overview rows must not contain raw secrets, provider tokens, API keys, auth cookies, private keys, recovery material, passwords, raw environment values, or credential payloads. Placeholder remote rows should describe planned metadata fields only.
