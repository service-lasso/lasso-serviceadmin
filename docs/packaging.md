# Packaging

Reference packaging scripts:
- `scripts/package.ps1`
- `scripts/package.sh`

Current first-pass direction:
- package the Service Admin UI/runtime payload into platform archives under
  `dist/`
- upload `service.json` as a separate release asset so the Service Lasso runtime
  can inspect the service contract independently from the deployable archive
- publish checksums for release assets where the release workflow supports them
- use the produced release assets as the thing later consumed by the shared
  harness and release-backed service package flows

Release assets:
- `@serviceadmin-win32.zip`
- `@serviceadmin-linux.tar.gz`
- `@serviceadmin-darwin.tar.gz`
- `service.json`
- `SHA256SUMS.txt`
