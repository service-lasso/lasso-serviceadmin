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
- screenshot path is `public/images/service-admin-ui.png`.
- repo-visible donor starter branding strings are removed from README, package metadata, page metadata, source headings, and repo docs.
- Generic Shadcn UI component-library references may remain only where they describe the UI technology stack, not donor project branding.
- Validation includes a repo-wide donor-branding scan plus standard formatting/build/test gates.
