import { cn } from '@/lib/utils'
import type { ServiceAction } from './types'

type LifecycleActionKind = Extract<
  ServiceAction['kind'],
  'start' | 'stop' | 'restart'
>

export function getLifecycleActionHoverClass(kind: LifecycleActionKind) {
  if (kind === 'start') {
    return 'hover:border-emerald-600 hover:bg-emerald-600 hover:text-white focus-visible:border-emerald-600 focus-visible:ring-emerald-600/30'
  }

  return 'hover:border-red-600 hover:bg-red-600 hover:text-white focus-visible:border-red-600 focus-visible:ring-red-600/30'
}

export function lifecycleActionButtonClass(
  kind: LifecycleActionKind,
  className?: string
) {
  return cn(getLifecycleActionHoverClass(kind), className)
}
