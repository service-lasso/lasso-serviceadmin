/* eslint-disable react-refresh/only-export-components */
import z from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { ServiceDetail } from '@/features/service-detail'

const servicesDetailSearchSchema = z.object({
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
  return (
    <ServiceDetail
      serviceId={serviceId}
      rotationOperationId={search.rotationOperation}
      onRotationOperationChange={(rotationOperation) =>
        void navigate({
          replace: true,
          search: { rotationOperation },
        })
      }
    />
  )
}

export const Route = createFileRoute('/_authenticated/services/$serviceId')({
  validateSearch: servicesDetailSearchSchema,
  component: ServicesDetailRoute,
})
