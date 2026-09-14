# Help Center documentation synchronization

Edit reader guides in service-lasso/docs/components/service-admin. This repository bundles offline copies; do not edit them independently.

From a reviewed Core checkout, run:

```sh
node scripts/export-admin-help.mjs --target=/path/to/lasso-serviceadmin
node scripts/export-admin-help.mjs --target=/path/to/lasso-serviceadmin --check
```

Commit the generated articles and docs/help-source.json together in an Admin PR. The manifest records the Core revision and article checksums. `pnpm docs:check` rejects independent edits and extra untracked articles; CI runs this before building. Refresh from a committed Core revision so the source identity is reproducible.

Article content remains available offline. Links to deeper reference pages open the central documentation.
