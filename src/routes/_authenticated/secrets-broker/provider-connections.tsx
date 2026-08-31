import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/_authenticated/secrets-broker/provider-connections'
)({
  beforeLoad: () => {
    throw redirect({ to: '/secrets-broker/sources' })
  },
})
