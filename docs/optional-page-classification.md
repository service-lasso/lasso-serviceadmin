# Optional Page Classification

Service Admin keeps operator pages that are local to the current on-prem instance. Pages that require a remote fleet model, an external identity facade, or a future multi-tenant control plane are not first-class Service Admin product surfaces.

## Current Product Surfaces

- Dashboard, Services, Dependencies, Logs, Inbox, Runtime, MCP, Installed, Variables, Network, Security, Settings, and Help Center remain local operator surfaces.
- Security may show identity-related metadata only when it is needed to explain local permissions, policy, or access grants.

## Retired Or External Surfaces

- Fleet Overview is out of product for the on-prem-now Admin. Remote instance inventory, broker fan-out, LAN discovery, and multi-instance controls need a separate product decision before any Service Admin page owns them.
- ZITADEL Sessions is external to Service Admin. Session lifecycle, login journeys, and identity-provider session metadata belong to `lasso-zitadel` or a consuming app facade.
- `/users` is a compatibility route only. It redirects to Security and must not present a user-management or ZITADEL Sessions workflow.
- `/auth-session` and `/fleet-overview` must not be reintroduced as routable operator pages.

## Reintroduction Rule

A retired or external surface can return only through a new issue that names the owning service, user workflow, runtime contract, and validation path. Hidden sidebar entries or placeholder routes are not enough to make a page part of the product.
