/* eslint-disable react-refresh/only-export-components */
import z from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { Variables } from '@/features/variables'

const variablesSearchSchema = z.object({
  service: z.string().optional().catch(undefined),
  key: z.string().optional().catch(undefined),
})

function VariablesRoute() {
  const search = Route.useSearch()

  return <Variables service={search.service} keyFilter={search.key} />
}

export const Route = createFileRoute('/_authenticated/variables/')({
  validateSearch: variablesSearchSchema,
  component: VariablesRoute,
})
