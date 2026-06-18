import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/_authenticated/secrets-broker/workflow-boundaries'
)({
  beforeLoad: () => {
    throw redirect({ to: '/secrets-broker/sources' })
  },
})
