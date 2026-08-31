import { createFileRoute } from '@tanstack/react-router'
import { OperationsTelemetry } from '@/features/operations'

export const Route = createFileRoute('/_authenticated/operations/telemetry')({
  component: OperationsTelemetry,
})
