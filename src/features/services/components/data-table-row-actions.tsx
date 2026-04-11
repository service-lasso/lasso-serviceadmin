import { DotsHorizontalIcon } from '@radix-ui/react-icons'
import { Link } from '@tanstack/react-router'
import { type Row } from '@tanstack/react-table'
import { ExternalLink, Star } from 'lucide-react'
import { type DashboardService } from '@/lib/service-lasso-dashboard/types'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type DataTableRowActionsProps = {
  row: Row<DashboardService>
}

export function DataTableRowActions({ row }: DataTableRowActionsProps) {
  const service = row.original
  const primaryLink = service.links[0]

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant='ghost'
          className='flex h-8 w-8 p-0 data-[state=open]:bg-muted'
        >
          <DotsHorizontalIcon className='h-4 w-4' />
          <span className='sr-only'>Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-[190px]'>
        <DropdownMenuItem asChild>
          <Link to='/services/$serviceId' params={{ serviceId: service.id }}>
            View details
            <DropdownMenuShortcut>
              <ExternalLink size={16} />
            </DropdownMenuShortcut>
          </Link>
        </DropdownMenuItem>
        {primaryLink ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href={primaryLink.url} target='_blank' rel='noreferrer'>
                Open {primaryLink.label}
                <DropdownMenuShortcut>
                  <ExternalLink size={16} />
                </DropdownMenuShortcut>
              </a>
            </DropdownMenuItem>
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          {service.favorite ? 'Favorited on dashboard' : 'Not a favorite yet'}
          <DropdownMenuShortcut>
            <Star size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
