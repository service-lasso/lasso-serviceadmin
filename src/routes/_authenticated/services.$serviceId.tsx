/* eslint-disable react-refresh/only-export-components */
import { createFileRoute } from '@tanstack/react-router'
import { ServiceDetailPage } from '@/features/service-detail'

export const Route = createFileRoute('/_authenticated/services/$serviceId')({
  component: RouteComponent,
})

function RouteComponent() {
  const { serviceId } = Route.useParams()
  return <ServiceDetailPage serviceId={serviceId} />
}
