import { createFileRoute } from '@tanstack/react-router'
import { ProviderConfigurationPage } from '@/features/secrets-broker/provider-configuration-page'

export const Route = createFileRoute(
  '/_authenticated/secrets-broker/configuration'
)({
  component: ProviderConfigurationPage,
})
