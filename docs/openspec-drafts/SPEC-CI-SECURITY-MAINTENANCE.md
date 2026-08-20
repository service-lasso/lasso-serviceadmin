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
