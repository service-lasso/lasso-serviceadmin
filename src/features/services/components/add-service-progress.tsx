import { Link } from '@tanstack/react-router'
import {
  CheckCircle2,
  CircleDashed,
  Loader2,
  TriangleAlert,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  addServiceStatusLabel,
  isAddServiceInFlight,
  type AddServiceProgressItem,
  type AddServiceProgressStatus,
} from './add-service-progress-model'

type AddServiceProgressListProps = {
  items: readonly AddServiceProgressItem[]
}

/**
 * Badge variant for a shared Add Service status.
 */
function statusBadgeVariant(
  status: AddServiceProgressStatus
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'complete') {
    return 'default'
  }

  if (status === 'failed') {
    return 'destructive'
  }

  if (status === 'skipped/conflict') {
    return 'secondary'
  }

  return 'outline'
}

/**
 * Status icon for in-flight, success, and problem rows.
 */
function StatusIcon({ status }: { status: AddServiceProgressStatus }) {
  if (isAddServiceInFlight(status)) {
    return <Loader2 className='size-4 animate-spin text-muted-foreground' />
  }

  if (status === 'complete') {
    return <CheckCircle2 className='size-4 text-primary' />
  }

  if (status === 'failed' || status === 'skipped/conflict') {
    return <TriangleAlert className='size-4 text-destructive' />
  }

  return <CircleDashed className='size-4 text-muted-foreground' />
}

/**
 * Shared catalog/archive progress and result list. Partial failures stay
 * visible, successful services link to Service Details, and conflicted or
 * failed rows show a safe reason plus a next action.
 */
export function AddServiceProgressList({ items }: AddServiceProgressListProps) {
  if (items.length === 0) {
    return null
  }

  return (
    <div className='space-y-2' aria-label='Add Service progress'>
      {items.map((item) => (
        <div
          key={item.id}
          className='flex flex-wrap items-start justify-between gap-2 rounded-md border p-3 text-sm'
          data-status={item.status}
        >
          <div className='flex min-w-0 items-start gap-2'>
            <StatusIcon status={item.status} />
            <div className='min-w-0 space-y-1'>
              <p className='font-medium'>{item.label}</p>
              <p className='text-muted-foreground'>{item.message}</p>
              {item.nextAction ? (
                <p className='text-muted-foreground'>{item.nextAction}</p>
              ) : null}
              {item.status === 'complete' && item.serviceId ? (
                <Link
                  to='/services/$serviceId'
                  params={{ serviceId: item.serviceId }}
                  className='font-medium text-primary underline-offset-4 hover:underline'
                >
                  Service Details
                </Link>
              ) : null}
              {item.status === 'skipped/conflict' && item.serviceId ? (
                <Link
                  to='/services/$serviceId'
                  params={{ serviceId: item.serviceId }}
                  className='font-medium text-primary underline-offset-4 hover:underline'
                >
                  Open existing service
                </Link>
              ) : null}
            </div>
          </div>
          <Badge variant={statusBadgeVariant(item.status)}>
            {addServiceStatusLabel(item.status)}
          </Badge>
        </div>
      ))}
    </div>
  )
}
