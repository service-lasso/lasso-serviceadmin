import { createFileRoute } from '@tanstack/react-router'
import { InstalledPage } from '@/features/installed'

export const Route = createFileRoute('/_authenticated/installed/')({
  component: InstalledPage,
})
