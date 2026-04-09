# UI Decision Context

This repo is the current UI/admin target for the Service Lasso donor-analysis split.

## Ground rules carried into this repo

- the admin UI is optional, not privileged core
- the admin UI must consume a stable API/control surface
- the donor inline Bootstrap/jQuery/D3 UI is behavior reference, not target implementation shape
- `shadcn-admin` is the structural starter base, not the product architecture
- per-service detail remains a first-class page, not an afterthought
- dependencies, logs, network, runtime, and installed state all belong in the operator surface

## Why the starter is in here now

The purpose of this slice is to stop talking about the UI only in donor-planning docs and instead leave a real repo that carries:
- its own OpenSpec draft
- the key UI ref docs
- a visible first route/navigation shell
- explicit API/harness stubs for the backend surface the UI will need

## What the stub layer means

The `src/lib/service-lasso-api/` layer is deliberately explicit.

It is a temporary harness/mocking contract so the UI can be built against:
- runtime summary
- services list
- service detail
- action execution
- dependency graph
- network bindings
- installed/version state
- operator UI settings

Later, these stubs should be replaced by real API calls without needing to redesign the page model.
