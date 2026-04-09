# UI OpenSpec Tracker

Repo target: `lasso-@serviceadmin`

## Goal

Turn the donor UI/admin analysis into a local, implementation-adjacent first-pass OpenSpec bundle for the optional Service Lasso admin UI.

## Current status

- UI starter base selected and applied: `https://github.com/satnaing/shadcn-admin`
- Core UI draft spec copied local: `SPEC-UI-ADMIN-SERVICE.md`
- Key donor UI docs copied local under `docs/reference/`
- First stub-backed UI shell created to reflect the planned route and API surface

## Current implementation slice

Implemented in this repo now:
- dashboard shell
- services list
- service detail page
- dependencies page
- runtime page
- logs page
- network page
- installed page
- operator settings page
- harness/API stub layer under `src/lib/service-lasso-api/`

## Remaining gaps

- promote the draft spec into stronger governed language once core API contracts settle
- replace stub transport with live `service-lasso` API bindings
- add real graph rendering and richer per-service diagnostics
- remove or delete more starter-only/demo areas once the Service Lasso pages fully replace them
- define packaging/runtime contract for the UI as a managed optional service

## Acceptance focus for this repo slice

- the repo stands on its own as the UI work area
- local docs explain the intended UI contract and direction
- the starter is visibly adapted to Service Lasso instead of left generic
- all first-pass API domains have explicit stubs
- the next implementation step is obvious
