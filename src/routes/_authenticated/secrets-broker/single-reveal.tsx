import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/_authenticated/secrets-broker/single-reveal'
)({
  beforeLoad: () => {
    throw redirect({ to: '/secrets-broker/secrets' })
  },
})
