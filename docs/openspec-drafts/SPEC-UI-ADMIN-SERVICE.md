# Spec Draft - UI Admin Service

_Status: ref-only draft_

## Intent
Define the optional Service Lasso admin UI/service contract so the UI can be designed as a real consumer of the core runtime/API instead of a privileged hardcoded shell. This spec should make clear what the UI is for, what it reads, what operator tasks it must support, and how it relates to named service actions, logs, state, network visibility, and runtime status.

## Scope
In scope:
- optional admin UI/service role
- relationship to core runtime/API
- operator-oriented navigation and route structure
- minimum dashboard and service-view contract
- minimum runtime/log/network/installed views
- action/state/log/backups/runtime visibility expectations
- generic UI shell versus service-specific detail concerns

Out of scope:
- exact component library choice
- final visual design system
- exact implementation framework
- final auth model
- packaging details for each reference host

## Acceptance Criteria
- AC-UI-001: The spec states that the admin UI is an optional separate service, not privileged core.
- AC-UI-002: The spec states that the UI consumes runtime/API/state/log information rather than inventing parallel unmanaged state.
- AC-UI-003: The spec defines the operator-oriented route/navigation model at a high level.
- AC-UI-004: The spec defines the minimum dashboard surface needed for system-level operator awareness.
- AC-UI-005: The spec defines the minimum per-service detail surface needed to inspect and act on a service.
- AC-UI-006: The spec defines the minimum action surface the UI must present for named service actions.
- AC-UI-007: The spec explains how logs, state, backups, runtime status, ports, and URLs are surfaced to the operator.
- AC-UI-008: The spec records the current direction that the UI should be API-driven and should not depend on donor bootstrap internals or embedded server-rendered HTML.
- AC-UI-009: The spec records any still-open questions instead of hiding them.

## Tests and Evidence
- donor analysis docs:
  - `SERVICEADMIN-NAV-AND-API.md`
  - `UI-STATE-REVIEW.md`
  - `SHADCN-ADMIN-REVIEW.md`
  - `SHADCN-ADMIN-MAP.md`
  - `SHADCN-ADMIN-REMOVAL-TARGETS.md`
- donor runtime surface evidence:
  - `runtime/Services.ts`
- transcript-backed decisions from:
  - `ARCHITECTURE-DECISIONS.md`
  - `QUESTION-LIST-AND-CODE-VALIDATION.md`

## Documentation Impact
This draft is expected to later inform:
- the promoted governed UI spec in `.governance/specs/`
- future UI/reference-host docs
- API surface documentation once core stabilizes further
- the eventual `lasso-@serviceadmin` implementation repo/docs

## Repo Target
Current intended repo/service target for this UI OpenSpec draft:
- `lasso-@serviceadmin`

## Verification
Review this draft by checking:
- whether the UI remains clearly optional and API-driven
- whether it depends on stable core concepts rather than donor UI accidents
- whether operator tasks are obvious and grounded in state/log/action/runtime reality
- whether the route/view expectations are enough to guide a real UI implementation without overcommitting framework details

## Change Notes
- Initial ref-only spec draft created from UI/admin donor analysis.
- Expanded into a more concrete first-pass UI/service contract draft using the donor UI/admin planning docs.

## Current Draft Direction

### 1. UI role
The admin UI should be an optional operator/admin service.

It exists to help an operator:
- see system state quickly
- inspect individual services
- trigger named service actions
- inspect logs, ports, URLs, backups, and runtime/reference state
- understand dependency relationships

It should not be treated as:
- privileged core runtime
- donor-style embedded HTML tied directly to bootstrap code
- a mandatory UI surface for every Service Lasso usage mode

### 2. API-driven relationship to core
The UI should consume a stable Service Lasso API/control surface.

It should not depend on:
- Electron IPC
- donor bootstrap internals
- server-rendered HTML functions in `Services.ts`
- inline CDN-driven UI behavior from the donor runtime

The donor UI should be treated as feature reference, not implementation shape.

### 3. High-level route/navigation direction
Current recommended operator-oriented areas are:
- Dashboard
- Services
- Dependencies
- Runtime
- Logs
- Network
- Installed
- Settings (optional later)

Recommended route shape remains roughly:
- `/dashboard`
- `/services`
- `/services/:serviceId`
- `/dependencies`
- `/runtime`
- `/logs`
- `/network`
- `/installed`
- `/settings` (optional later)

### 4. Minimum dashboard contract
The dashboard should provide at least:
- runtime health summary
- service counts by notable state
- quick visibility into problem services
- quick operator actions such as start-all/stop-all/reload when those are supported

### 5. Minimum service-detail contract
The per-service page should remain a first-class UI concept.

Minimum expected visibility for a service detail page:
- service identity and category/type
- current status / last known runtime state
- visible named actions for that service
- ports and browser-facing URLs
- install/reference state
- runtime/log visibility
- dependency relationships / dependency subgraph
- backup/state visibility where relevant

This is the conceptual successor to the donor per-service page currently generated in `Services.ts`.

### 6. Minimum action surface
The UI should present named service actions that are actually meaningful/available for the service.

At minimum, the UI should be designed to support:
- visible action affordances
- action feedback/results
- clear distinction between action availability and action absence

The UI should not invent actions on its own. It should reflect Service Lasso-supported named actions and the service/runtime state returned by the backend.

### 7. Logs / state / network / installed views
The UI should support dedicated operator views for:

#### Logs
- per-service logs
- runtime logs
- practical filtering/selection

#### Runtime
- runtime health/status
- startup/bootstrap warnings where relevant
- high-level runtime controls where supported

#### Network
- direct ports
- browser-facing URLs
- routed hostnames/route visibility where relevant

#### Installed
- install/reference state
- selected/installed version visibility
- managed state/output visibility

### 8. Dependency visualization direction
Dependency relationships should remain visible in the future UI.

Current donor D3 dependency rendering should be treated as feature reference.

Current preferred replacement direction from the analysis docs:
- use a more modern graph solution such as React Flow rather than carrying forward the donor D3 embedding model

### 9. Base/adaptation direction
Current UI-base direction from donor-analysis docs:
- `shadcn-admin` looks like a strong candidate UI/application base
- use it as an adaptable app shell, not as a drop-in architecture
- strip demo/auth/sample business content
- keep the useful shell/route/component structure
- replace donor demo content with Service Lasso operator views

## Current Open Questions
- What exact minimum service-admin page contract should the UI support before it is considered complete enough for first implementation?
- Which fields should come directly from runtime/API versus being computed client-side?
- How much should be generic versus service-specific extension/plugin views?
- Should logs/backups/state details be embedded inside service detail pages, separate pages, or both?
- What is the exact first implementation scope: dashboard + services + service detail only, or include dependencies/runtime/logs/network from the first slice?
