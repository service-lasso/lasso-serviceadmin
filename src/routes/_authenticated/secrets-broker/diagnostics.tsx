import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/_authenticated/secrets-broker/diagnostics'
)({
  beforeLoad: () => {
    throw redirect({ to: '/secrets-broker/sources' })
  },
})
