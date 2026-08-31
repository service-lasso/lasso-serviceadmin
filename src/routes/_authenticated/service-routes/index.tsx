import z from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { ServiceRoutes } from '@/features/service-routes'

const serviceRoutesSearchSchema = z.object({
  page: z.number().optional().catch(undefined),
  pageSize: z.number().optional().catch(undefined),
  route: z.string().optional().catch(''),
  routing: z.array(z.string()).optional().catch(undefined),
  status: z.array(z.string()).optional().catch(undefined),
  provider: z.array(z.string()).optional().catch(undefined),
})

export const Route = createFileRoute('/_authenticated/service-routes/')({
  validateSearch: serviceRoutesSearchSchema,
  component: ServiceRoutes,
})
