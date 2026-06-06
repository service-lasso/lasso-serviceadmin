import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/support-bundle/')({
  beforeLoad: () => {
    throw redirect({ to: '/secrets-broker/diagnostics' })
  },
})
