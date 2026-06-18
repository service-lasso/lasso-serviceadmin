import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/_authenticated/secrets-broker/secret-inventory'
)({
  beforeLoad: () => {
    throw redirect({ to: '/secrets-broker/sources' })
  },
})
