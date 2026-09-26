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

## Pre-unlock observation extension (Admin #640 / Core #1382)

- `RD-006`: Attribute failure only while the existing trusted-identity unlock helper is active, distinguishing initial marker discovery from the final verified-marker assertion. Remove scoped observation on successful completion and after failure; it must not label unrelated later test failures.
- `RD-007`: Project only fixed stage codes, verified-marker and local-root-button presence booleans, and explicitly unavailable request observations. A known request may be included only after its endpoint/response contract is verified. DOM text, selectors, URLs, identifiers, credentials, headers, storage, bodies, captures and arbitrary errors are not diagnostic fields.
- `RD-008`: Preserve original failure, both existing marker assertions, their configured 20-second timeout, existing click semantics, mutation/confirmation counts and owned cleanup. No extra command retry, timeout increase, blanket failure interception or invented successful state.
- `RD-009`: Meaningful tests must prove success observation cleanup, original failure preservation, phase attribution, absent observations, exclusion of hostile/private input, and non-attribution of unrelated errors. Focused browser evidence must exercise the real helper with controlled marker states.
- `RD-010`: Complete current-head Admin gates and an owning checksum-bound Core packaged workflow on Windows/Linux/macOS remain required before diagnostic delivery closes. New closed observations may distinguish the historical pre-unlock boundary, but must not be claimed as its cause without matching evidence.