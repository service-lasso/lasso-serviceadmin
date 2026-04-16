import z from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { HelpCenter } from '@/features/help-center'

const helpCenterSearchSchema = z.object({
  doc: z.string().optional().catch(undefined),
})

export const Route = createFileRoute('/_authenticated/help-center/')({
  validateSearch: helpCenterSearchSchema,
  component: HelpCenter,
})
