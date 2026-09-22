# SPEC-SERVICEADMIN-RESTART-DIAGNOSTICS

Status: active draft. Owner: Admin #636; Core evidence investigation #1382.

## Intent and scope

Bound the post-reload, pre-restart service-detail transition in the packaged
Broker lifecycle test: report closed readiness metadata when the
lifecycle-controls container is missing after trusted-identity unlock. A
trusted-identity unlock timeout happens earlier, before this diagnostic is
reached, so it produces no readiness snapshot and stays out of scope. This is
test-only observation, not a product UI change or proof of the historical macOS
failure's cause (Admin #636, Core #1382).

## Requirements

- `RD-001`: Observe only the Broker service-detail GET used by the loaded route,
  beginning before reload. Readiness output contains bounded request count,
  request state, valid HTTP status, service-payload presence and controls-presence
  booleans only. Late responses from superseded requests cannot replace the latest
  request's observation, and a request is closed after its first response.
- `RD-002`: Unknown fields, URL/path strings, identifiers from arbitrary inputs,
  headers, bodies, DOM text, storage, raw errors and credentials never enter the
  diagnostic. Report absent observations explicitly, not as a success.
- `RD-003`: Missing lifecycle controls still fail the existing bounded assertion.
  Do not add mutation retries, extend configured timeouts, skip confirmation,
  weaken request-count assertions, or change owned cleanup.
- `RD-004`: Cover pending, failed response, missing service, ready response,
  superseded response and adversarial metadata. Browser regression must show
  missing controls fail with closed metadata and present controls proceed, and is
  enforced by the `quality` workflow against the Vite dev server.
- `RD-005`: Full packaged lifecycle verification remains necessary on Windows,
  Linux and macOS with exact Core/Admin/Broker/harness identities. Diagnostics
  are not independent newcomer proof or GA approval.

## Evidence and completion

Record focused tests, browser fixture results, lint/format/build, exact-head CI
and the owning Core packaged workflow results in #636 and Core #1382. Preserve
the original failure and label any cause inferred from new evidence explicitly.
