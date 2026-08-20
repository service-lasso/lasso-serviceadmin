import { createFileRoute } from '@tanstack/react-router'
import { FleetOverviewPage } from '@/features/fleet-overview'

export const Route = createFileRoute('/_authenticated/fleet-overview/')({
  component: FleetOverviewPage,
})
