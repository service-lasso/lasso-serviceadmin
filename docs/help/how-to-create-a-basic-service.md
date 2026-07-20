# How to Create a Basic Service

Use this guide when you are adding a Service Lasso managed service from an
existing app, script, binary, or local runtime. The goal is a small
`service.json` that Service Lasso can discover, start, stop, monitor, and show
clearly in Service Admin.

For the full field reference, see [`service.json` Reference](../service-json-reference.md).

## 1. Create the service folder

Each managed service lives in its own folder under the configured services root.
The folder name should match the stable service id.

```txt
services/
  my-service/
    service.json
    runtime/
    config/
    data/
    logs/
    work/
```

Keep package files, startup scripts, templates, and default config in this
folder. Keep generated state, local credentials, large logs, and machine-only
artifacts out of source control unless the service contract explicitly says
otherwise.

## 2. Start with a minimal `service.json`

A useful first manifest declares identity, operator metadata, lifecycle actions,
runtime execution details, dependencies, environment, and health.

```json
{
  "id": "my-service",
  "name": "My Service",
  "description": "Runs the local My Service worker.",
  "enabled": true,
  "version": "0.1.0",
  "logoutput": true,
  "icon": "server",
  "servicetype": 50,
  "servicelocation": 10,
  "actions": {
    "install": {
      "description": "Prepare folders and install the runtime payload."
    },
    "config": {
      "description": "Write effective config from service variables."
    },
    "start": {
      "description": "Start My Service."
    },
    "stop": {
      "description": "Stop My Service gracefully."
    }
  },
  "execconfig": {
    "serviceorder": 100,
    "serviceport": 8080,
    "execcwd": "runtime",
    "executable": "my-service",
    "env": {
      "MY_SERVICE_PORT": "8080"
    },
    "depend_on": [],
    "healthcheck": {
      "type": "process"
    }
  }
}
```

Treat this as the small starting shape, not the whole possible schema. More
advanced packages may add secondary ports, URL metadata, provider relationships,
global environment reuse, install archives, or specialized health checks.

## 3. Name the service consistently

Use one stable id everywhere:

- `services/<service-id>/` folder name
- `service.json` `id`
- package/runtime labels
- Service Admin search terms and operator docs

Prefer lowercase kebab-case ids such as `my-service` or
`image-resizer-worker`. Use `name` for the human-facing label, and keep
`description` short enough to scan in Service Admin.

## 4. Define lifecycle actions

Service Admin exposes service actions as operator commands. A first service
usually needs:

- `install`: create folders, copy templates, or fetch a pinned runtime payload
- `config`: materialize config from explicit settings and variables
- `start`: launch the runtime
- `stop`: stop the runtime cleanly
- `restart`: optional, when the service has a safe restart path

Keep action labels clear and avoid destructive behavior behind vague names.
When an action is unavailable, Service Admin should make that state obvious to
the operator.

See [Service Actions](service-actions.md).

## 5. Describe runtime and provider relationships

Use `execconfig` for the execution contract:

- `execcwd`: working directory relative to the service folder
- `executable`: binary, script, or executable key used to launch the service
- `serviceorder`: startup order hint; lower-order dependencies should be ready
  first
- `serviceport`: primary port when the service exposes a local endpoint
- `env`: service-local variables that should be resolved before launch
- `depend_on`: services or providers that must exist before this service starts

If another managed service provides the runtime, such as Node, Python, or Java,
record that provider relationship rather than hiding it in a host-machine path.
That helps dependencies, startup order, Variables, and troubleshooting stay
visible.

## 6. Add health checks

The recommended baseline is:

1. Use `process` health for the first manifest when process presence is enough.
2. Add an HTTP or TCP check when the service exposes a readiness endpoint or
   port.
3. Add a dependency-specific readiness check when the service can be running but
   not usable yet.

Common health models include:

| Type | Use when |
| --- | --- |
| `process` | The process running is the useful health signal. |
| `http` | The service has a health or readiness URL. |
| `tcp` | A socket accepting connections is the readiness signal. |
| `file` | A generated file proves setup or runtime readiness. |
| `variable` | A resolved variable or generated URL proves readiness. |

Failed checks should map to clear operator states: `healthy`, `warning`, or
`critical`.

See [Health Checks](health-checks.md).

## 7. Record ports, URLs, and exposure

Use `serviceport` for the primary local port. More complex services may also
declare secondary, console, debug, route, or URL metadata. Keep local-only,
LAN-only, and externally reachable endpoints distinct so Network does not imply
public reachability without proof.

After setup, validate endpoint metadata in the Network surface and service
details. If a service is healthy but unreachable, check host, port, route, and
provider metadata together.

See [Product Status and Safety](product-status-and-safety.md) for the current
Network and route posture rules.

## 8. Record install, config, data, log, and work paths

Service Admin's Installed view is only useful when the manifest and service
metadata make paths explicit. Record:

- install path
- manifest path
- config path
- data path
- log path, when logs are available
- work/cache path, when generated runtime state matters

Keep versioned defaults separate from machine-specific values. Put local
overrides in config or variables, not hard-coded examples.

See [Service Install and Setup Config](service-install-and-setup-config.md).

## 9. Declare variables deliberately

Use `execconfig.env` for service-local environment variables. Use global
variables only for values intentionally shared across services, then reference
those shared values from service configs where possible.

Operators should be able to tell which variables belong only to this service and
which are reused elsewhere.

See [Environment Variables: Global and Service Reuse](environment-variables-global-and-service-reuse.md).

## 10. Validate in Service Admin

After adding or updating the service:

- Open **Services** and confirm the service appears with the expected name,
  status, description, and action availability.
- Open the service detail page and confirm actions are labeled clearly.
- Open **Runtime** and confirm the process, provider, startup order, and health
  state match the manifest.
- Open **Network** and confirm ports, URLs, routes, and exposure match the
  service contract.
- Open **Installed** and confirm install, manifest, config, data, log, and work
  paths are visible where applicable.
- Open **Variables** and confirm service-local and global variables are scoped
  correctly.
- Run `install`, `config`, `start`, `stop`, and `restart` only where those
  actions are intentionally supported.

## Common mistakes

| Mistake | How it appears in Service Admin |
| --- | --- |
| `id` does not match the folder or package identity | Duplicate-looking services, missing details, or confusing search results. |
| Missing `actions.start` or unclear action metadata | Operators cannot confidently start the service or understand why an action is unavailable. |
| Host-specific absolute paths in examples | Installed paths look valid on one machine and broken on another. |
| Dependency omitted from `depend_on` | The service starts before its provider and fails with a runtime or readiness error. |
| Port declared incorrectly | Network shows the wrong endpoint or the service is healthy but unreachable. |
| Using `process` health when the app needs readiness | Runtime shows healthy while the app still cannot serve requests. |
| Secrets embedded in `env` examples | Variables or support bundles risk exposing values that should be managed separately. |
| Generated state committed with the package | Install and runtime behavior differ between clean machines and the author machine. |

Start small, validate the UI, then add advanced manifest fields only when the
operator surface needs them.
