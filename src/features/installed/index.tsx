import { type ElementType, useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Copy, FolderCog, PackageCheck, ScanSearch, Search } from 'lucide-react'
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

export function Installed() {
  const servicesQuery = useServices()
  const [query, setQuery] = useState('')

  const services = useMemo(() => {
    const raw = servicesQuery.data ?? []
    const normalized = query.trim().toLowerCase()
    if (!normalized) return raw

    return raw.filter((service) =>
      [
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
    )
  }, [query, servicesQuery.data])

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
              Search installed services and copy the exact install, config, and
              data paths from one table view.
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

        {servicesQuery.isLoading ? (
          <InstalledLoading />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <PackageCheck className='size-4' /> Installed services
              </CardTitle>
              <CardDescription>
                Searchable operator table for install state, version/build
                facts, and path copy actions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className='overflow-x-auto rounded-md border'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Service</TableHead>
                      <TableHead>Installed</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Runtime</TableHead>
                      <TableHead>Package</TableHead>
                      <TableHead>Install path</TableHead>
                      <TableHead>Config path</TableHead>
                      <TableHead>Data path</TableHead>
                      <TableHead>Open</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {services.length ? (
                      services.map((service) => (
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
                          No installed services match the current search.
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
