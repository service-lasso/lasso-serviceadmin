import { createFileRoute } from '@tanstack/react-router'
import { DependenciesPage } from '@/features/dependencies'

export const Route = createFileRoute('/_authenticated/dependencies/')({
  component: DependenciesPage,
})
