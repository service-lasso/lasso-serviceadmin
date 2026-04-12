import { type ElementType, useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  ArrowUpDown,
  Copy,
  FolderCog,
  PackageCheck,
  ScanSearch,
  Search,
} from 'lucide-react'
import { usePageMetadata } from '@/lib/page-metadata'
import { useServices } from '@/lib/service-lasso-dashboard/hooks'
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

type InstalledSortKey =
  | 'service'
  | 'installed'
  | 'version'
  | 'runtime'
  | 'package'
  | 'installPath'
  | 'configPath'
  | 'dataPath'
type SortDirection = 'asc' | 'desc'

function PathCell({ icon, value }: { icon: ElementType; value?: string }) {
  const Icon = icon

  return (
    <div className='space-y-2'>
      <div className='flex items-center gap-2'>
        <Icon className='size-4 text-muted-foreground' />
        <span className='text-sm break-all text-muted-foreground'>
          {value ?? 'Not recorded'}
        </span>
      </div>
      <Button
        type='button'
        variant='outline'
        size='sm'
        disabled={!value}
        onClick={() => {
          if (value) void navigator.clipboard.writeText(value)
        }}
      >
        <Copy className='mr-2 size-3.5' /> Copy
      </Button>
    </div>
  )
}

function InstalledLoading() {
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

export function Installed() {
  usePageMetadata({
    title: 'Service Admin - Installed',
    description: 'Service Admin installed services and paths view.',
  })

  const servicesQuery = useServices()
  const [query, setQuery] = useState('')
  const [installedFilter, setInstalledFilter] = useState<'all' | 'yes' | 'no'>(
    'all'
  )
  const [sortKey, setSortKey] = useState<InstalledSortKey>('service')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  const rows = useMemo(() => {
    const normalized = query.trim().toLowerCase()

    const filtered = (servicesQuery.data ?? []).filter((service) => {
      if (installedFilter === 'yes' && !service.installed) return false
      if (installedFilter === 'no' && service.installed) return false

      if (!normalized) return true
      return [
        service.name,
        service.id,
        service.metadata.version,
        service.metadata.runtime,
        service.metadata.packageId ?? '',
        service.metadata.installPath ?? '',
        service.metadata.configPath ?? '',
        service.metadata.dataPath ?? '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalized)
    })

    return filtered.sort((a, b) => {
      if (sortKey === 'service')
        return compareText(a.name, b.name, sortDirection)
      if (sortKey === 'installed') {
        return sortDirection === 'asc'
          ? Number(a.installed) - Number(b.installed)
          : Number(b.installed) - Number(a.installed)
      }
      if (sortKey === 'version') {
        return compareText(
          a.metadata.version,
          b.metadata.version,
          sortDirection
        )
      }
      if (sortKey === 'runtime') {
        return compareText(
          a.metadata.runtime,
          b.metadata.runtime,
          sortDirection
        )
      }
      if (sortKey === 'package') {
        return compareText(
          a.metadata.packageId ?? '',
          b.metadata.packageId ?? '',
          sortDirection
        )
      }
      if (sortKey === 'installPath') {
        return compareText(
          a.metadata.installPath ?? '',
          b.metadata.installPath ?? '',
          sortDirection
        )
      }
      if (sortKey === 'configPath') {
        return compareText(
          a.metadata.configPath ?? '',
          b.metadata.configPath ?? '',
          sortDirection
        )
      }

      return compareText(
        a.metadata.dataPath ?? '',
        b.metadata.dataPath ?? '',
        sortDirection
      )
    })
  }, [installedFilter, query, servicesQuery.data, sortDirection, sortKey])

  const toggleSort = (key: InstalledSortKey) => {
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
            placeholder='Search installed services, versions, packages, or paths...'
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
            <h2 className='text-2xl font-bold tracking-tight'>Installed</h2>
            <p className='text-muted-foreground'>
              Search, filter, and sort installed services with path copy
              actions.
            </p>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Button variant='outline' size='sm' asChild>
              <Link to='/services'>Services</Link>
            </Button>
            <Button variant='outline' size='sm' asChild>
              <Link to='/network'>Network</Link>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <PackageCheck className='size-4' /> Installed filters
            </CardTitle>
            <CardDescription>
              Narrow installed state before sorting rows.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='flex flex-wrap gap-2'>
              <Button
                type='button'
                size='sm'
                variant={installedFilter === 'all' ? 'default' : 'outline'}
                onClick={() => setInstalledFilter('all')}
              >
                all
              </Button>
              <Button
                type='button'
                size='sm'
                variant={installedFilter === 'yes' ? 'default' : 'outline'}
                onClick={() => setInstalledFilter('yes')}
              >
                installed
              </Button>
              <Button
                type='button'
                size='sm'
                variant={installedFilter === 'no' ? 'default' : 'outline'}
                onClick={() => setInstalledFilter('no')}
              >
                missing
              </Button>
            </div>
          </CardContent>
        </Card>

        {servicesQuery.isLoading ? (
          <InstalledLoading />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <PackageCheck className='size-4' /> Installed services table
              </CardTitle>
              <CardDescription>
                Proper table with search, filters, and sortable columns.
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
                          label='Installed'
                          active={sortKey === 'installed'}
                          direction={sortDirection}
                          onClick={() => toggleSort('installed')}
                        />
                      </TableHead>
                      <TableHead>
                        <SortableHead
                          label='Version'
                          active={sortKey === 'version'}
                          direction={sortDirection}
                          onClick={() => toggleSort('version')}
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
                      <TableHead>
                        <SortableHead
                          label='Package'
                          active={sortKey === 'package'}
                          direction={sortDirection}
                          onClick={() => toggleSort('package')}
                        />
                      </TableHead>
                      <TableHead>
                        <SortableHead
                          label='Install path'
                          active={sortKey === 'installPath'}
                          direction={sortDirection}
                          onClick={() => toggleSort('installPath')}
                        />
                      </TableHead>
                      <TableHead>
                        <SortableHead
                          label='Config path'
                          active={sortKey === 'configPath'}
                          direction={sortDirection}
                          onClick={() => toggleSort('configPath')}
                        />
                      </TableHead>
                      <TableHead>
                        <SortableHead
                          label='Data path'
                          active={sortKey === 'dataPath'}
                          direction={sortDirection}
                          onClick={() => toggleSort('dataPath')}
                        />
                      </TableHead>
                      <TableHead>Open</TableHead>
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
                            <Badge
                              variant={
                                service.installed ? 'default' : 'outline'
                              }
                            >
                              {service.installed ? 'Installed' : 'Missing'}
                            </Badge>
                          </TableCell>
                          <TableCell>{service.metadata.version}</TableCell>
                          <TableCell>{service.metadata.runtime}</TableCell>
                          <TableCell className='max-w-[220px] text-sm break-all text-muted-foreground'>
                            {service.metadata.packageId ?? 'Not recorded'}
                          </TableCell>
                          <TableCell className='min-w-[220px]'>
                            <PathCell
                              icon={FolderCog}
                              value={service.metadata.installPath}
                            />
                          </TableCell>
                          <TableCell className='min-w-[220px]'>
                            <PathCell
                              icon={ScanSearch}
                              value={service.metadata.configPath}
                            />
                          </TableCell>
                          <TableCell className='min-w-[220px]'>
                            <PathCell
                              icon={FolderCog}
                              value={service.metadata.dataPath}
                            />
                          </TableCell>
                          <TableCell>
                            <Button variant='outline' size='sm' asChild>
                              <Link
                                to='/services/$serviceId'
                                params={{ serviceId: service.id }}
                              >
                                Details
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={9} className='h-24 text-center'>
                          No installed services match the current
                          search/filters.
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
