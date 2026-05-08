import { createFileRoute } from '@tanstack/react-router'
import { SecretsManagementPage } from '@/features/secrets-broker/secrets-management-page'

export const Route = createFileRoute('/_authenticated/secrets-broker/secrets')({
  component: SecretsManagementPage,
})
