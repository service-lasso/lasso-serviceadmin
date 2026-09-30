# SPEC-SERVICEADMIN-SERVICE-ACTIONS

_Status: active draft_

## Intent

Service Admin must present Core-owned lifecycle controls consistently wherever
an operator can act on one service. The UI cannot infer authorization or a
state transition; Core remains the source of truth for permission, explicit
confirmation, execution, and resulting state.

## Scope

- Service Details lifecycle action controls.
- Services table lifecycle controls for `start`, `stop`, and `restart`.
- Runtime-projected permission, confirmation, and bounded post-action refresh.

## Out of scope

- Changing Core permission rules, confirmation policy, or lifecycle endpoints.
- Bulk runtime actions and service-specific non-lifecycle controls.
- Packaged release qualification.

## Requirements

- `SA-001`: The Services table and Service Details use one shared lifecycle
  action path for runtime-advertised service actions.
- `SA-002`: When Core projects `requiresConfirmation`, the action opens
  **Confirm elevated action** before any lifecycle request. Only accepting that
  dialog sends `confirm: true`.
- `SA-003`: Cancelling confirmation sends no lifecycle request and leaves the
  displayed service state unchanged.
- `SA-004`: A Core-denied action stays disabled and cannot open confirmation or
  submit a request.
- `SA-005`: Table controls preserve row click isolation, existing lifecycle
  styles, and one pending guard across Start, Stop, and Restart.
- `SA-006`: After a lifecycle request settles, the dashboard summary, services
  list, and affected detail query refresh from Core. The UI does not predict a
  lifecycle state transition.

## Acceptance Criteria

- Confirmed table Stop sends the Core lifecycle request with `confirm: true`
  only after the dialog is accepted, then the resulting service state is
  refreshed from Core.
- Cancelled and Core-denied table Stop submit no request.
- Existing detail lifecycle confirmation behavior remains covered by the same
  shared control.
- Focused tests cover confirmation, cancellation, denial, row click isolation,
  pending coordination, and bounded lifecycle-view refresh.

## Evidence

- `src/components/service-lifecycle-action-button.test.tsx`
- `src/features/service-detail/service-action-button.test.tsx`
- `src/lib/service-lasso-dashboard/lifecycle-action-hook.test.tsx`
- `src/lib/service-lasso-dashboard/stub.test.ts`
- `pnpm lint`, focused Vitest, `pnpm format:check`, and `pnpm build`
