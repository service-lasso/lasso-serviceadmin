# SPEC-CI-SECURITY-MAINTENANCE

_Status: draft_

## Scope

This spec captures small, recurring repository maintenance requirements for CI reliability and dependency security in `lasso-serviceadmin`.

## ISS-27: GitHub Actions runtime compatibility

GitHub workflow actions MUST avoid deprecated Node.js action runtimes when maintained first-party replacements exist.

Acceptance contract:

- CI, release, and validate-template workflows use current maintained first-party action majors for checkout, Node setup, artifact upload, and artifact download.
- Workflow semantics remain unchanged: same Node versions, same cache strategy, same packaging/test/release steps.
- Validation includes at least formatting plus the standard build/test gates, and PR CI must run cleanly.

## ISS-28: npm vulnerability hygiene

The npm dependency graph MUST be kept free of the currently reported Dependabot/npm-audit vulnerabilities when compatible patched versions are available.

Acceptance contract:

- Direct dependency ranges are updated only where needed to select patched versions.
- `package-lock.json` and `pnpm-lock.yaml` remain committed and consistent with the updated dependency graph.
- `npm audit` must not report the current `axios`, `follow-redirects`, or `postcss` vulnerabilities after the fix.
- Standard build/test gates must continue to pass.

## ISS-29: supported Admin dependency baseline

Service Admin MUST keep a mutually compatible dependency set for its pinned
TypeScript, ESLint, and TanStack Table usage so normal development and release
qualification can complete without weakening checks.

Acceptance contract:

- `package.json` and `pnpm-lock.yaml` resolve TypeScript `5.9.3` with a
  supported `typescript-eslint` release and TanStack Table v8 APIs used by the
  application.
- The calendar uses the supported react-day-picker v10 `month_grid` component
  key.
- Frozen installation, lint, production build, and production dependency audit
  pass on the exact PR head.
- The existing cross-platform package and real-Broker qualification checks
  stay enabled; a successful build is not a substitute for those checks.

## ISS-641: preserve the Table v8 application contract

The #629 dependency update selected Table v9 while current UI source still uses v8 APIs, producing 591 compiler errors on unchanged develop 500485f7fbf10c813f4a9d7bf3013d83aed548db. Restore package/lock selection to the available supported v8 line and keep a package-specific Dependabot major-update guard until a separately governed source/spec migration is delivered. Keep production and tooling audit gates enabled; the guard is not a security exemption. Verify frozen install, lint/format, build, unit tests and complete hosted gates on the exact head, then integrate through develop into blocked diagnostic #640.

The #641 macOS real-Broker gate currently reports HTTP 200/service present but no lifecycle controls after trusted unlock. Existing test-only readiness diagnostics may project fixed booleans for visible skeleton, service-not-found, general error and page-not-found render states. Never retain DOM text or response values; preserve the original assertion and default timeout. This observation supports baseline qualification and does not prove the original #1382 pre-unlock cause or relax any browser gate.

## ISS-651: complete captured Cypress output before interpreting exit

The qualification harness must await closure of the Cypress child's captured
stdout/stderr before publishing those bounded buffers and interpreting its exit
code. An `exit` event alone is insufficient evidence that the pipes have drained.
Use the existing qualification timeout for the whole wait; no extra drain budget.

Acceptance contract:

- Preserve the exact exit code, including nonzero and signal/null outcomes.
- Late pipe output is retained, bounded and checked by the existing private
  material guard before publication. Add no arbitrary debug or environment logs.
- Live/unfinished streams at the deadline remain a failed qualification; remove
  observation listeners/timers without waiving cleanup or extending timeouts.
- Real-child regression fixtures must demonstrate late output after process
  exit, retained nonzero status, signal/null status, and deadline failure.
- Keep runner lifecycle waits unchanged; this requirement concerns Cypress
  captured output only. Include focused tests in every real-Broker CI lane.
- This repairs an independently reproducible observation defect. Cypress's
  passed-spec/exit-1 cause remains unresolved until complete evidence proves it;
  do not reclassify a passing summary as a successful qualification.

## ISS-651: distinguish Cypress CLI and executable exit

A first-run spec at Core 4537fc8 passed before CLI exit 1 despite complete pipe
capture. Before attributing the cause, a Node preload may observe exit and close
outcomes of Cypress executable children spawned by the existing CLI. The CLI can
finish on exit before close; record the event kind without keeping it alive. Forward the
original spawn call unchanged; add no child, timer, mutation, retry or debug flag.
Preserve unhandled error behavior, caller listeners and outer CLI exit status.

The observation is capped at eight events per invocation and contains only a
fixed schema, smoke-test/run phase, exit/close event kind, closed exit code or unavailable state, and
null/allowlisted signal. Never retain executable paths, PID, arguments, options,
environment, errors, arbitrary output or test/runtime state. Unknown outcomes
remain explicit and never become success. Tests must prove delegated arguments
and child identity, unrelated-child exclusion, original nonzero/signal/error
behavior, privacy/cap boundaries and real-child CLI/executable status separation,
including a CLI that terminates on the executable's exit event.
Full current-head Admin and owning three-platform Core qualification are required.
This is causal observation only; no passing-summary or exit-status waiver.

## ISS-1504: classify post-acceptance Cypress runner results

Core #1504 retains a macOS packaged lifecycle attempt where the lifecycle spec
printed one passing test and zero failures, then the nested Cypress executable
closed with exit code 1. The existing child provenance establishes the nested
process boundary but does not retain Cypress's structured run result before
that exit.

The lifecycle-only Cypress configuration may emit one metadata-only `after:run`
summary before the executable outcome is interpreted. It must contain only a
fixed availability state and bounded aggregate test counts (total, passed,
failed, pending, and skipped). It must never retain spec names, paths, browser
metadata, error text, screenshots, video, test titles, configuration, requests,
responses, environment, or private material.

The summary is causal observation only: it must not alter Cypress event
registration, exit status, test assertions, timeouts, retries, artifacts,
mutations, or cleanup. It must tolerate missing or malformed Cypress results by
recording `unavailable`, and it must be included in the existing bounded failure
diagnostic only for a terminal qualification failure. Focused tests must prove
lifecycle scoping, one-record capping, private-input exclusion, complete count
projection, unavailable projection, and that observer sink failure cannot
replace the original Cypress outcome. A natural exact-head three-platform
packaged lifecycle result remains required; this diagnostic alone does not
attribute ownership or qualify release, promotion, or GA.
