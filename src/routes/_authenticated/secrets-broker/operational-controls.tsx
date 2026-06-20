import { createFileRoute } from '@tanstack/react-router'
import { OperationalControlsPage } from '@/features/secrets-broker/operational-controls-page'

export const Route = createFileRoute(
  '/_authenticated/secrets-broker/operational-controls'
)({
  component: OperationalControlsPage,
})
