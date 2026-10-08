import { createFileRoute } from '@tanstack/react-router'
import { SecretsBrokerWebDAVPage } from '@/features/secrets-broker/webdav-page'

export const Route = createFileRoute('/_authenticated/secrets-broker/webdav')({
  component: SecretsBrokerWebDAVPage,
})
