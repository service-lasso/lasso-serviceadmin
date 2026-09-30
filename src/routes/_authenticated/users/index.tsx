import { createFileRoute, redirect } from '@tanstack/react-router'

/**
 * Compatibility leftover of the retired User List / ZITADEL Sessions surface.
 * Operators land on Security instead of a user-management product page.
 */
export const Route = createFileRoute('/_authenticated/users/')({
  beforeLoad: () => {
    throw redirect({ to: '/security', replace: true })
  },
})
