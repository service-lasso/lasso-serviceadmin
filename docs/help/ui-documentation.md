---
title: Service Admin UI guide
description: A route-by-route operator guide to the Service Admin interface.
status: mixed runtime-backed and metadata-only surface
tags: navigation, services, runtime, secrets, troubleshooting
---

# Service Admin UI guide

Service Admin is the browser console for a local Service Lasso runtime. Open its
configured Service Admin URL, then use the sidebar to move between the operator
surfaces. A page may be **runtime-backed** (reads Core through the same-origin
`/api` proxy), **metadata-only** (safe local/UI metadata), **preview**, or
**unavailable**; do not treat a visual status as durable unless the page states
that it is runtime-backed.

## First launch and navigation

1. Open Service Admin at the URL reported by the Core demo/proof summary.
2. Start with **Dashboard**. If it cannot load, open **Runtime**; a banner that
   says the runtime is unavailable means the UI has no usable runtime data.
3. Use the left navigation: **Services**, **Dependencies**, **Routes**, **Logs**,
   **Runtime**, **Installed**, **Variables**, **Network**, **Operations**,
   **Secrets Broker**, **Settings**, and **Help Center**.
4. Use the page toolbar and contextual Help links where present. A disabled
   control states the prerequisite or permission that prevents the action.

## Core operational workflow

1. In **Dashboard**, read runtime health, warnings, service totals, and Broker
   posture. A warning is a prompt to investigate, not proof of failure.
2. Open **Services**, use its search/filter/sort controls, then select the exact
   service row to open its detail page.
3. On a detail page, review status, dependencies, endpoints, health, setup and
   recent lifecycle evidence before selecting **Start**, **Stop**, **Restart**,
   install/configuration or update actions that the runtime exposes.
4. Confirm a risky action when the dialog asks. Cancellation leaves the current
   state unchanged. Validation text identifies missing inputs or authority.
5. Refresh the detail page and Dashboard, then check **Logs** or **Runtime** to
   confirm the resulting runtime state. A toast alone is not confirmation.

## Page reference

| Page / route | Purpose and key controls | State handling |
| --- | --- | --- |
| Dashboard `/` | health summary, alerts, recovery links | loading/unavailable banner; verify by Runtime refresh |
| Services `/services` and `/services/:id` | search, filters, sorting, detail and lifecycle actions | empty results, disabled actions, confirmation/cancel, error/recovery |
| Dependencies `/dependencies` | dependency/secret-ref relationships | metadata may be incomplete; open service detail for action evidence |
| Service Routes `/service-routes` and Network `/network` | configured endpoint/host/port metadata and open links | configured route is not a reachability proof |
| Logs `/logs` | source selection, bounded log reading, filtering | empty/loading/read errors; never paste sensitive logs |
| Runtime `/runtime`, Installed `/installed` | runtime identity, readiness and installed metadata | use runtime health to distinguish UI and Core failures |
| Variables `/variables` | global/service variable and SecretRef posture | raw secret values are not displayed |
| Operations `/inbox`, `/operations/telemetry`, `/operations/audit-logging` | durable notices, safe telemetry/audit metadata | Inbox read/hide/restore changes should be refreshed |
| Secrets Broker `/secrets-broker/*` | setup, inventory, providers, topology, policy, diagnostics and guarded workflows | permission, confirmation, lockout, unavailable-provider and recovery states are explicit |
| MCP `/mcp`, Security `/security` | safe MCP/security posture | configuration and mutations remain runtime-authorized |
| Settings `/settings/*` | appearance, display, account and notifications preferences | some preferences are local/metadata-only |
| Apps, Chats, Tasks, Users | available product workspace surfaces | empty and unavailable states are honest; do not infer a backend action |
| Help Center `/help-center` | local operator guides and document search | no-match state says **No docs matched the current search** |
| Sign-in, sign-up, OTP, forgot password and `/401`–`/503` | authentication and error paths | availability depends on configured identity provider; do not enter secrets in screenshots |

## Secrets Broker safety

Open **Secrets Broker** only when you need its constrained workflow. Inventory,
providers, topology, diagnostics, configuration, audit events, backup keys and
operational controls are distinct routes. Reveal, mutation, decommission,
rotation, policy and provider actions require the runtime’s trusted actor and
may require a one-time confirmation. Copy only safe identifiers, outcomes and
timestamps into support evidence; never copy a value, recovery material,
credential, token, private key or raw request/log payload.

## Troubleshooting

- **Blank, loading or unavailable page:** open **Runtime**, refresh, and verify
  the Core `/api/health` endpoint through the configured same-origin proxy.
- **Action disabled:** read its adjacent explanation; typical causes are missing
  permission, unhealthy dependency, unsupported lifecycle capability or a
  required confirmation.
- **Service is healthy but unreachable:** compare **Network** and **Service
  Routes**, then test the advertised interface separately.
- **No results:** clear search/filter controls; this is not a service failure.
- **Need durable evidence:** refresh after a lifecycle action, then record the
  resulting service/runtime status and any operation/audit identifier.

## Glossary

- **Runtime-backed:** data returned by Service Lasso’s runtime boundary.
- **Metadata-only:** safe descriptive data; it does not prove a live action.
- **SecretRef:** a reference to secret material, never the material itself.
- **Provider:** a service that prepares a runtime dependency rather than a
  continuously managed daemon.
- **Operation id:** safe identifier for a durable action outcome.
