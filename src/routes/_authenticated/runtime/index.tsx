import z from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { Runtime } from '@/features/runtime'

const runtimeSearchSchema = z.object({
  service: z.string().optional().catch(undefined),
})

export const Route = createFileRoute('/_authenticated/runtime/')({
  validateSearch: runtimeSearchSchema,
  component: Runtime,
})
