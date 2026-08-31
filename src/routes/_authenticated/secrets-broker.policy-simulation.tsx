import { createFileRoute, redirect } from '@tanstack/react-router'

/**
 * Leftover Policy Simulation URL. Operators land on the live assignment
 * inspector instead of a 404 or the retired scenario playground.
 */
export const Route = createFileRoute(
  '/_authenticated/secrets-broker/policy-simulation'
)({
  beforeLoad: () => {
    throw redirect({
      to: '/security',
      search: { tab: 'secret-access' },
    })
  },
})
