/* eslint-disable react-refresh/only-export-components */
import z from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { SecretsManagementPage } from '@/features/secrets-broker/secrets-management-page'

const optionalStringArraySearchParam = z
  .union([
    z.array(z.string()),
    z.string().transform((value) => (value.length > 0 ? [value] : undefined)),
  ])
  .optional()
  .catch(undefined)

const secretsManagementSearchSchema = z.object({
  page: z.number().optional().catch(undefined),
  pageSize: z.number().optional().catch(undefined),
  secret: z.string().optional().catch(''),
  ref: z.string().optional().catch(undefined),
  action: z
    .enum(['metadata', 'reveal', 'edit', 'reset', 'delete', 'policy'])
    .optional()
    .catch('metadata'),
  provider: optionalStringArraySearchParam,
  state: optionalStringArraySearchParam,
})

function SecretsManagementRoute() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  return <SecretsManagementPage search={search} navigate={navigate} />
}

export const Route = createFileRoute('/_authenticated/secrets-broker/secrets')({
  validateSearch: secretsManagementSearchSchema,
  component: SecretsManagementRoute,
})
