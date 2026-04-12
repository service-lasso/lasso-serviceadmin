import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  Activity,
  ArrowUpDown,
  Clock3,
  HeartPulse,
  RotateCcw,
  Search,
} from 'lucide-react'
import { usePageMetadata } from '@/lib/page-metadata'
import { useServices } from '@/lib/service-lasso-dashboard/hooks'
import type { DashboardService } from '@/lib/service-lasso-dashboard/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'

type RuntimeSortKey =
  | 'service'
  | 'status'
  | 'health'
  | 'uptime'
  | 'lastCheck'
  | 'lastRestart'
  | 'runtime'
type SortDirection = 'asc' | 'desc'

function RuntimeLoading() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className='h-6 w-44' />
        <Skeleton className='h-4 w-96' />
      </CardHeader>
      <CardContent>
        <Skeleton className='h-[420px] w-full' />
      </CardContent>
    </Card>
  )
}

function SortableHead({
  label,
  active,
  direction,
  onClick,
}: {
  label: string
  active: boolean
  direction: SortDirection
  onClick: () => void
}) {
  return (
    <Button
      type='button'
      variant='ghost'
      size='sm'
      className='h-auto px-0 py-0 font-medium hover:bg-transparent'
      onClick={onClick}
    >
      {label}
      <ArrowUpDown
        className={`ml-2 size-3.5 ${active ? 'text-foreground' : 'text-muted-foreground'}`}
      />
      <span className='sr-only'>
        Sort {label} {direction === 'asc' ? 'descending' : 'ascending'}
      </span>
    </Button>
  )
}

function compareText(a: string, b: string, direction: SortDirection) {
  return direction === 'asc' ? a.localeCompare(b) : b.localeCompare(a)
}

function StatusBadge({ status }: { status: DashboardService['status'] }) {
  if (status === 'running') {
    return (
      <Badge className='bg-emerald-600 hover:bg-emerald-600'>Running</Badge>
    )
  }
  if (status === 'degraded') return <Badge variant='secondary'>Degraded</Badge>
  return <Badge variant='outline'>Stopped</Badge>
}

function HealthBadge({
  health,
}: {
  health: DashboardService['runtimeHealth']['health']
}) {
  if (health === 'healthy') {
    return (
      <Badge className='bg-emerald-600 hover:bg-emerald-600'>Healthy</Badge>
    )
  }
  if (health === 'warning') return <Badge variant='secondary'>Warning</Badge>
  return <Badge variant='destructive'>Critical</Badge>
}

export function Runtime() {
  usePageMetadata({
    title: 'Service Admin - Runtime',
    description: 'Service Admin runtime status and health view.',
  })

  const servicesQuery = useServices()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<
    'all' | DashboardService['status']
  >('all')
  const [healthFilter, setHealthFilter] = useState<
    'all' | DashboardService['runtimeHealth']['health']
  >('all')
  const [sortKey, setSortKey] = useState<RuntimeSortKey>('service')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  const rows = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    const filtered = (servicesQuery.data ?? []).filter((service) => {
      if (statusFilter !== 'all' && service.status !== statusFilter)
        return false
      if (
        healthFilter !== 'all' &&
        service.runtimeHealth.health !== healthFilter
      ) {
        return false
      }

      if (!normalized) return true
      return [
        service.name,
        service.id,
        service.status,
        service.runtimeHealth.health,
        service.runtimeHealth.summary,
        service.runtimeHealth.uptime,
        service.runtimeHealth.lastCheckAt,
        service.runtimeHealth.lastRestartAt ?? '',
        service.metadata.runtime,
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalized)
    })

    return filtered.sort((a, b) => {
      if (sortKey === 'service') {
        return compareText(a.name, b.name, sortDirection)
      }
      if (sortKey === 'status') {
        return compareText(a.status, b.status, sortDirection)
      }
      if (sortKey === 'health') {
        return compareText(
          a.runtimeHealth.health,
          b.runtimeHealth.health,
          sortDirection
        )
      }
      if (sortKey === 'uptime') {
        return compareText(
          a.runtimeHealth.uptime,
          b.runtimeHealth.uptime,
          sortDirection
        )
      }
      if (sortKey === 'lastCheck') {
        return compareText(
          a.runtimeHealth.lastCheckAt,
          b.runtimeHealth.lastCheckAt,
          sortDirection
        )
      }
      if (sortKey === 'lastRestart') {
        return compareText(
          a.runtimeHealth.lastRestartAt ?? '',
          b.runtimeHealth.lastRestartAt ?? '',
          sortDirection
        )
      }

      return compareText(a.metadata.runtime, b.metadata.runtime, sortDirection)
    })
  }, [
    healthFilter,
    query,
    servicesQuery.data,
    sortDirection,
    sortKey,
    statusFilter,
  ])

  const toggleSort = (key: RuntimeSortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDirection('asc')
  }

  return (
    <>
      <Header fixed>
        <div className='relative w-full max-w-sm'>
          <Search className='absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder='Search runtime status, health, summaries, or checks...'
            className='pl-9'
          />
        </div>
        <div className='ms-auto flex items-center space-x-4'>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>Runtime</h2>
            <p className='text-muted-foreground'>
              Search, filter, and sort runtime state, health, and check history
              for every service.
            </p>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Button variant='outline' size='sm' asChild>
              <Link to='/services'>Services</Link>
            </Button>
            <Button variant='outline' size='sm' asChild>
              <Link to='/logs'>Logs</Link>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Activity className='size-4' /> Runtime filters
            </CardTitle>
            <CardDescription>
              Narrow runtime rows before sorting and drilling into details.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-3'>
            <div className='flex flex-wrap gap-2'>
              <span className='self-center text-sm text-muted-foreground'>
                Status:
              </span>
              {(['all', 'running', 'degraded', 'stopped'] as const).map(
                (value) => (
                  <Button
                    key={value}
                    type='button'
                    size='sm'
                    variant={statusFilter === value ? 'default' : 'outline'}
                    onClick={() => setStatusFilter(value)}
                  >
                    {value}
                  </Button>
                )
              )}
            </div>
            <div className='flex flex-wrap gap-2'>
              <span className='self-center text-sm text-muted-foreground'>
                Health:
              </span>
              {(['all', 'healthy', 'warning', 'critical'] as const).map(
                (value) => (
                  <Button
                    key={value}
                    type='button'
                    size='sm'
                    variant={healthFilter === value ? 'default' : 'outline'}
                    onClick={() => setHealthFilter(value)}
                  >
                    {value}
                  </Button>
                )
              )}
            </div>
          </CardContent>
        </Card>

        {servicesQuery.isLoading ? (
          <RuntimeLoading />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <HeartPulse className='size-4' /> Service runtime table
              </CardTitle>
              <CardDescription>
                Proper operator table with search, filters, and sortable
                columns.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className='overflow-x-auto rounded-md border'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <SortableHead
                          label='Service'
                          active={sortKey === 'service'}
                          direction={sortDirection}
                          onClick={() => toggleSort('service')}
                        />
                      </TableHead>
                      <TableHead>
                        <SortableHead
                          label='Status'
                          active={sortKey === 'status'}
                          direction={sortDirection}
                          onClick={() => toggleSort('status')}
                        />
                      </TableHead>
                      <TableHead>
                        <SortableHead
                          label='Health'
                          active={sortKey === 'health'}
                          direction={sortDirection}
                          onClick={() => toggleSort('health')}
                        />
                      </TableHead>
                      <TableHead>
                        <SortableHead
                          label='Uptime'
                          active={sortKey === 'uptime'}
                          direction={sortDirection}
                          onClick={() => toggleSort('uptime')}
                        />
                      </TableHead>
                      <TableHead>
                        <SortableHead
                          label='Last check'
                          active={sortKey === 'lastCheck'}
                          direction={sortDirection}
                          onClick={() => toggleSort('lastCheck')}
                        />
                      </TableHead>
                      <TableHead>
                        <SortableHead
                          label='Last restart'
                          active={sortKey === 'lastRestart'}
                          direction={sortDirection}
                          onClick={() => toggleSort('lastRestart')}
                        />
                      </TableHead>
                      <TableHead>
                        <SortableHead
                          label='Runtime'
                          active={sortKey === 'runtime'}
                          direction={sortDirection}
                          onClick={() => toggleSort('runtime')}
                        />
                      </TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.length ? (
                      rows.map((service) => (
                        <TableRow key={service.id}>
                          <TableCell>
                            <div className='space-y-1'>
                              <div className='font-medium'>{service.name}</div>
                              <div className='text-xs text-muted-foreground'>
                                {service.id}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={service.status} />
                          </TableCell>
                          <TableCell>
                            <HealthBadge
                              health={service.runtimeHealth.health}
                            />
                          </TableCell>
                          <TableCell>{service.runtimeHealth.uptime}</TableCell>
                          <TableCell className='text-sm text-muted-foreground'>
                            {service.runtimeHealth.lastCheckAt}
                          </TableCell>
                          <TableCell className='text-sm text-muted-foreground'>
                            {service.runtimeHealth.lastRestartAt ??
                              'Not recorded'}
                          </TableCell>
                          <TableCell>{service.metadata.runtime}</TableCell>
                          <TableCell>
                            <div className='flex flex-wrap gap-2'>
                              <Button variant='outline' size='sm' asChild>
                                <Link
                                  to='/runtime'
                                  search={{ service: service.id }}
                                >
                                  <RotateCcw className='mr-2 size-3.5' />
                                  Focus
                                </Link>
                              </Button>
                              <Button variant='outline' size='sm' asChild>
                                <Link
                                  to='/logs'
                                  search={{ service: service.id }}
                                >
                                  <Clock3 className='mr-2 size-3.5' />
                                  Logs
                                </Link>
                              </Button>
                              <Button variant='outline' size='sm' asChild>
                                <Link
                                  to='/services/$serviceId'
                                  params={{ serviceId: service.id }}
                                >
                                  Details
                                </Link>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} className='h-24 text-center'>
                          No runtime rows match the current search/filters.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </Main>
    </>
  )
}
