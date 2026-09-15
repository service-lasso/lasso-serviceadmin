import {
  useState,
  type ComponentProps,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { useServiceLifecycleAction } from '@/lib/service-lasso-dashboard/hooks'
import {
  isLifecycleAction,
  isLifecycleActionEnabled,
} from '@/lib/service-lasso-dashboard/lifecycle-actions'
import type {
  DashboardService,
  ServiceAction,
  ServiceLifecycleActionKind,
} from '@/lib/service-lasso-dashboard/types'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/confirm-dialog'

const lifecycleKinds: ServiceLifecycleActionKind[] = [
  'install',
  'config',
  'start',
  'stop',
  'restart',
  'reload',
]

type ServiceLifecycleActionButtonProps = {
  action: ServiceAction
  service: DashboardService
  children?: ReactNode
  ariaLabel?: string
  mutation?: ReturnType<typeof useServiceLifecycleAction>
  stopPropagation?: boolean
} & Pick<ComponentProps<typeof Button>, 'className' | 'size' | 'variant'>

/**
 * Runs one runtime-advertised lifecycle action. The runtime remains the source
 * of truth for both permission and whether an explicit confirmation is needed.
 */
export function ServiceLifecycleActionButton({
  action,
  ariaLabel,
  children,
  className,
  mutation,
  service,
  size = 'sm',
  stopPropagation = false,
  variant = 'outline',
}: ServiceLifecycleActionButtonProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const ownLifecycleAction = useServiceLifecycleAction()
  const lifecycleAction = mutation ?? ownLifecycleAction
  const isServiceLifecycleAction = lifecycleKinds.includes(
    action.kind as ServiceLifecycleActionKind
  )
  const isDaemonLifecycleAction = isLifecycleAction(action)
  const stateAllowsDaemonLifecycleAction =
    !isDaemonLifecycleAction || isLifecycleActionEnabled(service, action.kind)
  const fallbackPermissionAllowed = isDaemonLifecycleAction
    ? stateAllowsDaemonLifecycleAction
    : !isServiceLifecycleAction
  const permissionAllowed =
    (action.permission?.allowed ?? fallbackPermissionAllowed) &&
    stateAllowsDaemonLifecycleAction
  const permission = {
    ...action.permission,
    allowed: permissionAllowed,
    reason:
      action.permission?.reason ??
      (permissionAllowed
        ? undefined
        : `${action.label} is unavailable for the current service state.`),
  }

  const runLifecycleAction = (confirm: boolean) => {
    if (!isServiceLifecycleAction || lifecycleAction.isPending) return
    lifecycleAction.mutate(
      {
        serviceId: service.id,
        action: action.kind as ServiceLifecycleActionKind,
        confirm,
      },
      {
        onSuccess: () => {
          setConfirmOpen(false)
          toast.success(`${action.label} completed.`)
        },
        onError: () => {
          toast.error(
            `${action.label} failed. The runtime made no UI-side assumptions.`
          )
        },
      }
    )
  }

  const button = (onClick: () => void) => (
    <Button
      type='button'
      variant={variant}
      size={size}
      className={className}
      aria-label={ariaLabel ?? action.label}
      title={permission.reason ?? ariaLabel ?? action.label}
      disabled={!permission.allowed || lifecycleAction.isPending}
      onClick={(event: MouseEvent<HTMLButtonElement>) => {
        if (stopPropagation) event.stopPropagation()
        onClick()
      }}
    >
      {lifecycleAction.isPending && !children ? (
        <RefreshCw className='size-3.5 animate-spin' />
      ) : (
        (children ?? action.label)
      )}
    </Button>
  )

  if (permission.requiresConfirmation && permission.allowed) {
    return (
      <>
        {button(() => setConfirmOpen(true))}
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title='Confirm elevated action'
          desc={
            <div className='space-y-2'>
              <p>
                {permission.reason ?? 'Core marked this action as elevated.'}
              </p>
              <p>
                Actor: {permission.actor ?? 'unknown'}; mode:{' '}
                {permission.mode ?? 'unknown'}.
              </p>
            </div>
          }
          confirmText={permission.confirmationLabel ?? action.label}
          isLoading={lifecycleAction.isPending}
          destructive={
            action.kind === 'stop' ||
            action.kind === 'restart' ||
            action.kind === 'uninstall'
          }
          handleConfirm={() => runLifecycleAction(true)}
        />
      </>
    )
  }

  return button(() => runLifecycleAction(false))
}
