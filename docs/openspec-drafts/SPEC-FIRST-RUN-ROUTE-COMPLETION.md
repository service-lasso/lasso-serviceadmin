# SPEC-FIRST-RUN-ROUTE-COMPLETION

_Status: review pending; records the existing #623 contract_

## Intent and scope

Admin issue #622 owns setup-status loading completion for authenticated routes.
Core issue #1281 owns the capture packet. This record names existing behavior;
it introduces no new product behavior or release/publication authority.

## Requirements

- **FR-1**: While setup status is pending, retain the loading state. A failed or
  malformed setup-status result must render the existing retryable unavailable
  state, rather than a permanent skeleton over authenticated routes.
- **FR-2**: Successful setup status must preserve setup-required and protected
  enrollment behavior. Only a runtime-confirmed ready vault with setup mode off
  may release the authenticated shell. Never bypass setup or trust failures.
- **FR-3**: In an isolated owned source runtime with the supported API base and
  proxy configuration, `/`, `/services` and `/help-center` must render after
  their successful responses at exactly 1440 × 1024.
- **FR-4**: Verification must retain source revisions, route/capture receipt,
  masked images, archive hash, cleanup outcome and configuration boundaries.
  Source replay is not released-package or independent GA acceptance.

## Evidence mapping and remaining acceptance

| Requirement | Existing evidence | Limit or remaining action |
| --- | --- | --- |
| FR-1 | Merged Admin PR #623 (`c48f8d89b9eb0bc11b94b123acf68d74f0e3ac5d`); `src/test/first-run-setup.test.tsx`, retryable setup-status failure regression | Verify this specification and current-head required checks before closure. |
| FR-2 | Existing protected local enrollment, authorized remote bootstrap and fail-closed remote-policy regressions in the same test file | Preserve all trust and non-success behavior; no new exemption. |
| FR-3 | [Literal replay receipt](https://github.com/service-lasso/lasso-serviceadmin/issues/622#issuecomment-5851691254), 40 read-only routes and three inspected captures | Services horizontal clipping is a stated layout limitation. |
| FR-4 | Core PR #1441 records exact candidates, receipt, cleanup and redacted archive hash | Shareable archive attachment awaits upload approval; Core acceptance reconciliation remains open. |

The original skeleton observation lacked the required source API-base
configuration. A later configured replay rendered successfully, so this record
does not attribute that observation to a confirmed product regression. PR #623
separately repaired failure-before-missing-data ordering in the setup gate.
Retain both findings and the historical failed observations.

The successful literal replay used Core
`cdb877a16e005e5e9e70214192585d0cdd7ec6c3` and Admin
`a3c972e881a1c781f7a7cc3d411e3e0b02981ab8`, from
2026-09-27T01:37:22.457Z to 01:38:29.306Z. The inspected archive is 543,390
bytes, SHA-256
`58934b7fb8c8c849ab52853aed4598df32904b92cd1defba68e7c0bc88df7d13`.
No private logs, DOM snapshots, state or credentials are included. The packet
is not claimed published while attachment approval is pending.

Issue #622 remains open until review, evidence linkage and its current-head
required checks are reconciled. This specification does not authorize closing
Core #1281 or claiming deployment, release, cross-platform GA or publication.
