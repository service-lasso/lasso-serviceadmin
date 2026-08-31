/* eslint-disable react-refresh/only-export-components */
import z from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { Security } from '@/features/security'

const securitySearchSchema = z.object({
  tab: z
    .enum([
      'groups',
      'permissions',
      'mappings',
      'actors',
      'secret-access',
      'rotations',
    ])
    .optional()
    .catch(undefined),
  page: z.number().optional().catch(undefined),
  pageSize: z.number().optional().catch(undefined),
  query: z.string().optional().catch(undefined),
  status: z
    .array(z.enum(['assigned', 'missing', 'malformed']))
    .optional()
    .catch(undefined),
})

export const Route = createFileRoute('/_authenticated/security/')({
  validateSearch: securitySearchSchema,
  component: Security,
})
