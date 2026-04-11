import z from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { Installed } from '@/features/installed'

const installedSearchSchema = z.object({
  filter: z.string().optional().catch(''),
})

export const Route = createFileRoute('/_authenticated/installed/')({
  validateSearch: installedSearchSchema,
  component: Installed,
})
