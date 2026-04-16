# How to Create a Basic Service

This is the minimum flow for adding a new Service Lasso managed service.

## 1) Create a service folder

Create a service directory with your runtime files and a `service.json` manifest.

Example:

```txt
services/
  my-service/
    service.json
    bin/
    config/
    data/
```

## 2) Add service metadata

In `service.json`, define the service identity and runtime basics:

- `id`
- `name`
- `serviceType`
- `runtime`
- `version`
- `build`

## 3) Define runtime commands

Provide start/stop/restart-compatible execution details so the manager can control lifecycle.

## 4) Add health checks

Use one or more health checks so the service can report healthy/warning/critical status.

## 5) Validate in Service Admin

After wiring the service:

- confirm it appears in **Services**
- confirm runtime state in **Runtime**
- confirm endpoints in **Network**
- confirm install/config/data paths in **Installed**
