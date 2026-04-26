import { AlertTriangle, Clock, Download, PackageCheck } from 'lucide-react'
import type {
  ServiceUpdateAction,
  ServiceUpdateState,
} from '@/lib/service-lasso-dashboard/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export function getServiceUpdateLabel(updates?: ServiceUpdateState) {
  if (!updates) return 'Unknown'

  if (updates.state === 'available') return 'Update available'
  if (updates.state === 'downloadedCandidate') return 'Downloaded'
  if (updates.state === 'installDeferred') return 'Waiting window'
  if (updates.state === 'failed') return 'Update failed'

  return updates.lastCheck?.status === 'pinned' ? 'Pinned' : 'Latest'
}

export function getServiceUpdateDescription(updates?: ServiceUpdateState) {
  if (!updates) return 'No update state has been reported yet.'

  if (updates.state === 'available') {
    return `Available: ${updates.available?.tag ?? updates.lastCheck?.latestTag ?? 'unknown'}`
  }
  if (updates.state === 'downloadedCandidate') {
    return `Candidate ready: ${updates.downloadedCandidate?.tag ?? 'unknown'}`
  }
  if (updates.state === 'installDeferred') {
    return updates.installDeferred?.reason ?? 'Install is waiting for policy.'
  }
  if (updates.state === 'failed') {
    return (
      updates.failed?.reason ??
      updates.lastCheck?.reason ??
      'Update check failed.'
    )
  }

  return updates.lastCheck?.reason ?? 'Service is on the latest known version.'
}

export function ServiceUpdateBadge({
  updates,
}: {
  updates?: ServiceUpdateState
}) {
  if (!updates || updates.state === 'installed') {
    return <Badge variant='outline'>{getServiceUpdateLabel(updates)}</Badge>
  }

  if (updates.state === 'failed') {
    return (
      <Badge variant='destructive'>
        <AlertTriangle className='mr-1 size-3' />
        {getServiceUpdateLabel(updates)}
      </Badge>
    )
  }

  if (updates.state === 'installDeferred') {
    return (
      <Badge variant='secondary'>
        <Clock className='mr-1 size-3' />
        {getServiceUpdateLabel(updates)}
      </Badge>
    )
  }

  return (
    <Badge className='bg-blue-600 hover:bg-blue-600'>
      {updates.state === 'downloadedCandidate' ? (
        <Download className='mr-1 size-3' />
      ) : (
        <PackageCheck className='mr-1 size-3' />
      )}
      {getServiceUpdateLabel(updates)}
    </Badge>
  )
}

export function getAvailableUpdateActions(
  updates?: ServiceUpdateState
): ServiceUpdateAction[] {
  if (!updates || updates.state === 'installed' || updates.state === 'failed') {
    return ['check']
  }

  if (updates.state === 'available') {
    return ['check', 'download']
  }

  return ['check', 'install']
}

export function ServiceUpdateActions({
  updates,
  pending,
  onAction,
}: {
  updates?: ServiceUpdateState
  pending?: boolean
  onAction: (action: ServiceUpdateAction) => void
}) {
  return (
    <div className='flex flex-wrap gap-2'>
      {getAvailableUpdateActions(updates).map((action) => (
        <Button
          key={action}
          type='button'
          size='sm'
          variant={action === 'install' ? 'default' : 'outline'}
          disabled={pending}
          onClick={() => onAction(action)}
        >
          {action === 'check'
            ? 'Check updates'
            : action === 'download'
              ? 'Download update'
              : 'Install update'}
        </Button>
      ))}
    </div>
  )
}
