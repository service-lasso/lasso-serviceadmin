---
title: UI capture manifest and refresh guide
description: Reproduce and assess Service Admin documentation captures.
status: metadata-only
tags: documentation, screenshots, maintenance
---

# UI capture manifest and refresh guide

| Capture | Route/state | Reproduction and identity | Result |
| --- | --- | --- | --- |
| `assets/ui-captures/dashboard-live.png` | `/`, live task-owned proxy | Core `3307d61787918d6d6dd195facfb808e2c2c0c9a9`; Admin `5823f1b`; 1440×1024; 2026-09-14 | **Blocked:** headless page was blank after load; do not publish as evidence |
| `assets/ui-captures/services-live.png` | `/services`, live task-owned proxy | same environment | **Blocked:** headless page was blank after load |
| `assets/ui-captures/help-center-live.png` | `/help-center`, live task-owned proxy | same environment | **Blocked:** headless page was blank after load |

The task-owned Core proof allocated runtime `http://127.0.0.1:18100` and Admin
`http://127.0.0.1:18101/`. It reached a running runtime, but the canonical gate
reported `canonical_service_state_mismatch` because `node-sample-service` was
running although the accepted source-admin proof contract expects it to remain
manifest-only. No credentials, secret values or raw logs were captured.

## Refresh procedure

1. Create an issue worktree from `develop` in Core and Admin.
2. Run Core `npm ci`, then `npm run demo:worktree-proof -- --id=<issue>`.
3. Start the Admin source UI on the allocated Admin port with
   `SERVICE_LASSO_RUNTIME_PROXY_TARGET` set to the allocated Core URL.
4. Use the generated summary’s `gate` and `verify` commands. Stop on a non-zero
   result and record its classification; do not alter the product to improve a
   capture.
5. Use a real browser with a consistent 1440×1024 viewport, default theme and
   non-sensitive sample data. Capture overview plus relevant dialogs/states.
6. Preserve originals, add a row above for every asset, then review legibility,
   route/state, reproduction, date, viewport and exact Core/Admin identity.

The files presently named in this manifest are retained as failed-capture
receipts only and must be replaced by verified visible browser captures before
they are linked from a user guide.
