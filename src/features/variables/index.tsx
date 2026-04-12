import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Copy, Search, SlidersHorizontal } from 'lucide-react'
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

type VariablesProps = {
  service?: string
  keyFilter?: string
}

type VariableRow = {
  id: string
  key: string
  value: string
  scope: 'global' | 'service'
  secret?: boolean
  source?: string
  services: { id: string; name: string }[]
}

function VariablesLoading() {
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

export function Variables({ service, keyFilter }: VariablesProps) {
  usePageMetadata({
    title: 'Service Admin - Variables',
    description: 'Service Admin environment variables and config values view.',
  })

  const servicesQuery = useServices()
  const [query, setQuery] = useState(keyFilter ?? '')

  const rows = useMemo(() => {
    const sourceServices = (servicesQuery.data ?? []).filter(
      (item) => !service || item.id === service
    )
    const map = new Map<string, VariableRow>()

    for (const item of sourceServices) {
      for (const variable of item.environmentVariables) {
        const id = [
          variable.key,
          variable.value,
          variable.scope,
          variable.source ?? '',
          variable.secret ? 'secret' : 'plain',
        ].join('|')
        const existing = map.get(id)
        if (existing) {
          existing.services.push({ id: item.id, name: item.name })
          continue
        }

        map.set(id, {
          id,
          key: variable.key,
          value: variable.value,
          scope: variable.scope,
          secret: variable.secret,
          source: variable.source,
          services: [{ id: item.id, name: item.name }],
        })
      }
    }

    const normalized = query.trim().toLowerCase()
    return Array.from(map.values())
      .filter((row) => {
        if (!normalized) return true
        return [
          row.key,
          row.value,
          row.scope,
          row.source ?? '',
          row.services.map((item) => item.name + ' ' + item.id).join(' '),
        ]
          .join(' ')
          .toLowerCase()
          .includes(normalized)
      })
      .sort(
        (a, b) => a.key.localeCompare(b.key) || a.scope.localeCompare(b.scope)
      )
  }, [query, service, servicesQuery.data])

  return (
    <>
      <Header fixed>
        <div className='relative w-full max-w-sm'>
          <Search className='absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder='Search variable keys, values, sources, or services...'
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
            <h2 className='text-2xl font-bold tracking-tight'>Variables</h2>
            <p className='text-muted-foreground'>
              Shared and service-local environment values in one operator table.
            </p>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Button variant='outline' size='sm' asChild>
              <Link to='/services'>Services</Link>
            </Button>
            <Button variant='outline' size='sm' asChild>
              <Link to='/installed'>Installed</Link>
            </Button>
          </div>
        </div>

        {servicesQuery.isLoading ? (
          <VariablesLoading />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <SlidersHorizontal className='size-4' /> Environment variables
              </CardTitle>
              <CardDescription>
                Aggregated variable view with copy actions and jumps back to the
                owning service detail page.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className='overflow-x-auto rounded-md border'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Key</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Scope</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Services</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.length ? (
                      rows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className='font-medium'>
                            {row.key}
                          </TableCell>
                          <TableCell className='max-w-[320px] text-sm break-all text-muted-foreground'>
                            {row.secret ? '••••••••' : row.value}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                row.scope === 'global' ? 'secondary' : 'outline'
                              }
                            >
                              {row.scope}
                            </Badge>
                          </TableCell>
                          <TableCell>{row.source ?? 'Not recorded'}</TableCell>
                          <TableCell>
                            <div className='flex flex-wrap gap-2'>
                              {row.services.map((serviceItem) => (
                                <Badge key={serviceItem.id} variant='outline'>
                                  {serviceItem.name}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className='flex flex-wrap gap-2'>
                              <Button
                                type='button'
                                variant='outline'
                                size='sm'
                                onClick={() =>
                                  void navigator.clipboard.writeText(row.value)
                                }
                              >
                                <Copy className='mr-2 size-3.5' /> Copy value
                              </Button>
                              {row.services.length === 1 ? (
                                <Button variant='outline' size='sm' asChild>
                                  <Link
                                    to='/services/$serviceId'
                                    params={{ serviceId: row.services[0].id }}
                                  >
                                    Details
                                  </Link>
                                </Button>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className='h-24 text-center'>
                          No variables match the current filters.
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
