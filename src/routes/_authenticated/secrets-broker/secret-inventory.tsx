import z from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { SecretInventoryPage } from '@/features/secret-inventory'

const secretInventorySearchSchema = z.object({
  page: z.number().optional().catch(undefined),
  pageSize: z.number().optional().catch(undefined),
  ref: z.string().optional().catch(''),
  state: z.array(z.string()).optional().catch(undefined),
  source: z.array(z.string()).optional().catch(undefined),
})

export const Route = createFileRoute(
  '/_authenticated/secrets-broker/secret-inventory'
)({
  validateSearch: secretInventorySearchSchema,
  component: SecretInventoryPage,
})
