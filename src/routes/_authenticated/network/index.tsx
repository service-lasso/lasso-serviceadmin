import z from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { Network } from '@/features/network'

const networkSearchSchema = z.object({
  service: z.string().optional().catch(undefined),
})

export const Route = createFileRoute('/_authenticated/network/')({
  validateSearch: networkSearchSchema,
  component: Network,
})
