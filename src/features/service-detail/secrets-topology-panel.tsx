import { useMemo, useState } from 'react'
import { type Edge, MarkerType, type Node } from '@xyflow/react'
import { Network } from 'lucide-react'
import {
  TOPOLOGY_MAPPING_STATUSES,
  assertSafeTopologyRows,
  buildTopologyMappingRows,
  filterTopologyMappingRows,
  topologyGraphFromRows,
  type TopologyMappingStatus,
} from '@/lib/service-lasso-dashboard/broker-topology-mapping'
import {
  useSecretsManagement,
  useServices,
} from '@/lib/service-lasso-dashboard/hooks'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DependencyGraphCanvas } from '@/components/dependency-graph-canvas'

function parseStatusFilter(value: string): TopologyMappingStatus | 'all' {
  if (value === 'all') return 'all'
  for (const status of TOPOLOGY_MAPPING_STATUSES) {
    if (status === value) return status
  }
  return 'all'
}

function statusTone(
  status: TopologyMappingStatus
): 'outline' | 'secondary' | 'destructive' {
  if (status === 'mapped') return 'outline'
  if (
    status === 'unmapped' ||
    status === 'unknown' ||
    status === 'missing-source'
  ) {
    return 'secondary'
  }
  return 'destructive'
}

/**
 * Live Secrets Broker topology: service variables joined to Broker validation metadata.
 */
export function SecretsBrokerTopologyPanel() {
  const services = useServices()
  const inventory = useSecretsManagement()
  const [statusFilter, setStatusFilter] = useState<
    TopologyMappingStatus | 'all'
  >('all')
  const [query, setQuery] = useState('')

  const rows = useMemo(() => {
    const built = buildTopologyMappingRows({
      services: (services.data ?? []).map((service) => ({
        id: service.id,
        name: service.name,
        environmentVariables: service.environmentVariables,
      })),
      inventory: inventory.data?.results ?? [],
      brokerMetadataAvailable:
        !inventory.isError && inventory.data !== undefined,
    })
    assertSafeTopologyRows(built)
    return built
  }, [inventory.data, inventory.isError, services.data])

  const visible = useMemo(
    () => filterTopologyMappingRows(rows, { status: statusFilter, query }),
    [query, rows, statusFilter]
  )
  const graph = useMemo(() => topologyGraphFromRows(visible), [visible])
  const nodes: Node[] = useMemo(
    () =>
      graph.nodes.map((node, index) => ({
        id: node.id,
        position: {
          x: node.kind === 'service' ? 40 : 360,
          y: 40 + index * 72,
        },
        data: { label: node.label },
        style: {
          border:
            node.kind === 'service'
              ? '1px solid #64748b'
              : '1px dashed #94a3b8',
          borderRadius: 8,
          padding: 8,
          fontSize: 12,
        },
      })),
    [graph.nodes]
  )
  const edges: Edge[] = useMemo(
    () =>
      graph.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.status,
        markerEnd: { type: MarkerType.ArrowClosed },
      })),
    [graph.edges]
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Network className='size-5' /> Topology mappings
        </CardTitle>
        <CardDescription>
          Live service variables joined to safe Broker validation metadata. Raw
          secret values and provider payloads never enter this graph or table.
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        {inventory.isError ? (
          <p className='text-sm text-destructive'>
            Broker validation metadata is unavailable. Local mapped, unmapped,
            missing-source, and unknown statuses remain, without pretending
            certainty.
          </p>
        ) : null}
        <div className='grid gap-2 md:grid-cols-[1fr_220px] md:items-end'>
          <div className='space-y-2'>
            <Label htmlFor='broker-topology-search'>Search mappings</Label>
            <Input
              id='broker-topology-search'
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder='Service, variable, ref, or status'
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='broker-topology-status'>Status</Label>
            <Select
              value={statusFilter}
              onValueChange={(value) =>
                setStatusFilter(parseStatusFilter(value))
              }
            >
              <SelectTrigger id='broker-topology-status'>
                <SelectValue placeholder='All statuses' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All statuses</SelectItem>
                {TOPOLOGY_MAPPING_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {visible.length > 0 ? (
          <DependencyGraphCanvas
            nodes={nodes}
            edges={edges}
            height={280}
            draggable={false}
            showMiniMap={false}
          />
        ) : null}

        <div className='rounded-lg border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead>Variable</TableHead>
                <TableHead>SecretRef</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Next action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className='font-medium'>
                    {row.serviceName}
                  </TableCell>
                  <TableCell className='font-mono text-xs'>
                    {row.variableKey}
                  </TableCell>
                  <TableCell className='font-mono text-xs'>
                    {row.secretRef ?? (row.variableSource || 'Not mapped')}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusTone(row.status)}>{row.status}</Badge>
                  </TableCell>
                  <TableCell className='text-sm text-muted-foreground'>
                    {row.nextAction}
                  </TableCell>
                </TableRow>
              ))}
              {visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className='text-muted-foreground'>
                    No mapping rows match this search.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
