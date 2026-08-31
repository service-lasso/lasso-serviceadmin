import { createFileRoute } from '@tanstack/react-router'
import { OperatorInboxPage } from '@/features/inbox'

export const Route = createFileRoute('/_authenticated/inbox/')({
  component: OperatorInboxPage,
})
