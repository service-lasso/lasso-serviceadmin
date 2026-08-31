/* eslint-disable react-refresh/only-export-components */
import z from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { ServiceDetail } from '@/features/service-detail'
import {
  defaultServiceDetailTab,
  normalizeServiceDetailTab,
} from '@/features/service-detail/service-detail-tabs'

const serviceDetailSearchSchema = z.object({
  tab: z.string().optional().catch(undefined),
  rotationOperation: z
    .string()
    .regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/)
    .optional()
    .catch(undefined),
})

function ServicesDetailRoute() {
  const { serviceId } = Route.useParams()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const activeTab = normalizeServiceDetailTab(search.tab)

  return (
    <ServiceDetail
      key={serviceId}
      serviceId={canonicalServiceId(serviceId)}
      activeTab={activeTab}
      onActiveTabChange={(tab) => {
        void navigate({
          search: (previous) => ({
            ...previous,
            tab: tab === defaultServiceDetailTab ? undefined : tab,
          }),
        })
      }}
      rotationOperationId={search.rotationOperation}
      onRotationOperationChange={(rotationOperation) => {
        void navigate({
          replace: true,
          search: (previous) => ({
            ...previous,
            rotationOperation,
          }),
        })
      }}
    />
  )
}

function canonicalServiceId(serviceId: string) {
  const aliases: Record<string, string> = {
    'service-admin': '@serviceadmin',
    'secrets-broker': '@secretsbroker',
    traefik: '@traefik',
  }

  return aliases[serviceId] ?? serviceId
}

export const Route = createFileRoute('/_authenticated/services/$serviceId')({
  validateSearch: serviceDetailSearchSchema,
  component: ServicesDetailRoute,
})
