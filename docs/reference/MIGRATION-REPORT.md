# Migration Report - Service Admin UI

Repo target: `lasso-@serviceadmin`
Date: 2026-04-10
Branch: `develop`
Current mode: **template baseline first**

## Runtime API endpoint contract

The Service Admin UI should not guess the Service Lasso runtime/API location.

It should receive the runtime endpoint through env/config, with the current frontend contract:

- `VITE_SERVICE_LASSO_API_BASE_URL`
- `VITE_SERVICE_LASSO_FAVORITES_ENABLED`

Current intended use:

- service metadata reads, including favorite state
- service metadata updates, including favorite toggles
- future service-detail, logs, and runtime actions should follow the same endpoint source instead of introducing page-local hardcoded URLs

Current first endpoints expected by the UI:

- `GET /api/services/meta`
- `PATCH /api/services/:serviceId/meta`

Current gating rule:

- favorite editing should remain disabled unless both the runtime endpoint is provided and `VITE_SERVICE_LASSO_FAVORITES_ENABLED=true`

This keeps the admin UI portable across local dev, demo, and real runtime deployments.

## Current baseline status

The repo has been reset back to the chosen `Service Admin` template baseline so the app now reflects the template look and feel first.

This means the current app is primarily a **template-faithful baseline**, not yet a full Service Lasso-adapted admin UI.

## What from the provided references is currently present

### 1. Template shell and look/feel
Present now, from the chosen `Service Admin` template baseline:
- sidebar shell
- header/topbar shell
- dashboard layout structure
- cards / stats / chart areas
- table/list patterns provided by the template
- settings shell patterns
- help-center/support-style surfaces from the template ecosystem
- error pages and template route scaffolding

### 2. Component/style patterns available to reuse
Available now because they exist in the template codebase:
- card-based dashboard sections
- table patterns
- drawer/dialog patterns
- sidebar navigation groups
- settings sections/forms
- charts and summary widgets
- command/search/header interactions
- empty/error/loading template surfaces

## What from Max's Service Lasso references is currently migrated

At this exact moment, **intentionally very little Service Lasso-specific behavior is migrated**, because the repo was reset to template-first state before re-adding only the wanted pages/components.

So the current truthful migrated set is:
- chosen template base is restored and running
- required server port behavior was restored for local checking on `17700`
- no broad Service Lasso shell rewrite remains intended

## What is NOT yet migrated after the reset

These are still pending and should only be added carefully using template-native patterns/components:
- Service Lasso dashboard content
- favorite-services quick-access URLs
- all-other-services list on dashboard
- services table with search/filter/pagination
- service details page/content
- dependency graph page/content
- network table with clickable links and favorites
- logs page with service log stream interaction
- runtime page content with clearer operator history/status semantics
- installed table/content
- settings content narrowed to the wanted sections only in final product terms

## Safe migration rule going forward

Only do these two kinds of change:
1. add the exact pages we need
2. use only component patterns that already exist in the template/examples

Do **not**:
- redesign the shell
- invent a new layout system
- replace template look/feel
- add off-pattern custom UI when a template/example pattern already exists

## Non-negotiable page-shape invariant

This repo must preserve the **shared template page shape**.

That means every real product page should use the same overall page frame and content-space pattern as the template pages already in the repo:
- normal template `Header`
- normal template `Main` content container
- the same content width / spacing / vertical rhythm used by the template pages
- page sections composed from template-native cards, tables, forms, lists, dialogs, drawers, and empty/loading/error states

This rule is stronger than “keep the shell”. It applies to the **page content area too**.

So, for Service Lasso pages, do **not**:
- cut a page down to a bare card just because the data slice is small
- invent a one-off page layout for a single route
- bypass the normal template header/content framing
- compress or reshape the page content space in a way that breaks consistency with other pages

Instead, always start from the proper template page shape for that page type, then adapt the content inside it.

Examples:
- dashboard pages should use the template dashboard-style page frame and section rhythm
- table/list pages should use the template list/table page frame
- detail pages should use a proper template detail-style content layout, not an isolated floating card
- settings/help/support pages should keep their template section/sidebar/form structure

Operational rule: **there must not be any cutting**. If a route is worth having, it is worth fitting into the proper shared template page structure.

## Why the service details page exists, and what it is meant to show

The service details page is **not** meant to be a generic summary card exploded onto its own route.

Its purpose is to give an operator the **service-specific operational view** that does not fit cleanly in the services table.

That means the page should answer questions like:
- what exact service is this?
- what is its current runtime/health state?
- where does it run and how is it reached?
- what version/build/config/runtime facts matter right now?
- what depends on it, and what does it depend on?
- what actions can the operator take from here?
- where do I go next for logs, config, network exposure, or related troubleshooting?

So the intended service-details content is closer to:
- service identity and role
- status / health / last check / runtime state
- ports, bind addresses, URLs, and exposure info
- version/build/runtime metadata
- install/config/data path references when relevant
- dependency/dependent relationships
- service-specific actions
- links into logs / diagnostics / related views

And it is **not** primarily meant to spend space on weak summary filler such as:
- dashboard placement as a headline fact
- counts that already exist in the list page unless they help an operator act
- decorative summary cards that do not improve service-specific understanding

In short: the service details page exists to show the **operator-facing facts and actions for one service**, inside the proper template detail-page shape.

## Service details page, intended sections and data

The first proper version of the service details page should be organised into a small number of clear operator-facing sections.

### 1) Page header / identity block
Purpose: identify the service immediately and establish what the page is about.

Should include:
- service display name
- service id / slug
- short role/description
- current primary status badge
- clear back-navigation to the services list

### 2) Runtime + health section
Purpose: show whether the service is healthy, running, degraded, stopped, or otherwise needs attention.

Should include the most useful current-state facts, such as:
- runtime state
- health state
- last health check / last known update
- current warning/error summary
- uptime or last restart time when available

### 3) Endpoints / exposure section
Purpose: show where the service is reached and how it is exposed.

Should include:
- local URLs
- LAN / remote URLs where relevant
- ports
- bind addresses / host exposure notes
- protocol / route labels when useful

### 4) Runtime / build / installation metadata section
Purpose: show the concrete implementation facts an operator needs when checking what is deployed.

Should include relevant fields such as:
- service type / runtime kind
- version / build / revision / image / package identifier
- installed state
- executable path, install path, config path, or data path when relevant
- environment/profile/lane name when relevant

### 5) Dependencies / relationships section
Purpose: make it obvious what this service relies on and what relies on it.

Should include:
- dependencies
- dependents
- related platform components
- any important blocked/degraded relationship notes

### 6) Actions section
Purpose: give the operator the next useful service-specific controls from the detail page.

Should include only actions that make sense for the specific service, for example:
- start / stop / restart
- reload / reconfigure
- open config
- open logs
- open related admin surface

### 7) Diagnostics / navigation-out section
Purpose: help the operator continue the investigation or management flow.

Should include links/jumps to:
- logs
- network view
- runtime view
- config/settings for that service
- related troubleshooting surfaces when relevant

## Service details page, data we explicitly do not want as filler

The details page should not be padded with weak summary content just to fill space.

Avoid using these as headline sections unless they directly help an operator act:
- dashboard placement / favorite status as a primary fact
- generic counts already visible on the list page
- decorative summary cards with no operational consequence
- repeated content that does not deepen understanding of the specific service

## Execution plan to get the operator surfaces working

The implementation sequence should prioritise **real operator data and flows** over decorative UI polishing.

### Phase 1. Lock the UI contract
Before adding more surface area, keep this doc as the contract for:
- dashboard sections
- services list/table shape
- service details sections/data
- dependencies graph intent
- logs streaming flow
- runtime / installed / network / settings intent

Goal: no more ambiguity about what each page is for.

### Phase 2. Upgrade the stub data model
Current stub data is too thin for the intended operator surfaces.

Expand the stub to carry the real fields the pages need, including:
- runtime + health facts
- ports / URLs / bind addresses
- version / build / runtime metadata
- install / config / data path references
- dependencies + dependents
- recent log preview + stream/history handles
- service-specific actions

Goal: pages stop being forced to invent filler cards just to occupy space.

### Phase 3. Finish the service details page properly
Replace placeholder/filler detail content with the documented sections in this file:
- identity block
- runtime + health
- endpoints / exposure
- runtime/build/installation metadata
- dependencies / relationships
- actions
- diagnostics / navigation-out

Goal: make the route a real operator detail view, not just a styled summary.

### Phase 4. Build the dependencies page as a real graph surface
The product requirement already says dependencies need a **real graph**.

Execution shape:
- dedicated dependencies page owns the full graph
- service details page shows the local dependency slice and links into the graph
- first version can use deterministic stub topology, but should still behave like a graph surface, not a placeholder card
- React Flow graph design is now specified in `docs/reference/DEPENDENCY-GRAPH-SPEC.md`

Goal: relationship data becomes visible and navigable.

### Phase 5. Build the logs flow
Logs should be treated as a dedicated flow, not just a paragraph on the detail page.

Execution shape:
- dedicated Logs page owns the live stream surface
- Services table and Service Details page should both be able to open the selected service log stream
- Service Details may show a small recent-log preview, but not the full stream surface
- frontend log viewer design is now specified in `docs/reference/LOG-STREAMING-SPEC.md`

Recommended first backend contract:
- history/backfill endpoint
- live stream endpoint (SSE is the preferred first transport)

Goal: operators can move from service -> logs quickly and keep a clean live-view model.

### Phase 6. Finish Runtime page semantics
Runtime needs to clearly communicate runtime state/history/log semantics, not fuzzy summary copy.

Goal: runtime page answers runtime questions distinctly from logs, details, and installed metadata.

### Phase 7. Finish Installed page as a real table
Installed should be a proper template-aligned table with useful operator metadata.

Expected focus:
- install state
- version/build/package/runtime facts
- useful row actions/navigation

### Phase 8. Finish Network page
Network should be a proper operator-facing table.

Expected focus:
- clickable local/LAN/remote links
- ports / bind addresses / exposure clarity
- favorite toggling if it remains part of the final UX

### Phase 9. Finish Settings surface
Settings should expose only the meaningful Service Lasso configuration surface while staying inside the template settings patterns.

### Phase 10. Cross-link the operator flow
Once the pages exist, wire the natural jumps between them:
- Services -> Details
- Details -> Logs / Dependencies / Network / Runtime
- Dependencies -> selected Service Details
- Logs -> selected Service Details

### Phase 11. Final validation pass
When the main surfaces are in place:
- run build/lint/format
- do a route-by-route manual operator review
- update docs/specs so the repo stays the source of truth

## Recommended execution order

Recommended order of work:
1. stub data model
2. service details
3. dependencies graph
4. logs flow
5. runtime / installed / network / settings cleanup

Reason: operator data quality and navigation flow matter more than surface polish.
