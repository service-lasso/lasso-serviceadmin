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
- `RD-011`: For the retained post-unlock HTTP-200/skeleton observation under Core #1382, distinguish upstream response observation from completed browser delivery using Cypress's existing `response` and `after:response` events. Record only a closed unobserved/pending/complete delivery state. Preserve first-response semantics, ignore stale or unmatched delivery events, and reset delivery state for each new request. Retain no responses, headers, content or paths; return no promise and modify no response. Preserve the original assertion, command timeout, mutation count and failure. Completed network delivery is not proof of application query or render completion. Verify state ordering, stale/duplicate events and privacy before full exact-head qualification.
- `RD-012`: At the exact post-provider-validation, pre-restart-click reload and trusted-unlock call inside `restartBrokerFromUi`, a failure observer may retain one seven-field allowlisted receipt (`schema`, `status`, `present`, `verified`, `localRoot`, `loading`, `unavailable`). The observer queues no Cypress command and preserves the original assertion. The owning spec's `afterEach` may deliver that receipt through an existing task; Node `after:spec` emits it only when Cypress itself reports a failed test. No assertion text, error, DOM, network object, URL, token, path, screenshot, raw response, or duplicate receipt is accepted. The controlled Electron proof must execute the real Core/Broker provider-validation journey, then force only the next trusted-identity transport through its actual query lifecycle. It retains the actual nonzero Cypress result and final Node failure envelope, and proves that no restart control click, confirmation click, or restart POST follows the failed precondition. It must not rewrite the DOM, pre-seed a receipt or causal snapshot, simulate provider acceptance, or classify the historical runtime cause.
- `RD-013`: The legacy seven-field receipt remains a closed v1 compatibility object. A separate exact-key v2 diagnostic envelope may pair that receipt with one causal snapshot containing only a bounded sequence and the fixed request, contract, query, and render enums. The Cypress producer, task recorder, stdout/stderr parser, and final Node failure builder must all validate the same nested contract. Unknown, duplicate, inherited, getter-backed, oversized, or malformed causal values are discarded; the envelope retains no DOM, response, credential, URL, path, error, or raw output material.
- `RD-014`: Causal observation distinguishes transport delivery from normalizer/contract rejection, TanStack Query's actual settled or failed state, and the rendered identity-gate surface. The request function does not claim query settlement. Preserve the existing query key, credentials, stale time, retry policy, assertion timeouts, and request behavior; no sleep, reset, retry, or fixture is added to manufacture a state.
- `RD-015`: Before any candidate build or test, qualification supplies three distinct literal runtime paths for workspace, instance registry and host-port registry beneath a fresh external root, then creates an exclusive initial custody receipt without overwriting prior state. The controlled provider-validation path records a distinct controlled-negative outcome and a private hash-only sidecar with actual Admin runtime/Core runner/Broker hashes, sizes, OS-observed PID/PPID birth and terminal-close pairs, and per-run nonce binding. The provider control is an authenticated private capability: its nonce never enters the public ready receipt, and the private armed/consumed pair binds the public ready correlation nonce with the exact Core/Admin heads and trees. It must never emit generic positive verification for a controlled failure, expose paths or diagnostics, infer a terminal close from generic child observer events, or force an owned process to exit as proof.

## Current qualification pin

The three-platform current qualification workflow pins Core
`4e5ec88a4f79d38b75f95b7fe20e24787b5c6c12`. Core
`712fd7c71ee9a46de9703ebaeaa2f4b5287e7e6a` remains retained original #1555
failure-comparison evidence only. Neither pin by itself is a release claim;
the complete current Admin/Core/Broker tuple and all three platform artifacts
remain required by `RD-010`.
