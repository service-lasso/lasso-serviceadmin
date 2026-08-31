import { createFileRoute } from '@tanstack/react-router'
import { SecretsBrokerTopologyPage } from '@/features/secrets-broker/topology-page'

export const Route = createFileRoute('/_authenticated/secrets-broker/topology')(
  {
    component: SecretsBrokerTopologyPage,
  }
)
