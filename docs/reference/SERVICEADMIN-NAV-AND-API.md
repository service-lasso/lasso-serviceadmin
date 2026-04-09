# Service Lasso - `lasso-@serviceadmin` Navigation and API Plan

_Status: working draft_

Important reconciliation note:
- this file is UI/admin planning, not core product law
- use `QUESTION-LIST-AND-CODE-VALIDATION.md` and `ARCHITECTURE-DECISIONS.md` first for settled answers about UI/core boundary and action-model limits

Purpose:

- document the proposed sidebar/navigation structure for `lasso-@serviceadmin`
- document the API endpoints the new admin UI will need from Service Lasso
- make the UI-to-API relationship explicit while the architecture is still forming

Related docs:

- `SHADCN-ADMIN-MAP.md`
- `SHADCN-ADMIN-REVIEW.md`
- `UI-STATE-REVIEW.md`
- `ARCHITECTURE.md`
- `ARCHITECTURE-DECISIONS.md`

---

## 1. Navigation Philosophy

`lasso-@serviceadmin` should be an operator/admin UI.

That means the navigation should reflect operator tasks rather than generic demo-dashboard sections.

Main goals:
- quickly see system state
- quickly find a service
- inspect runtime/install state
- trigger actions
- inspect dependencies, logs, ports, and URLs

---

## 2. Proposed Sidebar Navigation

Recommended main sidebar sections:

### 1. Dashboard
Purpose:
- overall system landing page
- high-level runtime state and quick actions

Contents:
- runtime health summary
- service counts (running/stopped/error/installing)
- quick links to problem services
- quick actions (start all / stop all / reload)

### 2. Services
Purpose:
- main operational list of all services

Contents:
- searchable/filterable services table/cards
- per-service status
- quick actions
- links to service detail views

### 3. Dependencies
Purpose:
- full dependency graph visualization

Contents:
- React Flow graph
- filters for service type/status
- graph legend
- click-through to service detail

### 4. Runtime
Purpose:
- service-lasso runtime/system overview

Contents:
- runtime status
- global env summary
- startup/bootstrap state
- runtime-level controls

### 5. Logs
Purpose:
- central log browsing

Contents:
- runtime logs
- per-service logs
- log filters
- service log selection

### 6. Network
Purpose:
- ports and URL visibility

Contents:
- direct ports
- browser-facing URLs
- routed hostnames
- routing overview

### 7. Installed
Purpose:
- installed service/version/acquisition state

Contents:
- installed version
- selected version
- install state
- acquisition mode (`embed`, `package`, `runtime`)
- service.state inspection

### 8. Settings (optional later)
Purpose:
- UI-level settings or future operator config

Potential contents:
- theme prefs
- refresh behavior
- feature flags
- optional connection/runtime settings

---

## 3. Proposed Topbar / Header Behavior

The topbar should likely provide:

- global search / command palette
- runtime health indicator
- current refresh/update indicator
- theme switcher
- maybe current app/runtime target indicator later

This fits well with the `shadcn-admin` base.

---

## 4. Proposed Route Map

Suggested route structure:

```text
/dashboard
/services
/services/:serviceId
/dependencies
/runtime
/logs
/network
/installed
/settings   (optional)
```

Recommended route ownership:

```text
src/routes/
  dashboard.tsx
  services.tsx
  services.$serviceId.tsx
  dependencies.tsx
  runtime.tsx
  logs.tsx
  network.tsx
  installed.tsx
  settings.tsx
```

Important note:
- `services.$serviceId.tsx` should preserve and modernize the current donor per-service admin page rather than dropping that capability

---

## 5. Proposed API Philosophy

The admin UI should be API-driven.

The UI should not depend on:
- Electron IPC
- direct runtime internals
- inline callback wiring from bootstrap code

It should rely on a stable Service Lasso API.

---

## 6. Proposed API Domains

The UI needs endpoints in these domains:

### A. Runtime
- runtime status
- runtime actions
- global env / top-level health

### B. Services
- list services
- inspect one service
- service actions
- service state/ports/URLs

### C. Dependencies
- graph data for dependency visualization

### D. Logs
- runtime and per-service logs

### E. Installed / Version State
- selected version
- installed version
- install/acquisition state

### F. Network / Routing
- direct ports
- browser URLs
- routed hostnames

---

## 7. Proposed Runtime Endpoints

### `GET /api/runtime/status`
Returns:
- runtime health/status
- counts/summary
- maybe startup/bootstrap state

### `POST /api/runtime/start-all`
Starts all configured/selected services.

### `POST /api/runtime/stop-all`
Stops all running services.

### `POST /api/runtime/reload`
Reloads service metadata/state.

### `GET /api/runtime/env`
Returns globalenv/shared runtime environment visible to services.

### `GET /api/runtime/health`
Returns runtime-level health/readiness information.

---

## 8. Proposed Service Endpoints

### `GET /api/services`
Returns full service list with summary state.

Expected info per service:
- id
- name
- status
- enabled
- service type/category
- install state summary
- ports summary
- URL summary

### `GET /api/services/:serviceId`
Returns detailed service view model.

Expected info:
- metadata
- service.json-derived contract summary
- install state
- pid/process state
- ports
- URLs
- logs references
- dependency info

### `POST /api/services/:serviceId/start`
Start service.

### `POST /api/services/:serviceId/stop`
Stop service.

### `POST /api/services/:serviceId/restart`
Restart service.

### `POST /api/services/:serviceId/setup`
Run install/setup/reinstall flow as appropriate.

### `GET /api/services/:serviceId/state`
Returns `service.state` information.

### `GET /api/services/:serviceId/pid`
Returns `service.pid` information / current process state.

---

## 9. Proposed Dependency Endpoints

### `GET /api/dependencies`
Returns dependency graph for all services.

Graph shape should be easy for React Flow to consume, e.g.:
- nodes
- edges
- node metadata (type/status/install state)

### `GET /api/dependencies/:serviceId`
Returns service-specific dependency subgraph.

---

## 10. Proposed Logs Endpoints

### `GET /api/logs/runtime`
Returns runtime log stream/list.

### `GET /api/logs/services/:serviceId`
Returns service log stream/list.

Potential later support:
- follow/tail mode
- time-range filters
- log-level filters

---

## 11. Proposed Installed / Version Endpoints

### `GET /api/installed/services`
Returns installed services with install/version/acquisition info.

### `GET /api/installed/services/:serviceId`
Returns detailed install state for one service.

### `POST /api/installed/services/:serviceId/install`
Explicit install action.

### `POST /api/installed/services/:serviceId/update`
Update service to selected/latest version.

### `POST /api/installed/services/:serviceId/select-version`
Select a specific version.

This area is especially important because the new platform supports:
- exact version selection
- latest-by-default unless pinned
- acquisition modes (`embed`, `package`, `runtime`)

---

## 12. Proposed Network Endpoints

### `GET /api/network/ports`
Returns negotiated direct ports.

### `GET /api/network/urls`
Returns browser-facing URLs / routed URLs.

### `GET /api/network/routes`
Returns routing-layer information if separated from URLs.

This reflects the clarified model:
- browser/frontend interactions usually use URLs
- service-to-service comms usually use direct ports

---

## 13. Suggested UI-to-API Mapping

### Dashboard page uses
- `GET /api/runtime/status`
- `GET /api/runtime/health`
- maybe `GET /api/services`

### Services page uses
- `GET /api/services`
- `POST /api/runtime/start-all`
- `POST /api/runtime/stop-all`
- `POST /api/runtime/reload`

### Service detail page uses
- `GET /api/services/:serviceId`
- `GET /api/services/:serviceId/state`
- `GET /api/services/:serviceId/pid`
- `GET /api/logs/services/:serviceId`
- `GET /api/dependencies/:serviceId`
- action endpoints for start/stop/restart/setup

Recommended service detail sections:
- overview
- install & state
- process
- ports & URLs
- logs
- dependency subgraph
- config/manifest summary

### Dependencies page uses
- `GET /api/dependencies`

### Runtime page uses
- `GET /api/runtime/status`
- `GET /api/runtime/env`
- `GET /api/runtime/health`

### Logs page uses
- `GET /api/logs/runtime`
- `GET /api/logs/services/:serviceId`

### Network page uses
- `GET /api/network/ports`
- `GET /api/network/urls`
- `GET /api/network/routes`

### Installed page uses
- `GET /api/installed/services`
- `GET /api/installed/services/:serviceId`
- install/update/select-version endpoints

---

## 14. Important Future API Qualities

The API should ideally be:
- typed
- stable across host apps
- suitable for Node/Electron/Tauri/Docker reference apps
- suitable for future Go/Rust parity

This means the admin UI should encourage clean API design rather than hidden runtime coupling.

---

## 15. Working Summary

The proposed `lasso-@serviceadmin` navigation should focus on:
- Dashboard
- Services
- Dependencies
- Runtime
- Logs
- Network
- Installed

And the UI should be backed by a clean Service Lasso API covering:
- runtime
- services
- dependencies
- logs
- install/version state
- network/routing

This gives the new optional admin UI service a clear information architecture and a clear control-plane contract.
