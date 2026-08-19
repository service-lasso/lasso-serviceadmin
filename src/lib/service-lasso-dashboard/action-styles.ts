import { cn } from '@/lib/utils'
import type { ServiceAction } from './types'

type LifecycleActionKind = Extract<
  ServiceAction['kind'],
  'start' | 'stop' | 'restart'
>

/**
 * Outline lifecycle chrome: colour the icon only.
 * Start is emerald; stop and restart are red. Disabled uses a muted icon,
 * not a faded filled button.
 */
export function getLifecycleActionIconClass(kind: LifecycleActionKind) {
  if (kind === 'start') {
    return 'text-emerald-600 hover:text-emerald-700 disabled:text-muted-foreground'
  }

  return 'text-red-600 hover:text-red-700 disabled:text-muted-foreground'
}

export function lifecycleActionButtonClass(
  kind: LifecycleActionKind,
  className?: string
) {
  return cn(
    'disabled:opacity-100 disabled:bg-background',
    getLifecycleActionIconClass(kind),
    className
  )
}
