import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Activity, Clock3, HeartPulse, RotateCcw, Search } from 'lucide-react'
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

function RuntimeLoading() {
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

export function Runtime() {
  usePageMetadata({
    title: 'Service Admin - Runtime',
    description: 'Service Admin runtime status and health view.',
  })

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
        service.status,
        service.runtimeHealth.health,
        service.runtimeHealth.summary,
        service.runtimeHealth.uptime,
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
            placeholder='Search services, status, health, or runtime summary...'
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
              Search runtime state, health timing, and restart context in one
              compact operator table.
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
          <RuntimeLoading />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Activity className='size-4' /> Runtime state table
              </CardTitle>
              <CardDescription>
                Searchable runtime/health table for large service sets.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className='overflow-x-auto rounded-md border'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Service</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Health</TableHead>
                      <TableHead>Uptime</TableHead>
                      <TableHead>Last check</TableHead>
                      <TableHead>Last restart</TableHead>
                      <TableHead>Summary</TableHead>
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
                            <Badge variant='outline'>{service.status}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className='flex items-center gap-2'>
                              <HeartPulse className='size-4 text-muted-foreground' />
                              {service.runtimeHealth.health}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className='flex items-center gap-2'>
                              <RotateCcw className='size-4 text-muted-foreground' />
                              {service.runtimeHealth.uptime}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                              <Clock3 className='size-4' />
                              {service.runtimeHealth.lastCheckAt}
                            </div>
                          </TableCell>
                          <TableCell className='text-sm text-muted-foreground'>
                            {service.runtimeHealth.lastRestartAt ??
                              'Not recorded'}
                          </TableCell>
                          <TableCell className='max-w-[280px] text-sm text-muted-foreground'>
                            {service.runtimeHealth.summary}
                          </TableCell>
                          <TableCell>
                            <div className='flex flex-wrap gap-2'>
                              <Button variant='outline' size='sm' asChild>
                                <Link
                                  to='/services/$serviceId'
                                  params={{ serviceId: service.id }}
                                >
                                  Details
                                </Link>
                              </Button>
                              <Button variant='outline' size='sm' asChild>
                                <Link
                                  to='/logs'
                                  search={{ service: service.id }}
                                >
                                  Logs
                                </Link>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} className='h-24 text-center'>
                          No services match the current runtime search.
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
