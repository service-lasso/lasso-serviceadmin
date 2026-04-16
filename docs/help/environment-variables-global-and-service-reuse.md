# Environment Variables: Global and Service Reuse

Service Lasso supports service-scoped and global variable patterns.

## Scope types

- `service` scope: only for one service
- `global` scope: reusable across multiple services

## Recommended pattern

1. keep shared values as global variables
2. keep service-specific values in service scope
3. reference global values from service configs where possible

## Why this matters

This reduces duplication and makes updates safer when multiple services share the same value.

## Operator view

In Service Admin Variables page, operators should be able to:

- search keys/values
- filter by scope
- sort columns
- identify which services consume each variable
