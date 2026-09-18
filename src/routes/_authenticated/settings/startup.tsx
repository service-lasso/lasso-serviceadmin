import { createFileRoute } from '@tanstack/react-router'
import { SettingsStartup } from '@/features/settings/startup'

export const Route = createFileRoute('/_authenticated/settings/startup')({
  component: SettingsStartup,
})
