import { ShieldCheck, Stethoscope } from 'lucide-react'
import { useServiceRecoveryDoctorAction } from '@/lib/service-lasso-dashboard/hooks'
import type {
  ServiceRecoveryEvent,
  ServiceRecoveryHistoryState,
} from '@/lib/service-lasso-dashboard/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export function getLatestRecoveryEvent(
  recovery?: ServiceRecoveryHistoryState
): ServiceRecoveryEvent | null {
  return recovery?.events[recovery.events.length - 1] ?? null
}

export function getServiceRecoveryLabel(
  recovery?: ServiceRecoveryHistoryState
) {
  const event = getLatestRecoveryEvent(recovery)
  if (!event) return 'No recovery'

  if (event.kind === 'monitor') {
    return event.action === 'healthy' ? 'Monitor healthy' : 'Monitor review'
  }

  if (event.kind === 'doctor') {
    return event.blocked ? 'Doctor blocked' : 'Doctor ok'
  }

  if (event.kind === 'hook') {
    return event.blocked ? 'Hook blocked' : 'Hook ok'
  }

  return event.ok === false ? 'Restart failed' : 'Restart ok'
}

export function getServiceRecoveryDescription(
  recovery?: ServiceRecoveryHistoryState
) {
  const event = getLatestRecoveryEvent(recovery)
  if (!event) return 'No recovery, doctor, restart, or hook history yet.'

  if (event.kind === 'monitor') {
    return event.message ?? `Monitor ${event.action ?? 'event'}: ${event.reason ?? 'unknown'}`
  }

  if (event.kind === 'doctor') {
    const failed = event.steps?.find((step) => !step.ok)
    if (failed) {
      return `${failed.name} ${event.blocked ? 'blocked' : 'reported'} doctor status.`
    }
    return `${event.steps?.length ?? 0} doctor step(s) passed.`
  }

  if (event.kind === 'hook') {
    return `${event.phase ?? 'Hook'} ${event.blocked ? 'blocked' : 'completed'} with ${event.steps?.length ?? 0} step(s).`
  }

  return event.message ?? (event.ok === false ? 'Restart failed.' : 'Restart completed.')
}

export function ServiceRecoveryBadge({
  recovery,
}: {
  recovery?: ServiceRecoveryHistoryState
}) {
  const event = getLatestRecoveryEvent(recovery)
  const needsAttention =
    (event?.kind === 'monitor' &&
      event.action !== 'healthy' &&
      event.reason !== 'healthy') ||
    event?.blocked === true ||
    event?.ok === false

  if (!event) {
    return <Badge variant='outline'>No recovery</Badge>
  }

  if (needsAttention) {
    return <Badge variant='destructive'>{getServiceRecoveryLabel(recovery)}</Badge>
  }

  return (
    <Badge className='bg-emerald-600 hover:bg-emerald-600'>
      {getServiceRecoveryLabel(recovery)}
    </Badge>
  )
}

export function ServiceRecoveryDoctorButton({
  serviceId,
  disabled,
}: {
  serviceId: string
  disabled?: boolean
}) {
  const doctorAction = useServiceRecoveryDoctorAction()

  return (
    <Button
      type='button'
      size='sm'
      variant='outline'
      disabled={disabled || doctorAction.isPending}
      onClick={() => doctorAction.mutate(serviceId)}
    >
      {doctorAction.isPending ? (
        <ShieldCheck className='mr-2 size-4 animate-pulse' />
      ) : (
        <Stethoscope className='mr-2 size-4' />
      )}
      Run doctor
    </Button>
  )
}
