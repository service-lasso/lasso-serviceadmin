# SPEC-SERVICEADMIN-REPO-IDENTITY

_Status: draft_

## Scope

This spec captures repository identity and branding requirements for `lasso-serviceadmin` / `@serviceadmin`.

## ISS-43: remove donor dashboard branding

The Service Admin repo MUST present itself as Service Admin UI / Service Lasso, not as its original dashboard starter.

Acceptance contract:

- README is Service Admin-specific and documents service identity, runtime API configuration, validation, packaging, release shape, and agent notes.
- HTML metadata uses Service Admin UI / Service Lasso title, description, URLs, and image path.
- package metadata uses the Service Admin package identity and Apache-2.0 license metadata.
- Social previews reuse `public/images/brand/service-lasso/web-app-manifest-512x512.png`; an extra dashboard screenshot is not required (issue #614).
- repo-visible donor starter branding strings are removed from README, package metadata, page metadata, source headings, and repo docs.
- Generic Shadcn UI component-library references may remain only where they describe the UI technology stack, not donor project branding.
- Validation includes a repo-wide donor-branding scan plus standard formatting/build/test gates.

## ISS-44: complete operator UI documentation

Service Admin MUST ship its detailed, user-goal-oriented UI documentation in
`docs/help/`, where the in-app Help Center can load it. Core may link to this
documentation but must not duplicate page- or control-specific instructions.

Acceptance contract:

- The documentation inventories implemented routes, significant controls, and
  meaningful state classes, and distinguishes runtime-backed, metadata-only,
  preview, and unavailable behavior.
- It includes task guides, troubleshooting, glossary, a coverage matrix, and a
  maintainer capture-refresh guide.
- Screenshot assets are real captures from a task-owned default-stack instance;
  their manifest records route, state, reproduction, viewport, date, and exact
  Core/Admin identity without credentials or raw sensitive data.
- Each documented workflow states how to reach it, prerequisites/permissions,
  exact visible labels, expected confirmation, and relevant empty, loading,
  validation, cancellation, error, and recovery behavior.
- Documentation changes are verified by the Admin build/lint conventions and
  the Core Docusaurus build that links to the integrated entry point.

## ISS-45: consume canonical reader guides as packaged offline help

Service Admin MUST lead newcomers to the canonical Service Lasso reader
guides while retaining a verified offline Help Center copy for installed or
disconnected use.

Acceptance contract:

- The README links to the Core demo quick start and the canonical reader-guide
  entry points rather than maintaining a competing guide set.
- Each packaged Help Center article has a source path, exact immutable Core
  revision, and SHA-256 checksum in `docs/help-source.json`.
- The Help Center remains usable from the packaged Admin application without
  network access. Central links may open when the operator has connectivity.
- `pnpm docs:check` rejects an independently edited, missing, or untracked
  packaged article, and CI runs it before build completion.
- A refresh is generated from a reviewed Core checkout with
  `scripts/export-admin-help.mjs`; the generated articles and manifest are
  committed together.
