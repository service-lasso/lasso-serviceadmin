# Broker WebDAV usage (#691)

Open **Secrets Broker → RAM files** (`/secrets-broker/webdav`). The same panel
is in the Broker service's Secrets tab. It presents metadata-only RAM
file inventory: availability, active grants, file count, RAM usage, filenames,
workspace/service owner, size, completed downloads, bytes served and last access.
Poll every 30 seconds or refresh manually. Pages hold at most 100 files; filter
and sort the current page. Refresh starts at the first page because grants may
change between observations.

Only workspace-read operators may load inventory. Loading, denied permission,
error, stopped listener and empty grants are distinct states. Never display
tokens, capability URLs or values. Counters reset on rotation/revocation/restart.
Completed server writes do not prove a client saved or used data.

Verify runtime contract rejection and UI state/filter/refresh behavior.

Verification: positive and negative contract/UI tests passed, including denied
permission, rejected authentication, unsafe responses, loading, empty/stopped,
error, search, refresh and pagination. Chromium desktop/mobile fixture checks
passed with screenshot inspection; production build/type checking passed.
Fixture metadata is available only in demo mode. Live failures never fall back
to demo data. Matching Core/Broker source builds passed native Ubuntu Echo
consumption/accounting; this does not claim installed package deployment.
