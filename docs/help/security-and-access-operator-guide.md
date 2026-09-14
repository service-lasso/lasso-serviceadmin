# Security and access operator guide

The Security page is the operator readback for groups, permissions, provider
mappings, actor assignments, service-manifest secret access, and supported
secret rotation plans. It shows enforced runtime state; it does not invent or
simulate policy.

## Review access

1. Verify each actor is assigned through the intended local or identity-provider
   group.
2. Compare each group's permission keys with the Permission Catalogue, paying
   particular attention to elevated and confirmation-required actions.
3. Review provider claim mappings for unexpected overlap or priority conflicts.
4. Check Service Manifest Secret Access to confirm each service receives only
   the namespaces and operations declared by its manifest.

## Apply sensitive changes

- Preserve at least one working owner and never remove your own last effective
  security access.
- Use the runtime's preview and readiness checks before a supported rotation.
- Require current provider, policy, and audit readiness before applying a
  secret mutation.
- Follow the linked audit record after every access or rotation change.
- On Security > Rotations, keep the mixed dry-run fixture as non-mutating. Live
  migrate_remap_provider apply requires a broker dry-run, immediate
  revalidation, an audit reason, and the exact campaign id. Other campaign
  families stay plan-only and fail closed instead of reporting metadata-only
  success. Partial outcomes stay visible; retry only retry-safe operation IDs.

If the page cannot read security state, or any required readiness signal is
missing, stop the mutation and restore authoritative runtime connectivity.
