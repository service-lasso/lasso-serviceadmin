import z from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { Services } from '@/features/services'

const servicesSearchSchema = z.object({
  page: z.number().optional().catch(undefined),
  pageSize: z.number().optional().catch(undefined),
  service: z.string().optional().catch(''),
  status: z.array(z.string()).optional().catch(undefined),
  favorite: z.array(z.string()).optional().catch(undefined),
  installed: z.array(z.string()).optional().catch(undefined),
})

export const Route = createFileRoute('/_authenticated/services/')({
  validateSearch: servicesSearchSchema,
  component: Services,
})
