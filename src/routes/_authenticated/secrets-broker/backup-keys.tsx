import { createFileRoute } from '@tanstack/react-router'
import { LocalEncryptedStoreProviderDetailPage } from '@/features/secrets-broker/local-encrypted-store-detail'

export const Route = createFileRoute(
  '/_authenticated/secrets-broker/backup-keys'
)({
  component: LocalEncryptedStoreProviderDetailPage,
})
