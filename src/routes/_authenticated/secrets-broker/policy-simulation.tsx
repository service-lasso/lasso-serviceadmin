import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/_authenticated/secrets-broker/policy-simulation'
)({
  beforeLoad: () => {
    throw redirect({ to: '/operations/audit-logging' })
  },
})
