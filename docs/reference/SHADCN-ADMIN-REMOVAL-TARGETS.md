# Service Lasso - `shadcn-admin` Removal Targets

_Status: working draft / cleanup plan_

Important reconciliation note:
- this file is a UI cleanup/adaptation plan for the optional admin service
- it should not be read as a core runtime contract doc

Purpose:

- document the demo/auth/sample content discovered in `shadcn-admin`
- identify what should be removed or replaced when adapting it into `lasso-@serviceadmin`

Related docs:

- `SHADCN-ADMIN-REVIEW.md`
- `SHADCN-ADMIN-MAP.md`
- `UI-STATE-REVIEW.md`

---

## 1. Main Finding

`shadcn-admin` is a solid admin UI base, but it clearly contains demo/sample domain content and auth-specific scaffolding that should be stripped when turning it into `lasso-@serviceadmin`.

The cleanup should be deliberate rather than ad hoc.

---

## 2. Route-Level Removal Targets

Observed top-level routes include:

- `src/routes/(auth)`
- `src/routes/(errors)`
- `src/routes/_authenticated`
- `src/routes/clerk`
- `src/routes/__root.tsx`

### Recommended action

#### Remove / replace entirely
- `src/routes/(auth)`
  - auth/login-related routes
- `src/routes/clerk`
  - Clerk-specific auth/demo integration routes

#### Likely keep only in simplified form
- `src/routes/(errors)`
  - keep generic error handling pages only if useful
- `src/routes/__root.tsx`
  - keep as root route/bootstrap, but adapt to Service Lasso app shell
- `src/routes/_authenticated`
  - likely remove/flatten because Service Lasso admin UI should not depend on sample auth gating structure by default

---

## 3. Feature-Level Removal / Replacement Targets

Observed feature folders include:

- `src/features/apps`
- `src/features/auth`
- `src/features/chats`
- `src/features/dashboard`
- `src/features/errors`
- `src/features/settings`
- `src/features/tasks`
- `src/features/users`

### Recommended action

#### Remove entirely
These look like sample/business-demo features that do not map to Service Lasso directly:

- `src/features/auth`
- `src/features/chats`
- `src/features/tasks`
- `src/features/users`
- likely most of `src/features/apps` unless it contains generic reusable UI pieces

#### Keep conceptually, but replace content
- `src/features/dashboard`
  - replace with Service Lasso runtime/services dashboard
- `src/features/settings`
  - keep only if useful for UI settings later
- `src/features/errors`
  - keep only as generic error UI support if useful

---

## 4. Store-Level Removal Targets

Observed store:

- `src/stores/auth-store.ts`

### Recommended action
- remove `auth-store.ts`
- replace with Service Lasso-specific UI state stores later as needed

Examples of future store/state areas:
- service filter state
- selected service state
- dependency graph UI state
- runtime view settings

---

## 5. Auth-Related Dependency / Integration Targets

From reviewed package metadata, the base includes auth-related dependencies/integration such as:

- `@clerk/clerk-react`
- `src/routes/clerk`
- `src/features/auth`
- `src/stores/auth-store.ts`

### Recommended action
Remove or avoid carrying over auth/demo integration unless a future deliberate Service Lasso auth model exists.

Current direction suggests:
- no login/demo auth flows in the optional admin UI service base
- remove auth menus and login options from the adapted UI

---

## 6. Menu / Navigation Cleanup Targets

Because the template includes demo/sample content, the adapted `lasso-@serviceadmin` sidebar/menu should remove:

- auth/login menu items
- user/account demo menu items
- chat/task/user/app demo navigation
- any sample business-domain pages

And replace them with Service Lasso navigation:

- Dashboard
- Services
- Dependencies
- Runtime
- Logs
- Network
- Installed
- Settings (optional later)

---

## 7. What To Keep From The Base

Keep the reusable app-shell/UI foundation:

- root app bootstrap shape
- sidebar shell
- topbar/header shell
- route-based app structure
- reusable components
- theming/dark mode support
- hooks/lib/config structure

This means we are removing domain/auth/demo content, not throwing away the useful architecture.

---

## 8. Recommended Cleanup Order

### Phase 1 - Strip auth/demo content
- remove auth routes
- remove Clerk routes/integration
- remove auth store
- remove sample auth/menu items

### Phase 2 - Strip business demo features
- remove chats/tasks/users/apps demo features
- keep only generic dashboard/settings/errors pieces if helpful

### Phase 3 - Replace with Service Lasso features
- services
- service detail
- runtime
- dependencies
- logs
- network
- installed

---

## 9. Working Summary

The current `shadcn-admin` base includes clear auth/demo/sample content that should be explicitly removed during adaptation.

Primary removal targets currently identified:
- `src/routes/(auth)`
- `src/routes/clerk`
- `src/features/auth`
- `src/features/chats`
- `src/features/tasks`
- `src/features/users`
- likely most sample `apps` content
- `src/stores/auth-store.ts`
- auth/login/user-oriented menus

This cleanup should happen before or alongside replacing the demo sections with Service Lasso-specific admin/operator pages.
