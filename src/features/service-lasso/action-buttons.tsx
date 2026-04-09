import type { ComponentType } from 'react'
import { Loader2, Play, RotateCcw, Square, Terminal } from 'lucide-react'
import { useRunServiceAction } from '@/lib/service-lasso-api/hooks'
import type { ServiceAction } from '@/lib/service-lasso-api/types'
import { Button } from '@/components/ui/button'

const iconByAction: Record<
  ServiceAction,
  ComponentType<{ className?: string }>
> = {
  start: Play,
  stop: Square,
  restart: RotateCcw,
  reload: RotateCcw,
  install: Play,
  config: RotateCcw,
  reset: RotateCcw,
  open: Play,
  logs: Terminal,
}

export function ServiceActionButtons({
  serviceId,
  actions,
}: {
  serviceId: string
  actions: ServiceAction[]
}) {
  const mutation = useRunServiceAction()

  return (
    <div className='flex flex-wrap gap-2'>
      {actions.map((action) => {
        const Icon = iconByAction[action]
        const busy = mutation.isPending && mutation.variables?.action === action

        return (
          <Button
            key={action}
            variant='outline'
            size='sm'
            disabled={mutation.isPending}
            onClick={() => mutation.mutate({ serviceId, action })}
          >
            {busy ? (
              <Loader2 className='mr-2 size-4 animate-spin' />
            ) : (
              <Icon className='mr-2 size-4' />
            )}
            {action}
          </Button>
        )
      })}
    </div>
  )
}
