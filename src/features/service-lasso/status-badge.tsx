import type { ServiceStatus } from '@/lib/service-lasso-api/types'
import { Badge } from '@/components/ui/badge'

const variantByStatus: Record<ServiceStatus, string> = {
  running: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  stopped: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
  error: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  starting: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  degraded: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
}

export function StatusBadge({ status }: { status: ServiceStatus }) {
  return (
    <Badge variant='outline' className={variantByStatus[status]}>
      {status}
    </Badge>
  )
}
