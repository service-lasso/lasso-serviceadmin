import { createFileRoute } from '@tanstack/react-router'
import { SecretsBrokerSetupWizard } from '@/features/secrets-broker'

export const Route = createFileRoute('/_authenticated/secrets-broker/')({
  component: SecretsBrokerSetupWizard,
})
