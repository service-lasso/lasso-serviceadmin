# service.json environment reference

This reference describes the `env` and `globalenv` behavior used by the
Service Lasso runtime.

## Supported value shapes

`env` and `globalenv` are JSON objects whose values may be strings or arrays of
non-empty strings.

```json
"env": {
  "SIMPLE_VALUE": "hello",
  "SERVICE_URL": "http://127.0.0.1:${SERVICE_PORT}/",
  "PATH": [
    "${PYTHON_HOME}",
    "${NODE_HOME}",
    "${SERVICE_ROOT}/bin"
  ]
}
```

The spawned process environment is always a string map. String values stay
strings after selector resolution. Array values resolve each entry, then join
with the runtime platform path delimiter: `;` on Windows and `:` on macOS/Linux.

## Selector resolution

Selectors use `${...}`. The runtime resolves selectors in `env`, `globalenv`,
command lines, health checks, setup/config materialization, and other
service-owned text fields that use the Service Lasso variable resolver.

Common local selectors:

| Selector | Meaning |
| --- | --- |
| `SERVICE_ID` | Service manifest id |
| `SERVICE_PORT` | Resolved canonical service port |
| `SERVICE_ROOT` | Canonical service package root |
| `SERVICE_PATH` | Compatibility alias for `SERVICE_ROOT` |
| `SERVICE_STATE_ROOT` | Runtime state root for the service |
| `SERVICE_DATA_PATH` | Service-local `data` directory |
| `SERVICE_EXECUTABLE_HOME` | Installed artifact root when present, otherwise `SERVICE_ROOT` |
| `SERVICE_ARTIFACT_ROOT` | Extracted artifact root when a release artifact is installed |
| `SERVICE_ARTIFACT_COMMAND` | Installed artifact command path when the artifact declares one |

Endpoint selectors use `endpoint.<id>.<field>`, for example
`${endpoint.web.port}`.

Secrets Broker selectors must be dotted, for example `${database.PASSWORD}`.
Bare selectors such as `${PASSWORD}` are local selectors only. They never fall
through into broker namespaces.

## Unresolved selectors

If a selector cannot be resolved, Service Lasso reports an unresolved selector
diagnostic and preserves the unresolved token in the rendered value. This keeps
misconfigured manifests visible before launch and prevents accidental empty
environment values.

Resolve the diagnostic by adding the missing `env` or `globalenv` value,
declaring the provider dependency that exports the value, or adding the explicit
broker import for dotted broker selectors.

## env vs globalenv

Use `env` for values owned by one service. These values are easiest to review
and do not ambiently affect other services.

Use `globalenv` only for bounded compatibility values that are safe to share,
such as runtime provider tool roots or script paths. New secret flows should not
use `globalenv`; map secrets into service-local `env` keys through explicit
broker imports.

```json
"broker": {
  "imports": [
    {
      "namespace": "shared/database",
      "ref": "database.PASSWORD",
      "as": "DB_PASSWORD",
      "required": true
    }
  ]
},
"env": {
  "DB_PASSWORD": "${database.PASSWORD}"
}
```

## Provider path exports

Runtime providers should export concrete path variables from their own
manifests. Consumers should depend on the provider before referencing those
names.

Example provider export:

```json
"id": "@python",
"role": "provider",
"globalenv": {
  "PYTHON_HOME": "${SERVICE_ARTIFACT_ROOT}",
  "PYTHON_SCRIPTS_PATH": "${SERVICE_ARTIFACT_ROOT}/Scripts",
  "PYTHON_USERBASE_PATH_SCRIPTS": "${SERVICE_ROOT}/__packages__/Python311/Scripts"
}
```

Example consumer env:

```json
"execservice": "@python",
"depend_on": ["@python", "@node"],
"env": {
  "PYTHONPATH": "${PYTHON_HOME}",
  "PYTHONUSERBASE": "${SERVICE_ROOT}/__packages__",
  "PATH": [
    "${PYTHON_HOME}",
    "${PYTHON_SCRIPTS_PATH}",
    "${PYTHON_USERBASE_PATH_SCRIPTS}",
    "${SERVICE_ROOT}/__packages__/Python311/Scripts",
    "${NODE_HOME}"
  ]
}
```

Provider variables such as `NODE_HOME`, `PYTHON_HOME`,
`PYTHON_SCRIPTS_PATH`, and `PYTHON_USERBASE_PATH_SCRIPTS` are not derived for
every service. The provider that owns the runtime must export them.

## Portable authoring rules

- Keep ordinary service values in `env`.
- Keep shared tool paths in provider-owned `globalenv`.
- Use `SERVICE_ROOT` in new examples; keep `SERVICE_PATH` only for compatibility.
- Use `/` in manifest examples unless a Windows-only command requires `\\`.
- Use arrays for path-list values instead of hard-coding `;` or `:`.
- Do not rely on uncontrolled host environment leakage.
- Do not include raw secrets in docs, manifests, diagnostics, or screenshots.
