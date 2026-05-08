import { createFileRoute } from '@tanstack/react-router'
import { SecretInventoryPage } from '@/features/secret-inventory'

export const Route = createFileRoute('/_authenticated/secret-inventory/')({
  component: SecretInventoryPage,
})
