import { createFileRoute } from '@tanstack/react-router'
import { OperationsAuditLogging } from '@/features/operations'

export const Route = createFileRoute(
  '/_authenticated/operations/audit-logging'
)({
  component: OperationsAuditLogging,
})
