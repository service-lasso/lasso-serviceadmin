# Service Lasso - `shadcn-admin` Mapping for `lasso-@serviceadmin`

_Status: working draft / structural mapping_

Important reconciliation note:
- this file is a UI adaptation/mapping sketch
- use `QUESTION-LIST-AND-CODE-VALIDATION.md` and `ARCHITECTURE-DECISIONS.md` first for settled answers about optional admin UI and API-driven control-plane boundaries

Purpose:

- map the reviewed `shadcn-admin` structure into the proposed `lasso-@serviceadmin` admin UI service
- show which parts of the base are likely reusable as-is, which parts should be adapted, and which new Service Lasso-specific sections need to be added

Related docs:

- `SHADCN-ADMIN-REVIEW.md`
- `UI-STATE-REVIEW.md`
- `ARCHITECTURE.md`
- `ARCHITECTURE-DECISIONS.md`

---

## 1. Core Direction

`lasso-@serviceadmin` should:

- use `shadcn-admin` as the UI/application base
- run using `@node`
- talk to the Service Lasso API
- keep the current admin/operator feature set from the donor UI
- replace the old inline Bootstrap/jQuery/D3 UI with a modular React structure
- use React Flow instead of D3 for the dependency graph

---

## 2. High-Level Structural Mapping

## `shadcn-admin` -> `lasso-@serviceadmin`

### `src/main.tsx`
**Role in base:** app bootstrap

**Service Lasso mapping:**
- keep as app bootstrap entrypoint
- initialize router, query client, theme providers, API client config

### `src/routes/`
**Role in base:** route/page organization

**Service Lasso mapping:**
Use this as the main page structure for:
- services dashboard
- service detail
- dependency map
- runtime overview
- logs
- network
- installed services
- settings (optional later)

### `src/components/`
**Role in base:** reusable UI components

**Service Lasso mapping:**
Use for:
- status badges
- service cards
- service tables
- action buttons/toolbars
- port/url widgets
- info cards
- log viewer widgets

### `src/features/`
**Role in base:** domain-specific feature areas

**Service Lasso mapping:**
Use for:
- dependency graph (React Flow)
- service actions
- logs
- runtime health/status
- install/version state

### `src/stores/`
**Role in base:** client state management

**Service Lasso mapping:**
Use for:
- selected service state
- filters/search state
- dependency graph UI state
- runtime view preferences

### `src/lib/`
**Role in base:** helper libraries / low-level app helpers

**Service Lasso mapping:**
Use for:
- Service Lasso API client wrappers
- type-safe transforms
- shared route/query helpers

### `src/hooks/`
**Role in base:** reusable hooks

**Service Lasso mapping:**
Use for:
- runtime status hooks
- services list hooks
- service detail hooks
- action/mutation hooks
- dependency graph hooks

### `src/config/`
**Role in base:** app configuration

**Service Lasso mapping:**
Use for:
- sidebar/navigation config
- feature flags
- route metadata
- optional serviceadmin config

### `src/context/`
**Role in base:** React context providers

**Service Lasso mapping:**
Use selectively for:
- app-level providers
- maybe runtime selection/context later if needed

### `src/styles/`
**Role in base:** styling/theme support

**Service Lasso mapping:**
Keep as style/theme layer for the admin UI shell.

### `src/assets/`
**Role in base:** static assets

**Service Lasso mapping:**
Use for:
- branding assets
- icons/images
- screenshots/demo assets if needed

---

## 3. Proposed `lasso-@serviceadmin` Route Map

Using `shadcn-admin` route structure, create routes like:

```text
src/routes/
  _app/
    dashboard.tsx
    services.tsx
    services.$serviceId.tsx
    dependencies.tsx
    runtime.tsx
    logs.tsx
    network.tsx
    installed.tsx
```

### Route purposes

#### `dashboard.tsx`
High-level summary page:
- runtime status
- service counts
- quick health overview
- quick actions

#### `services.tsx`
Main services dashboard:
- all services list
- filters/search
- start all / stop all / reload

#### `services.$serviceId.tsx`
Single service detail page:
- metadata
- state
- ports
- URLs
- PID/memory/process
- logs
- actions
- dependency subgraph

Important note:
- this is the modern replacement for the current donor per-service UI in `getServicePage(service)`
- per-service UI should remain a first-class part of the admin/operator experience

#### `dependencies.tsx`
Full dependency graph page:
- React Flow graph
- filters
- legend
- click through to services

#### `runtime.tsx`
Runtime/system overview:
- service-lasso runtime health
- global env summary
- install/bootstrap warnings
- runtime control actions

#### `logs.tsx`
Central log browsing:
- per-service logs
- runtime logs
- filters/tailing later

#### `network.tsx`
Ports and URLs overview:
- direct ports
- browser URLs
- routed hostnames

#### `installed.tsx`
Installed service state:
- selected version
- installed version
- install mode (`embed`, `package`, `runtime`)
- install state from `service.state`

---

## 4. Proposed Feature Mapping

### Current donor feature -> New feature module

#### Services dashboard
```text
src/features/services/
  services-table.tsx
  services-cards.tsx
  services-filters.tsx
  services-toolbar.tsx
```

#### Service detail
```text
src/features/service-detail/
  overview-card.tsx
  install-state-card.tsx
  process-card.tsx
  ports-card.tsx
  urls-card.tsx
  actions-card.tsx
  config-card.tsx
  logs-card.tsx
  dependency-subgraph-card.tsx
```

#### Dependency graph
```text
src/features/dependency-graph/
  graph.tsx
  node-renderer.tsx
  edge-renderer.tsx
  graph-transform.ts
  legend.tsx
  toolbar.tsx
```

#### Runtime overview
```text
src/features/runtime/
  runtime-status-card.tsx
  runtime-actions-card.tsx
  runtime-health-card.tsx
  runtime-env-card.tsx
```

#### Logs
```text
src/features/logs/
  logs-viewer.tsx
  logs-toolbar.tsx
  log-panel.tsx
```

#### Installed/version state
```text
src/features/installed/
  installed-services-table.tsx
  service-version-card.tsx
  install-state-card.tsx
```

---

## 5. Proposed Shared Components Mapping

Use `src/components/` for reusable primitives specific to Service Lasso, for example:

```text
src/components/
  status-badge.tsx
  service-type-badge.tsx
  service-action-button.tsx
  port-link.tsx
  url-button.tsx
  pid-badge.tsx
  memory-usage.tsx
  dependency-count.tsx
```

These should sit on top of the existing shadcn component base.

---

## 6. Proposed API Client Mapping

Use `src/lib/` for API clients and transforms:

```text
src/lib/api/
  client.ts
  runtime.ts
  services.ts
  logs.ts
  dependencies.ts
  installed.ts
```

And types under:

```text
src/lib/types/
  service.ts
  runtime.ts
  dependency-graph.ts
  install-state.ts
```

This keeps UI logic clean and API-driven.

---

## 7. React Flow Replacement Mapping

Current donor dependency graph uses D3.

New mapping:

```text
src/features/dependency-graph/
  graph.tsx
```

Technology choice:
- React Flow replaces D3

Expected graph model:
- nodes = services
- edges = dependencies
- styles = service type/status/install state
- click node = navigate to service detail

This should preserve current dependency-map behavior while making it much more polished.

---

## 8. Likely Things To Remove From Base

When adapting `shadcn-admin`, likely remove or replace:

- unrelated sample pages
- generic charts that do not map to Service Lasso features
- auth/sample integrations not needed for the optional admin UI service
- domain-specific example data and stores

Keep the shell/layout; replace the example domain.

---

## 9. Recommended First Implementation Order

### Phase 1
- app shell/sidebar/topbar
- services dashboard route
- single service detail route
- API client layer

The per-service detail route is a priority because it preserves one of the most useful pieces of the current donor UI.

### Phase 2
- runtime overview route
- logs route
- network route

### Phase 3
- React Flow dependency graph page
- installed/version state page

This gets useful admin value quickly while preserving a clean build-out path.

---

## 10. Working Summary

`shadcn-admin` should be used as the structural/layout foundation for `lasso-@serviceadmin`, while Service Lasso-specific routes, features, API clients, and React Flow dependency visualization are layered on top.

The current donor admin UI supplies the behavior reference; `shadcn-admin` supplies the cleaner application shape.
