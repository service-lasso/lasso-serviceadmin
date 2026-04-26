/* eslint-disable react-refresh/only-export-components */
import { Link } from '@tanstack/react-router'
import { type ColumnDef } from '@tanstack/react-table'
import { ExternalLink, Search, Star } from 'lucide-react'
import {
  useFavoriteFeatureState,
  useToggleFavorite,
} from '@/lib/service-lasso-dashboard/hooks'
import { type DashboardService } from '@/lib/service-lasso-dashboard/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTableColumnHeader } from '@/components/data-table'
import { LongText } from '@/components/long-text'
import {
  getServiceUpdateDescription,
  ServiceUpdateBadge,
} from '@/components/service-update-status'
import { DataTableRowActions } from './data-table-row-actions'

function renderStatusBadge(status: DashboardService['status']) {
  if (status === 'running') {
    return (
      <Badge className='bg-emerald-600 hover:bg-emerald-600'>Running</Badge>
    )
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

const statusSortRank: Record<DashboardService['status'], number> = {
  degraded: 0,
  stopped: 1,
  running: 2,
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
    id: 'updates',
    accessorFn: (row) => row.updates?.state ?? 'unknown',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Updates' />
    ),
    cell: ({ row }) => {
      const service = row.original
      return (
        <div className='flex max-w-[220px] flex-col gap-1'>
          <ServiceUpdateBadge updates={service.updates} />
          <span className='line-clamp-2 text-xs text-muted-foreground'>
            {getServiceUpdateDescription(service.updates)}
          </span>
        </div>
      )
    },
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
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
