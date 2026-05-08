import { createFileRoute } from '@tanstack/react-router'
import { SecretsPolicySimulationPage } from '@/features/secrets-policy-simulation'

export const Route = createFileRoute(
  '/_authenticated/secrets-policy-simulation/'
)({
  component: SecretsPolicySimulationPage,
})
