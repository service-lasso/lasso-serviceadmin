# Service Admin Table Surface Audit

Issue: service-lasso/lasso-serviceadmin#154

## Shared Table Checklist

Use the shared Service Admin table pattern for operator list surfaces where rows are scanned, filtered, sorted, paged, or compared.

Required affordances for primary tables:

- TanStack table state for sorting, filtering, pagination, and column visibility.
- `DataTableToolbar` with search for safe metadata and faceted filters where row volume warrants it.
- `DataTableColumnHeader` for sortable columns.
- `DataTablePagination` for list surfaces that can grow past one viewport.
- Loading, empty, and no-match states that do not shift the surrounding layout.
- Secret-safe cells: render refs, labels, status, policy, audit metadata, and masked placeholders only.

Do not use the shared table pattern for short status summaries, forms, detail panels, graph legends, or fixed comparison blocks where pagination/filtering would make the task slower.

## Current Classification

| Surface | Classification | Evidence / next action |
| --- | --- | --- |
| Variables | Shared table | Uses shared toolbar, column headers, URL-backed pagination, filters, and masked secret values. Covered by `src/features/variables/variables.test.tsx`. |
| Services | Shared table | Uses Service Admin table components and row actions. |
| Installed | Shared table | Uses shared toolbar, column headers, filters, and pagination. |
| Network | Shared table | Uses shared toolbar, column headers, filters, and pagination. |
| Tasks | Shared table | Uses shared toolbar, pagination, and bulk actions. |
| Users | Shared table | Uses shared table components and row actions. |
| Secret Inventory | Shared table | Uses shared toolbar, faceted filters, pagination, and safe metadata-only cells. |
| Secrets Broker topology rows | Shared table | Uses shared toolbar, filters, and pagination for row data; graph remains an intentionally non-table visualization. |
| Secrets Broker Secrets management | Shared table | Updated under #154 to use shared search, state/provider filters, sortable headers, visibility controls, and pagination while preserving dry-run-only actions. |
| Secrets Broker provider migration preview | Follow-up | Current table is a bounded preview/result block inside a form-like workflow. Convert only if migration result volume grows or route becomes a primary list. |
| Secrets Broker bulk campaign plan preview | Follow-up | Current table is a generated plan/result block. Keep as preview until campaign history becomes a browsable list. |
| Logs service selector | Intentionally non-table | Small selector inside log viewer; pagination would not improve the log-reading workflow. |
| ZITADEL/session permissions | Intentionally non-table for now | Compact permission matrix; revisit if it becomes an operator-wide permission inventory. |
| Support Bundle/Diagnostics summaries | Intentionally non-table | Status and action panels, not row-oriented inventories. |

## Guardrails

- Never make a table searchable by raw secret values, provider credentials, tokens, cookies, private keys, env values, recovery material, or session contents.
- Value search, when available, must be broker-backed and return metadata/ref matches only.
- Stub or fixture rows must remain disabled by default where the runtime has a live API, and must be visibly marked when explicitly enabled.
- If a table cannot meet the shared table checklist in one issue, create a focused follow-up instead of widening the current slice.
