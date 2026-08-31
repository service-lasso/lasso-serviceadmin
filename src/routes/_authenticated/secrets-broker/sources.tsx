import { createFileRoute } from '@tanstack/react-router'
import { ProvidersManagementPage } from '@/features/secrets-broker/providers-management-page'

export const Route = createFileRoute('/_authenticated/secrets-broker/sources')({
  component: ProvidersManagementPage,
})
