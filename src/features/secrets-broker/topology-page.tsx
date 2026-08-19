import { useCallback, useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { AlertTriangle, Network, Search as SearchIcon, X } from 'lucide-react'
import { usePageMetadata } from '@/lib/page-metadata'
import { useServices } from '@/lib/service-lasso-dashboard/hooks'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfigDrawer } from '@/components/config-drawer'
import {
  DependencyGraphCanvas,
  type GraphPaneSize,
} from '@/components/dependency-graph-canvas'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { HeaderActions, usePageToolbar } from '@/components/page-toolbar'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import {
  buildSecretsBrokerTopology,
  filterSecretsBrokerTopology,
  toReactFlowSecretsBrokerTopology,
} from './topology'

function TopologyLoading() {
  return (
    <Card
      className='flex min-h-0 flex-1 flex-col overflow-hidden'
      data-testid='mapping-graph-card'
    >
      <CardHeader className='shrink-0'>
        <Skeleton className='h-6 w-52' />
        <Skeleton className='h-4 w-96' />
      </CardHeader>
      <CardContent className='flex min-h-0 flex-1 flex-col overflow-hidden'>
        <Skeleton className='h-full min-h-0 w-full flex-1' />
      </CardContent>
    </Card>
  )
}

/**
 * Secrets Broker Topology page: mapping graph as the primary full-size panel.
 */
export function SecretsBrokerTopologyPage() {
  usePageMetadata({
    title: 'Service Admin - Secrets Broker Topology',
    description: 'Inspect safe service variable to SecretRef mapping metadata.',
  })
  usePageToolbar({
    quickNav: [
      { id: 'review', label: 'Review', to: '/secrets-broker/review' },
      { id: 'providers', label: 'Providers', to: '/secrets-broker/sources' },
    ],
  })

  const servicesQuery = useServices()
  const [topologySearchQuery, setTopologySearchQuery] = useState('')
  const [paneSize, setPaneSize] = useState<GraphPaneSize>({
    width: 0,
    height: 0,
  })
  const topology = useMemo(
    () => buildSecretsBrokerTopology(servicesQuery.data ?? []),
    [servicesQuery.data]
  )
  const filteredTopology = useMemo(
    () => filterSecretsBrokerTopology(topology, topologySearchQuery),
    [topology, topologySearchQuery]
  )
  const graph = useMemo(
    () =>
      toReactFlowSecretsBrokerTopology(filteredTopology, {
        bounds: paneSize,
        rankdir: 'TB',
      }),
    [filteredTopology, paneSize]
  )
  const handlePaneSizeChange = useCallback((size: GraphPaneSize) => {
    setPaneSize((current) => {
      if (current.width === size.width && current.height === size.height) {
        return current
      }
      return size
    })
  }, [])
  const unmappedCount = topology.rows.filter(
    (row) => row.status !== 'mapped'
  ).length
  const hasTopologySearch = topologySearchQuery.trim().length > 0
  const topologyHasMatches =
    filteredTopology.nodes.length > 0 || filteredTopology.rows.length > 0

  return (
    <>
      <Header fixed>
        <Search />
        <HeaderActions>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </HeaderActions>
      </Header>

      <Main id='content' fixed className='min-h-0 gap-4'>
        {servicesQuery.isLoading ? (
          <TopologyLoading />
        ) : (
          <Card
            className='flex min-h-0 flex-1 flex-col overflow-hidden'
            data-testid='mapping-graph-card'
          >
            <CardHeader className='shrink-0 space-y-1'>
              <div className='flex flex-wrap items-center justify-between gap-3'>
                <div className='flex items-center gap-2 font-semibold'>
                  <Network className='size-4' />
                  Mapping graph
                </div>
                <div className='flex flex-wrap items-center gap-2'>
                  {hasTopologySearch ? (
                    <Badge variant='outline'>
                      {filteredTopology.nodes.length} of {topology.nodes.length}{' '}
                      nodes
                    </Badge>
                  ) : null}
                </div>
              </div>
              <div className='flex flex-col gap-2 pt-2 sm:flex-row sm:items-end sm:justify-between'>
                <div className='min-w-0 flex-1 space-y-1'>
                  <label
                    htmlFor='secrets-topology-search'
                    className='text-xs font-medium text-muted-foreground'
                  >
                    Search topology
                  </label>
                  <div className='relative max-w-xl'>
                    <SearchIcon className='pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
                    <Input
                      id='secrets-topology-search'
                      value={topologySearchQuery}
                      onChange={(event) =>
                        setTopologySearchQuery(event.target.value)
                      }
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                          setTopologySearchQuery('')
                        }
                      }}
                      placeholder='Search services, refs, providers, routes, or variables...'
                      className='ps-9 pe-10'
                      aria-describedby='secrets-topology-search-summary'
                    />
                    {hasTopologySearch ? (
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon'
                        className='absolute end-1 top-1/2 size-7 -translate-y-1/2'
                        onClick={() => setTopologySearchQuery('')}
                        aria-label='Clear topology search'
                      >
                        <X className='size-4' />
                      </Button>
                    ) : null}
                  </div>
                </div>
                <p
                  id='secrets-topology-search-summary'
                  className='text-sm text-muted-foreground'
                >
                  Showing {filteredTopology.nodes.length} of{' '}
                  {topology.nodes.length} nodes and{' '}
                  {filteredTopology.edges.length} of {topology.edges.length}{' '}
                  relationships.
                </p>
              </div>
            </CardHeader>
            <CardContent className='flex min-h-0 flex-1 flex-col overflow-hidden'>
              {unmappedCount ? (
                <div className='mb-3 flex shrink-0 items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100'>
                  <AlertTriangle className='size-4' />
                  {unmappedCount} secret-like variable
                  {unmappedCount === 1 ? '' : 's'} need mapping review.{' '}
                  <Link
                    to='/secrets-broker/review'
                    className='font-medium underline'
                  >
                    Open Review
                  </Link>
                </div>
              ) : null}
              {topology.rows.length && topologyHasMatches ? (
                <DependencyGraphCanvas
                  nodes={graph.nodes}
                  edges={graph.edges}
                  fill
                  paneTestId='mapping-graph-pane'
                  onPaneSizeChange={handlePaneSizeChange}
                  draggable={false}
                  selectable={false}
                  showMiniMap={false}
                  legendItems={[
                    { label: 'mapped', color: '#16a34a' },
                    {
                      label: 'missing / unmapped',
                      color: '#f97316',
                      dashed: true,
                    },
                    { label: 'unknown', color: '#64748b', dashed: true },
                  ]}
                />
              ) : hasTopologySearch ? (
                <div className='flex min-h-0 flex-1 items-center justify-center rounded-md border text-sm text-muted-foreground'>
                  No topology nodes or relationships match the current search.
                </div>
              ) : (
                <div className='flex min-h-0 flex-1 items-center justify-center rounded-md border text-sm text-muted-foreground'>
                  No secret-like service variables were reported by the runtime.
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </Main>
    </>
  )
}
