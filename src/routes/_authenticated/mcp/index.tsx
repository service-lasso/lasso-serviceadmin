import { createFileRoute } from '@tanstack/react-router'
import { Mcp } from '@/features/mcp'

export const Route = createFileRoute('/_authenticated/mcp/')({
  component: Mcp,
})
