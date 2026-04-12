import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  ArrowUpDown,
  Copy,
  Globe,
  Link2,
  Network as NetworkIcon,
  Search,
} from 'lucide-react'
import { usePageMetadata } from '@/lib/page-metadata'
import { useServices } from '@/lib/service-lasso-dashboard/hooks'
import type { DashboardService } from '@/lib/service-lasso-dashboard/types'
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

type NetworkSortKey =
  | 'service'
  | 'endpoint'
  | 'url'
  | 'bind'
  | 'port'
  | 'exposure'
type SortDirection = 'asc' | 'desc'

type NetworkRow = {
  service: DashboardService
  endpoint: DashboardService['endpoints'][number]
}

function NetworkLoading() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className='h-6 w-40' />
        <Skeleton className='h-4 w-80' />
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

export function Network() {
  usePageMetadata({
    title: 'Service Admin - Network',
    description: 'Service Admin network endpoints and exposure view.',
  })

  const servicesQuery = useServices()
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<NetworkSortKey>('service')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  const endpointRows = useMemo(() => {
    const raw: NetworkRow[] = (servicesQuery.data ?? []).flatMap((service) =>
      service.endpoints.map((endpoint) => ({ service, endpoint }))
    )
    const normalized = query.trim().toLowerCase()

    const filtered = !normalized
      ? raw
      : raw.filter(({ service, endpoint }) =>
          [
            service.name,
            service.id,
            endpoint.label,
            endpoint.url,
            endpoint.bind,
            endpoint.protocol,
            endpoint.exposure,
            String(endpoint.port),
          ]
            .join(' ')
            .toLowerCase()
            .includes(normalized)
        )

    return filtered.sort((a, b) => {
      if (sortKey === 'service') {
        return compareText(a.service.name, b.service.name, sortDirection)
      }
      if (sortKey === 'endpoint') {
        return compareText(a.endpoint.label, b.endpoint.label, sortDirection)
      }
      if (sortKey === 'url') {
        return compareText(a.endpoint.url, b.endpoint.url, sortDirection)
      }
      if (sortKey === 'bind') {
        return compareText(a.endpoint.bind, b.endpoint.bind, sortDirection)
      }
      if (sortKey === 'port') {
        return sortDirection === 'asc'
          ? a.endpoint.port - b.endpoint.port
          : b.endpoint.port - a.endpoint.port
      }

      return compareText(
        a.endpoint.exposure,
        b.endpoint.exposure,
        sortDirection
      )
    })
  }, [query, servicesQuery.data, sortDirection, sortKey])

  const toggleSort = (key: NetworkSortKey) => {
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
            placeholder='Search services, URLs, binds, ports, or exposure...'
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
            <h2 className='text-2xl font-bold tracking-tight'>Network</h2>
            <p className='text-muted-foreground'>
              Search service endpoints, sort the columns, copy URLs quickly, and
              inspect bind/exposure facts in one table.
            </p>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Button variant='outline' size='sm' asChild>
              <Link to='/services'>Services</Link>
            </Button>
            <Button variant='outline' size='sm' asChild>
              <Link to='/runtime'>Runtime</Link>
            </Button>
          </div>
        </div>

        {servicesQuery.isLoading ? (
          <NetworkLoading />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <NetworkIcon className='size-4' /> Service endpoints
              </CardTitle>
              <CardDescription>
                Searchable operator table with sortable columns and copy/open
                actions for every service URL.
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
                          label='Endpoint'
                          active={sortKey === 'endpoint'}
                          direction={sortDirection}
                          onClick={() => toggleSort('endpoint')}
                        />
                      </TableHead>
                      <TableHead>
                        <SortableHead
                          label='URL'
                          active={sortKey === 'url'}
                          direction={sortDirection}
                          onClick={() => toggleSort('url')}
                        />
                      </TableHead>
                      <TableHead>
                        <SortableHead
                          label='Bind'
                          active={sortKey === 'bind'}
                          direction={sortDirection}
                          onClick={() => toggleSort('bind')}
                        />
                      </TableHead>
                      <TableHead>
                        <SortableHead
                          label='Port'
                          active={sortKey === 'port'}
                          direction={sortDirection}
                          onClick={() => toggleSort('port')}
                        />
                      </TableHead>
                      <TableHead>
                        <SortableHead
                          label='Exposure'
                          active={sortKey === 'exposure'}
                          direction={sortDirection}
                          onClick={() => toggleSort('exposure')}
                        />
                      </TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {endpointRows.length ? (
                      endpointRows.map(({ service, endpoint }) => (
                        <TableRow key={`${service.id}-${endpoint.url}`}>
                          <TableCell>
                            <div className='space-y-1'>
                              <div className='font-medium'>{service.name}</div>
                              <div className='text-xs text-muted-foreground'>
                                {service.id}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className='flex items-center gap-2'>
                              <Globe className='size-4 text-muted-foreground' />
                              {endpoint.label}
                            </div>
                          </TableCell>
                          <TableCell className='max-w-[280px] text-sm break-all text-muted-foreground'>
                            {endpoint.url}
                          </TableCell>
                          <TableCell>{endpoint.bind}</TableCell>
                          <TableCell>{endpoint.port}</TableCell>
                          <TableCell>{endpoint.exposure}</TableCell>
                          <TableCell>
                            <div className='flex flex-wrap gap-2'>
                              <Button
                                type='button'
                                variant='outline'
                                size='sm'
                                onClick={() =>
                                  void navigator.clipboard.writeText(
                                    endpoint.url
                                  )
                                }
                              >
                                <Copy className='mr-2 size-3.5' /> Copy URL
                              </Button>
                              <Button variant='outline' size='sm' asChild>
                                <a
                                  href={endpoint.url}
                                  target='_blank'
                                  rel='noreferrer'
                                >
                                  <Link2 className='mr-2 size-3.5' /> Open
                                </a>
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
                        <TableCell colSpan={7} className='h-24 text-center'>
                          No endpoints match the current search.
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
