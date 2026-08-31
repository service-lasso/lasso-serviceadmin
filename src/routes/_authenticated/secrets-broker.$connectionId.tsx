/* eslint-disable react-refresh/only-export-components */
import { createFileRoute } from '@tanstack/react-router'
import { SecretsBrokerProviderConnectionDetailPage } from '@/features/secrets-broker/connection-detail'

export const Route = createFileRoute(
  '/_authenticated/secrets-broker/$connectionId'
)({
  component: ProviderConnectionDetailRoute,
})

function ProviderConnectionDetailRoute() {
  const { connectionId } = Route.useParams()

  return (
    <SecretsBrokerProviderConnectionDetailPage connectionId={connectionId} />
  )
}
