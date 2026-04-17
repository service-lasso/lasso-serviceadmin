/* eslint-disable react-refresh/only-export-components */
import { createFileRoute } from '@tanstack/react-router'
import { ServiceDetail } from '@/features/service-detail'

function ServicesDetailRoute() {
  const { serviceId } = Route.useParams()
  return <ServiceDetail key={serviceId} serviceId={serviceId} />
}

export const Route = createFileRoute('/_authenticated/services/$serviceId')({
  component: ServicesDetailRoute,
})
