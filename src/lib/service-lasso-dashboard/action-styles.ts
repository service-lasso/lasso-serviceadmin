import { cn } from '@/lib/utils'
import type { ServiceAction } from './types'

type LifecycleActionKind = Extract<
  ServiceAction['kind'],
  'start' | 'stop' | 'restart'
>

/**
 * Filled lifecycle colors: start is green, stop and restart are red.
 */
export function getLifecycleActionFillClass(kind: LifecycleActionKind) {
  if (kind === 'start') {
    return 'border-emerald-600 bg-emerald-600 text-white hover:border-emerald-700 hover:bg-emerald-700 hover:text-white focus-visible:border-emerald-700 focus-visible:ring-emerald-600/30 disabled:border-emerald-600/40 disabled:bg-emerald-600/40 disabled:text-white'
  }

  return 'border-red-600 bg-red-600 text-white hover:border-red-700 hover:bg-red-700 hover:text-white focus-visible:border-red-700 focus-visible:ring-red-600/30 disabled:border-red-600/40 disabled:bg-red-600/40 disabled:text-white'
}

export function getLifecycleActionHoverClass(kind: LifecycleActionKind) {
  return getLifecycleActionFillClass(kind)
}

export function lifecycleActionButtonClass(
  kind: LifecycleActionKind,
  className?: string
) {
  return cn(getLifecycleActionFillClass(kind), className)
}
