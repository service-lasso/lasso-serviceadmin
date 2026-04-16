import z from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { Dependencies } from '@/features/dependencies'

const dependenciesSearchSchema = z.object({
  service: z.string().optional().catch(undefined),
})

export const Route = createFileRoute('/_authenticated/dependencies/')({
  validateSearch: dependenciesSearchSchema,
  component: Dependencies,
})
