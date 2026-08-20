import z from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { SecretsBrokerReviewPage } from '@/features/secrets-broker/review-page'

const reviewSearchSchema = z.object({
  mapping: z.string().optional().catch(undefined),
  page: z.number().optional().catch(undefined),
  pageSize: z.number().optional().catch(undefined),
  status: z.array(z.string()).optional().catch(undefined),
})

/**
 * Review route: SecretRef mapping table extracted from Topology.
 */
export const Route = createFileRoute('/_authenticated/secrets-broker/review')({
  validateSearch: reviewSearchSchema,
  component: SecretsBrokerReviewPage,
})
