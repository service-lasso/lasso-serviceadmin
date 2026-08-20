import { createFileRoute } from '@tanstack/react-router'
import { AuthSessionPage } from '@/features/auth-session'

export const Route = createFileRoute('/_authenticated/auth-session/')({
  component: AuthSessionPage,
})
