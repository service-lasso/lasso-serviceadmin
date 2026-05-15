/* eslint-disable react-refresh/only-export-components */
import { Link } from '@tanstack/react-router'
import { type ColumnDef } from '@tanstack/react-table'
import {
  ExternalLink,
  Play,
  RotateCcw,
  Search,
  Square,
  Star,
} from 'lucide-react'
import { lifecycleActionButtonClass } from '@/lib/service-lasso-dashboard/action-styles'
import {
  useFavoriteFeatureState,
  useDashboardAction,
  useToggleFavorite,
} from '@/lib/service-lasso-dashboard/hooks'
import { type DashboardService } from '@/lib/service-lasso-dashboard/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTableColumnHeader } from '@/components/data-table'
import { LongText } from '@/components/long-text'
import { DataTableRowActions } from './data-table-row-actions'

function renderStatusBadge(status: DashboardService['status']) {
  if (status === 'running') {
    return (
      <Badge className='bg-emerald-600 hover:bg-emerald-600'>Running</Badge>
    )
  }

  if (status === 'available') {
    return <Badge className='bg-sky-600 hover:bg-sky-600'>Available</Badge>
  }

  if (status === 'degraded') {
    return <Badge variant='secondary'>Degraded</Badge>
  }

  return <Badge variant='outline'>Stopped</Badge>
}

function FavoriteCell({ service }: { service: DashboardService }) {
  const toggleFavorite = useToggleFavorite()
  const favoriteFeature = useFavoriteFeatureState()

  return (
    <button
      type='button'
      aria-label={service.favorite ? 'Remove favorite' : 'Add favorite'}
      title={
        favoriteFeature.enabled
          ? service.favorite
            ? 'Remove favorite'
            : 'Add favorite'
          : 'Favorites editing is disabled until Service Lasso API endpoint and favorites flag are enabled'
      }
      disabled={!favoriteFeature.enabled}
      className='inline-flex items-center rounded-md border p-2 hover:bg-accent/40 disabled:cursor-not-allowed disabled:opacity-50'
      onClick={(event) => {
        event.stopPropagation()
        if (!favoriteFeature.enabled) return
        void toggleFavorite.mutateAsync(service.id)
      }}
    >
      <Star
        className={`size-4 ${service.favorite ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground'}`}
      />
    </button>
  )
}

function ServiceLifecycleControls({ service }: { service: DashboardService }) {
  const actionMutation = useDashboardAction()
  const disabled = actionMutation.isPending

  const runAction = (action: 'start' | 'stop' | 'restart') => {
    actionMutation.mutate({
      kind: 'service-lifecycle',
      serviceId: service.id,
      action,
    })
  }

  return (
    <div className='flex items-center gap-1'>
      <Button
        type='button'
        size='icon'
        variant='outline'
        className={lifecycleActionButtonClass('start', 'size-8')}
        aria-label={`Start ${service.name}`}
        title={`Start ${service.name}`}
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation()
          runAction('start')
        }}
      >
        <Play className='size-3.5' />
      </Button>
      <Button
        type='button'
        size='icon'
        variant='outline'
        className={lifecycleActionButtonClass('stop', 'size-8')}
        aria-label={`Stop ${service.name}`}
        title={`Stop ${service.name}`}
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation()
          runAction('stop')
        }}
      >
        <Square className='size-3.5' />
      </Button>
      <Button
        type='button'
        size='icon'
        variant='outline'
        className={lifecycleActionButtonClass('restart', 'size-8')}
        aria-label={`Restart ${service.name}`}
        title={`Restart ${service.name}`}
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation()
          runAction('restart')
        }}
      >
        <RotateCcw className='size-3.5' />
      </Button>
    </div>
  )
}

const statusSortRank: Record<DashboardService['status'], number> = {
  degraded: 0,
  stopped: 1,
  available: 2,
  running: 3,
}

export const servicesColumns: ColumnDef<DashboardService>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Service' />
    ),
    cell: ({ row }) => {
      const service = row.original
      return (
        <div className='flex min-w-0 flex-col gap-1'>
          <Link
            to='/services/$serviceId'
            params={{ serviceId: service.id }}
            className='truncate font-medium hover:underline'
          >
            {service.name}
          </Link>
          <LongText className='max-w-[280px] text-xs text-muted-foreground'>
            {service.note}
          </LongText>
        </div>
      )
    },
    enableHiding: false,
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Status' />
    ),
    cell: ({ row }) => renderStatusBadge(row.original.status),
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
    sortingFn: (rowA, rowB, columnId) => {
      const left =
        statusSortRank[rowA.getValue(columnId) as DashboardService['status']]
      const right =
        statusSortRank[rowB.getValue(columnId) as DashboardService['status']]
      return left - right
    },
  },
  {
    id: 'favorite',
    accessorFn: (row) => (row.favorite ? 'favorite' : 'standard'),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Favorite' />
    ),
    cell: ({ row }) => <FavoriteCell service={row.original} />,
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
    sortingFn: (rowA, rowB) =>
      Number(rowA.original.favorite) - Number(rowB.original.favorite),
  },
  {
    id: 'links',
    accessorFn: (row) => row.links.length,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Links' />
    ),
    cell: ({ row }) => {
      const service = row.original
      return (
        <div className='flex flex-wrap items-center gap-2'>
          {service.links.slice(0, 2).map((link) => (
            <Button
              key={`${service.id}-${link.label}`}
              asChild
              size='sm'
              variant='outline'
            >
              <a href={link.url} target='_blank' rel='noreferrer'>
                {link.label}
                <ExternalLink className='ml-2 size-3.5' />
              </a>
            </Button>
          ))}
          {service.links.length > 2 ? (
            <span className='text-xs text-muted-foreground'>
              +{service.links.length - 2} more
            </span>
          ) : null}
        </div>
      )
    },
    enableSorting: false,
  },
  {
    id: 'controls',
    header: 'Controls',
    cell: ({ row }) => <ServiceLifecycleControls service={row.original} />,
    enableSorting: false,
    enableHiding: false,
  },
  {
    id: 'open',
    header: 'Open',
    cell: ({ row }) => (
      <Button size='sm' variant='outline' asChild>
        <Link to='/services/$serviceId' params={{ serviceId: row.original.id }}>
          <Search className='mr-2 size-3.5' />
          Details
        </Link>
      </Button>
    ),
    enableSorting: false,
  },
  {
    id: 'actions',
    cell: DataTableRowActions,
  },
]

