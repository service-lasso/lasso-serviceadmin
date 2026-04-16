# Dependency Graph Spec - Service Admin UI

Repo target: `lasso-@serviceadmin`
Date: 2026-04-11
Status: active design spec for the React Flow implementation

## Purpose

The Dependencies page should provide a clear operator-facing graph for service relationships.

This page is not meant to be:
- a generic graph demo
- a proof that React Flow is installed
- a dense technical network with no visual hierarchy

It is meant to help an operator answer questions like:
- what does this service depend on?
- what depends on this service?
- which dependencies are unhealthy or missing?
- which services are infrastructure vs app vs utility?
- where should I go next from this node?

## Technology choice

Chosen graph surface: **React Flow**

Reason:
- best fit for a modern React/shadcn admin UI
- good node/edge interaction out of the box
- easier to theme and maintain than raw D3 for this use case
- strong fit for service dependency maps with clickable nodes and operator actions

## Graph model

### Nodes

Each node represents one service.

Minimum node data:
- service name
- service id
- service type/category
- current status
- installed state

Optional compact metadata:
- version/build
- runtime kind
- small health summary badge

### Edges

Each edge represents a dependency relationship.

Base direction:
- edge points from **dependency** -> **dependent**

So if Service Admin depends on ZITADEL, the edge is:
- `ZITADEL -> Service Admin`

### Relationship types

First supported relationship type:
- hard dependency

Future relationship types:
- soft dependency
- optional integration dependency
- operational dependency

These may later affect:
- edge style
- edge color
- edge label

## Visual semantics

### Node categories

Nodes should visually distinguish major service categories.

First-pass categories:
- app
- runtime
- infrastructure
- utility
- security/auth
- workflow

Recommended styling:
- category tint/accent
- consistent icon or badge per category
- keep category styling subtle enough not to overpower status

### Status styling

Status must be immediately visible.

First-pass statuses:
- running
- degraded
- stopped
- missing (future)

Recommended visual treatment:
- running -> green accent/border
- degraded -> amber accent/border
- stopped -> muted/gray or outline state
- missing -> red or destructive tone

Status should be readable at a glance without needing to open the detail panel.

## Layout rules

### Default focus layout

When a service is selected:
- selected service is centered
- direct dependencies appear to the **left**
- direct dependents appear to the **right**
- unrelated/background services should not dominate the main view

### Expanded graph behavior

If the graph grows:
- keep a focused mode by default
- allow optional expansion outward
- do not dump the whole universe into an unreadable spaghetti graph

### Lane/grouping rule

Preferred future layout improvement:
- group nodes by category/lane where useful

Possible lanes:
- infrastructure
- runtime
- security/auth
- workflow
- app/admin/ui
- utility

This should make the graph read more like a structured operator map than a random force layout.

## Interaction model

### Required interactions

- click node -> focus that service in the graph
- visible selected-node summary/detail panel
- jump from selected node -> service details page
- jump from selected node -> logs page
- zoom/pan controls
- minimap
- searchable node selection

### Recommended next interactions

- filter by category
- filter by status
- hide/show utility services
- highlight path to selected node
- fit graph to selected neighborhood
- reset view

### Avoid

- double-click-only critical actions
- hidden graph state with unclear focus
- interactions that make it hard to recover orientation

## Page composition

The Dependencies page should have these sections:

1. **Header / page intro**
   - clear statement that this is the dependency graph
   - search input
   - top-level jumps back into other operator pages

2. **Graph summary cards**
   - service count
   - edge count
   - selected node
   - keep these compact

3. **Main React Flow canvas**
   - this is the primary surface
   - should dominate the page visually

4. **Selected service side panel**
   - short summary
   - status badges
   - counts of dependencies/dependents
   - links to service details and logs

## Node design spec

Each node should feel like a mini operator card, not plain text.

Recommended first-pass node content:
- service name
- service type/category badge
- status indicator
- maybe one compact metadata line (runtime or version)

Recommended first-pass node layout:
- title row
- type/status badges row
- compact metadata line

Do not overload nodes with too much text.

## Edge design spec

First pass:
- clean directional arrow
- status-aware color where useful
- avoid visual clutter

Future pass:
- labeled edges for relationship type
- distinct styling for optional vs hard dependencies

## Search behavior

Search should help operators quickly find a service in the graph.

Expected behavior:
- typing filters/selects candidate services
- selecting a service focuses that node
- graph recenters around the selected service neighborhood

Search should not simply hide everything in a confusing way without making focus obvious.

## Performance / scalability rules

Current graphs may be small, but the UI should anticipate growth.

Guidance:
- optimize for focused neighborhood rendering first
- avoid naive whole-graph clutter by default
- preserve readability before completeness

If graph complexity grows significantly, revisit:
- collapsed groups
- lazy expansion
- stronger lane layout
- richer filtering

## First acceptable implementation target

A good first proper React Flow version should achieve all of this:
- selected service centered
- direct dependencies visible on the left
- direct dependents visible on the right
- nodes have category + status styling
- graph feels visually intentional
- clicking nodes refocuses cleanly
- search helps locate and focus nodes
- side panel provides useful next actions

## Explicit non-goals for the first proper version

Do not try to solve all graph problems at once.

Not required in the first proper version:
- advanced graph analytics
- arbitrary drag-and-drop editing
- full graph database semantics
- every possible relationship type
- perfect auto-layout for huge graphs

## Design quality bar

The graph should feel:
- readable at a glance
- polished enough for a modern admin UI
- clearly operator-oriented
- consistent with the rest of the shadcn-admin visual language

If it looks like a generic graph playground instead of a service dependency surface, it is not done.

## Service meta fields (graph persistence)

To persist graph layout via service meta (same style of metadata persistence as favorites), service meta should include:

- `favorite: boolean` (existing parity reference)
- `dependencyGraphPosition.x: number`
- `dependencyGraphPosition.y: number`

Expected write path:

- `PATCH /api/services/:serviceId/meta`
- payload fragment:

```json
{
  "dependencyGraphPosition": { "x": 120, "y": -80 }
}
```

UI behavior contract:

- Save/Discard controls exist on Dependencies graph.
- Save always attempts service-meta writes via API (`PATCH /api/services/:serviceId/meta`).
- Save shows toast feedback for success/failure.
- If API base URL is missing or API persistence is unavailable, Save still shows a toast that reload will revert.
