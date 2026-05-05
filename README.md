# Shadcn Admin Dashboard

Admin Dashboard UI crafted with Shadcn and Vite. Built with responsiveness and accessibility in mind.

## Service Lasso runtime API endpoint

This admin UI should discover the Service Lasso runtime/API endpoint from env, not from hardcoded localhost assumptions.

Current env contract:

- `VITE_SERVICE_LASSO_API_BASE_URL`
- `VITE_SERVICE_LASSO_FAVORITES_ENABLED`
- `VITE_SERVICE_LASSO_LOGS_DEBUG`

Example:

- `VITE_SERVICE_LASSO_API_BASE_URL=http://127.0.0.1:3001`
- `VITE_SERVICE_LASSO_FAVORITES_ENABLED=true`

Current UI runtime behavior:

- if `VITE_SERVICE_LASSO_API_BASE_URL` is set, dashboard service status, health, runtime actions, and logs are read from the live Service Lasso runtime API
- if `VITE_SERVICE_LASSO_API_BASE_URL` is missing, the UI uses local demo stub data for development preview only; lifecycle and favorite changes are persisted in browser local storage so the UI behaves consistently during a dev session
- a configured but unavailable runtime API is treated as an error instead of falling back to demo status
- favorites editing is only enabled when `VITE_SERVICE_LASSO_FAVORITES_ENABLED=true`
- favorites are expected to load from `GET /api/services/meta`
- favorites are expected to update through `PATCH /api/services/:serviceId/meta`
- service status is expected to load from `GET /api/dashboard` and `GET /api/dashboard/services`
- bulk start is expected to call `POST /api/runtime/actions/startAll`
- reload is expected to call `POST /api/runtime/actions/reload`
- set `VITE_SERVICE_LASSO_LOGS_DEBUG=true` to enable Logs screen debug output in the browser console outside dev mode
- if the endpoint env var is missing or the favorites flag is not enabled, favorite controls stay visible but disabled

![alt text](public/images/shadcn-admin.png)

[![Sponsored by Clerk](https://img.shields.io/badge/Sponsored%20by-Clerk-5b6ee1?logo=clerk)](https://go.clerk.com/GttUAaK)

I've been creating dashboard UIs at work and for my personal projects. I always wanted to make a reusable collection of dashboard UI for future projects; and here it is now. While I've created a few custom components, some of the code is directly adapted from ShadcnUI examples.

> This is not a starter project (template) though. I'll probably make one in the future.

## Features

- Light/dark mode
- Responsive
- Accessible
- With built-in Sidebar component
- Global search command
- 10+ pages
- Extra custom components
- RTL support

<details>
<summary>Customized Components (click to expand)</summary>

This project uses Shadcn UI components, but some have been slightly modified for better RTL (Right-to-Left) support and other improvements. These customized components differ from the original Shadcn UI versions.

If you want to update components using the Shadcn CLI (e.g., `npx shadcn@latest add <component>`), it's generally safe for non-customized components. For the listed customized ones, you may need to manually merge changes to preserve the project's modifications and avoid overwriting RTL support or other updates.

> If you don't require RTL support, you can safely update the 'RTL Updated Components' via the Shadcn CLI, as these changes are primarily for RTL compatibility. The 'Modified Components' may have other customizations to consider.

### Modified Components

- scroll-area
- sonner
- separator

### RTL Updated Components

- alert-dialog
- calendar
- command
- dialog
- dropdown-menu
- select
- table
- sheet
- sidebar
- switch

**Notes:**

- **Modified Components**: These have general updates, potentially including RTL adjustments.
- **RTL Updated Components**: These have specific changes for RTL language support (e.g., layout, positioning).
- For implementation details, check the source files in `src/components/ui/`.
- All other Shadcn UI components in the project are standard and can be safely updated via the CLI.

</details>

## Tech Stack

**UI:** [ShadcnUI](https://ui.shadcn.com) (TailwindCSS + RadixUI)

**Build Tool:** [Vite](https://vitejs.dev/)

**Routing:** [TanStack Router](https://tanstack.com/router/latest)

**Type Checking:** [TypeScript](https://www.typescriptlang.org/)

**Linting/Formatting:** [ESLint](https://eslint.org/) & [Prettier](https://prettier.io/)

**Icons:** [Lucide Icons](https://lucide.dev/icons/), [Tabler Icons](https://tabler.io/icons) (Brand icons only)

**Auth (partial):** [Clerk](https://go.clerk.com/GttUAaK)

## Service Lasso migration rule

For this repo, the `shadcn-admin` page shape is a hard invariant, not just inspiration.

Every Service Lasso page must keep the shared template structure:

- template `Header`
- template `Main` content container
- consistent content spacing and section rhythm
- template-native patterns for cards, tables, forms, dialogs, drawers, and empty/loading/error states

Do not cut a route down to a bare card or ad-hoc layout just because the feature slice is small. If a page exists, it must fit the same proper template content space as the other pages.

See `docs/reference/MIGRATION-REPORT.md` for the stricter migration rules.

## Run Locally

Clone the project

```bash
  git clone https://github.com/satnaing/shadcn-admin.git
```

Go to the project directory

```bash
  cd shadcn-admin
```

Install dependencies

```bash
  pnpm install
```

Start the server

```bash
  pnpm run dev
```

## Sponsoring this project ❤️

If you find this project helpful or use this in your own work, consider [sponsoring me](https://github.com/sponsors/satnaing) to support development and maintenance. You can [buy me a coffee](https://buymeacoffee.com/satnaing) as well. Don’t worry, every penny helps. Thank you! 🙏

For questions or sponsorship inquiries, feel free to reach out at [satnaingdev@gmail.com](mailto:satnaingdev@gmail.com).

### Current Sponsor

- [Clerk](https://go.clerk.com/GttUAaK) - authentication and user management for the modern web

## Author

Crafted with 🤍 by [@satnaing](https://github.com/satnaing)

## License

Licensed under the [MIT License](https://choosealicense.com/licenses/mit/)
