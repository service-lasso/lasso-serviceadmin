# Fleet Overview Planning

Fleet Overview is retired from Service Admin's on-prem-now product surface.

## Decision

Service Admin operates the local Service Lasso instance. Multi-instance fleet inventory, remote broker access, LAN discovery, and cross-node control are outside the current Admin product boundary.

## Current Route Contract

- `/fleet-overview` must not exist as a Service Admin operator route.
- Placeholder remote instances, planning cards, and instance selector coupling must not be added to the app shell.
- Existing local operator navigation should stay focused on the current runtime, services, dependencies, logs, network, and security views.

## Future Work

Reintroducing fleet capabilities requires a new owning issue and a concrete runtime contract that covers instance discovery, trust boundaries, broker access, failure states, and validation. Until then, docs and tests should treat Fleet Overview as dropped rather than deferred inside Admin.
