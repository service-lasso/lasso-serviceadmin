import { createFileRoute } from '@tanstack/react-router'
import { SupportBundlePage } from '@/features/support-bundle'

export const Route = createFileRoute('/_authenticated/support-bundle/')({
  component: SupportBundlePage,
})
