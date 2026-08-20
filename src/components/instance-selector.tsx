import { ChevronsUpDown, Monitor, Plus, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SidebarMenuButton, useSidebar } from '@/components/ui/sidebar'
import { activeInstanceSelectorState } from '@/components/instance-selector-model'
import type { FleetInstanceSummary } from '@/features/fleet-overview/fleet-overview'

function brokerLabel(instance: FleetInstanceSummary) {
  return instance.brokerState.replace('-', ' ')
}

type InstanceSelectorProps = {
  align?: 'start' | 'center' | 'end'
  className?: string
  side?: 'top' | 'right' | 'bottom' | 'left'
}

export function InstanceSelector({
  align = 'start',
  className,
  side = 'bottom',
}: InstanceSelectorProps) {
  const { endpoint, instance, label, remoteConnectState } =
    activeInstanceSelectorState
  const { isMobile, state } = useSidebar()
  const isCollapsed = state === 'collapsed' && !isMobile

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          size='lg'
          aria-label={`Service Lasso instance selector: ${label} (${endpoint})`}
          tooltip={
            isCollapsed
              ? {
                  children: `${label} - ${endpoint}`,
                }
              : undefined
          }
          className={cn(
            'h-9 border bg-background data-[state=open]:bg-accent data-[state=open]:text-accent-foreground',
            isCollapsed ? 'min-w-0 justify-center px-0' : 'min-w-[220px] px-2',
            className
          )}
        >
          <div className='flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground'>
            <Monitor className='size-4' />
          </div>
          {!isCollapsed && (
            <>
              <div className='grid flex-1 text-left text-sm leading-tight'>
                <span className='truncate font-medium'>{label}</span>
                <span className='truncate text-xs text-muted-foreground'>
                  {endpoint}
                </span>
              </div>
              <ChevronsUpDown className='ml-auto size-4' />
            </>
          )}
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className='w-[--radix-dropdown-menu-trigger-width] min-w-72 rounded-lg'
        align={align}
        side={side}
        sideOffset={4}
      >
        <DropdownMenuLabel className='font-normal'>
          <div className='grid gap-1 text-sm'>
            <span className='font-medium'>Service Lasso instance</span>
            <span className='text-xs text-muted-foreground'>
              Local on-prem control is selected.
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className='items-start gap-3'>
          <ShieldCheck className='mt-0.5 size-4 text-emerald-600' />
          <div className='grid gap-1'>
            <div className='flex items-center gap-2'>
              <span className='font-medium'>{label}</span>
              <span className='rounded-sm bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground uppercase'>
                Active
              </span>
            </div>
            <span className='text-xs text-muted-foreground'>
              {instance.name} · {instance.region} · {brokerLabel(instance)}
            </span>
            <span className='text-xs text-muted-foreground'>
              {instance.discoveryRef}
            </span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className='items-start gap-3'>
          <Plus className='mt-0.5 size-4' />
          <div className='grid gap-1'>
            <span className='font-medium'>Connect remote</span>
            <span className='text-xs text-muted-foreground'>
              {remoteConnectState}
            </span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
