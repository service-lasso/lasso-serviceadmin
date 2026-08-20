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
})

function ServicesDetailRoute() {
  const { serviceId } = Route.useParams()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const activeTab = normalizeServiceDetailTab(search.tab)

  return (
    <ServiceDetail
      key={serviceId}
      serviceId={serviceId}
      activeTab={activeTab}
      onActiveTabChange={(tab) => {
        void navigate({
          search: (previous) => ({
            ...previous,
            tab: tab === defaultServiceDetailTab ? undefined : tab,
          }),
        })
      }}
    />
  )
}

export const Route = createFileRoute('/_authenticated/services/$serviceId')({
  validateSearch: serviceDetailSearchSchema,
  component: ServicesDetailRoute,
})
