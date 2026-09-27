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
