import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowUpDown, Copy, Search, SlidersHorizontal } from 'lucide-react'
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

type VariablesSortKey = 'key' | 'value' | 'scope' | 'source' | 'services'
type SortDirection = 'asc' | 'desc'

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

export function Variables({ service, keyFilter }: VariablesProps) {
  usePageMetadata({
    title: 'Service Admin - Variables',
    description: 'Service Admin environment variables and config values view.',
  })

  const servicesQuery = useServices()
  const [query, setQuery] = useState(keyFilter ?? '')
  const [scopeFilter, setScopeFilter] = useState<'all' | VariableRow['scope']>(
    'all'
  )
  const [sortKey, setSortKey] = useState<VariablesSortKey>('key')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

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
    const filtered = Array.from(map.values()).filter((row) => {
      if (scopeFilter !== 'all' && row.scope !== scopeFilter) return false
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

    return filtered.sort((a, b) => {
      if (sortKey === 'key') return compareText(a.key, b.key, sortDirection)
      if (sortKey === 'value') {
        return compareText(a.value, b.value, sortDirection)
      }
      if (sortKey === 'scope') {
        return compareText(a.scope, b.scope, sortDirection)
      }
      if (sortKey === 'source') {
        return compareText(
          a.source ?? 'Not recorded',
          b.source ?? 'Not recorded',
          sortDirection
        )
      }

      return compareText(
        a.services.map((item) => item.name).join(', '),
        b.services.map((item) => item.name).join(', '),
        sortDirection
      )
    })
  }, [query, scopeFilter, service, servicesQuery.data, sortDirection, sortKey])

  const toggleSort = (key: VariablesSortKey) => {
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
                Aggregated variable view with copy actions, sort controls, and
                jumps back to the owning service detail page.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='relative w-full max-w-md'>
                <Search className='absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground' />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder='Search variable keys, values, sources, or services...'
                  className='pl-9'
                />
              </div>

              <div className='flex flex-wrap gap-2'>
                <Button
                  type='button'
                  size='sm'
                  variant={scopeFilter === 'all' ? 'default' : 'outline'}
                  onClick={() => setScopeFilter('all')}
                >
                  all scopes
                </Button>
                <Button
                  type='button'
                  size='sm'
                  variant={scopeFilter === 'global' ? 'default' : 'outline'}
                  onClick={() => setScopeFilter('global')}
                >
                  global
                </Button>
                <Button
                  type='button'
                  size='sm'
                  variant={scopeFilter === 'service' ? 'default' : 'outline'}
                  onClick={() => setScopeFilter('service')}
                >
                  service
                </Button>
              </div>

              <div className='overflow-x-auto rounded-md border'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <SortableHead
                          label='Key'
                          active={sortKey === 'key'}
                          direction={sortDirection}
                          onClick={() => toggleSort('key')}
                        />
                      </TableHead>
                      <TableHead>
                        <SortableHead
                          label='Value'
                          active={sortKey === 'value'}
                          direction={sortDirection}
                          onClick={() => toggleSort('value')}
                        />
                      </TableHead>
                      <TableHead>
                        <SortableHead
                          label='Scope'
                          active={sortKey === 'scope'}
                          direction={sortDirection}
                          onClick={() => toggleSort('scope')}
                        />
                      </TableHead>
                      <TableHead>
                        <SortableHead
                          label='Source'
                          active={sortKey === 'source'}
                          direction={sortDirection}
                          onClick={() => toggleSort('source')}
                        />
                      </TableHead>
                      <TableHead>
                        <SortableHead
                          label='Services'
                          active={sortKey === 'services'}
                          direction={sortDirection}
                          onClick={() => toggleSort('services')}
                        />
                      </TableHead>
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
