import z from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { Logs } from '@/features/logs'

const logsSearchSchema = z.object({
  service: z.string().optional().catch(undefined),
})

export const Route = createFileRoute('/_authenticated/logs/')({
  validateSearch: logsSearchSchema,
  component: Logs,
})
