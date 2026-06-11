/* eslint-disable react-refresh/only-export-components */
import z from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { Variables } from '@/features/variables'

const variablesSearchSchema = z.object({
  service: z.string().optional().catch(undefined),
  key: z.string().optional().catch(undefined),
  q: z.string().optional().catch(undefined),
  page: z.number().optional().catch(undefined),
  pageSize: z.number().optional().catch(undefined),
  scope: z.array(z.string()).optional().catch(undefined),
  source: z.array(z.string()).optional().catch(undefined),
  visibility: z.array(z.string()).optional().catch(undefined),
})

function VariablesRoute() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  return (
    <Variables service={search.service} search={search} navigate={navigate} />
  )
}

export const Route = createFileRoute('/_authenticated/variables/')({
  validateSearch: variablesSearchSchema,
  component: VariablesRoute,
})
