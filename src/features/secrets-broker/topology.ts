import type { Edge, Node } from '@xyflow/react'
import type {
  DashboardService,
  ServiceEnvironmentVariable,
} from '@/lib/service-lasso-dashboard/types'

export type SecretVariableMappingStatus =
  | 'mapped'
  | 'unmapped'
  | 'missing-source'
  | 'unknown'

export type SecretsBrokerTopologyNodeKind =
  | 'broker'
  | 'provider'
  | 'ref'
  | 'service'
  | 'variable'

export type SecretsBrokerTopologyEdgeKind =
  | 'maps-to'
  | 'provided-by'
  | 'uses-variable'

export type SecretsBrokerTopologyNode = {
  id: string
  label: string
  kind: SecretsBrokerTopologyNodeKind
  summary: string
  detailHref: string
  auditHref?: string
  diagnosticHref?: string
}

export type SecretsBrokerTopologyEdge = {
  id: string
  source: string
  target: string
  label: string
  kind: SecretsBrokerTopologyEdgeKind
  status: 'ok' | 'warning' | 'failed' | 'denied' | 'missing' | 'unknown'
  detailHref: string
  auditHref: string
  diagnosticHref?: string
}

export type SecretVariableMappingRow = {
  id: string
  serviceId: string
  serviceName: string
  variableName: string
  scope: ServiceEnvironmentVariable['scope']
  source: string
  secretRef: string
  provider: string
  status: SecretVariableMappingStatus
  lastValidation: string
  detailHref: string
  variablesHref: string
  sourceHref: string
  auditHref: string
  diagnosticsHref: string
  searchText: string
}

export type SecretsBrokerTopology = {
  rows: SecretVariableMappingRow[]
  nodes: SecretsBrokerTopologyNode[]
  edges: SecretsBrokerTopologyEdge[]
}

const secretNamePattern =
  /(^|_)(SECRET|TOKEN|PASSWORD|PASS|API_KEY|PRIVATE_KEY|CREDENTIAL|KEY)($|_)/i
const secretRefPattern = /^secret:\/\//i
const legacySecretRefPattern = /^[a-z0-9@._:/-]+\.[A-Z0-9_]+$/i

function safeNodeId(value: string) {
  return value.replace(/[^a-z0-9@._:/-]+/gi, '-')
}

function isSecretLikeVariable(variable: ServiceEnvironmentVariable) {
  return (
    variable.secret === true ||
    secretRefPattern.test(variable.value) ||
    secretNamePattern.test(variable.key)
  )
}

function extractSafeSecretRef(variable: ServiceEnvironmentVariable) {
  if (secretRefPattern.test(variable.value)) return variable.value
  if (variable.secret && legacySecretRefPattern.test(variable.value)) {
    return `secret://${variable.value}`
  }
  return ''
}

function providerFromSource(source: string) {
  if (!source || source === 'Not mapped') return 'None'
  return source.replace(/^@secretsbroker\//, '')
}

function mappingStatusFor(variable: ServiceEnvironmentVariable) {
  const hasSafeRef = Boolean(extractSafeSecretRef(variable))
  const hasBrokerSource = Boolean(variable.source?.includes('@secretsbroker'))

  if (hasSafeRef && hasBrokerSource) return 'mapped'
  if (variable.secret && !hasSafeRef) return 'missing-source'
  if (hasSafeRef) return 'unknown'
  return 'unmapped'
}

function validationFor(status: SecretVariableMappingStatus) {
  if (status === 'mapped') return 'SecretRef mapping present'
  if (status === 'missing-source') return 'Secret flag set without safe ref'
  if (status === 'unknown') return 'SecretRef present without broker source'
  return 'Secret-like variable is not mapped'
}

export function buildSecretVariableMappingRows(
  services: DashboardService[]
): SecretVariableMappingRow[] {
  return services.flatMap((service) =>
    service.environmentVariables
      .filter(isSecretLikeVariable)
      .map((variable) => {
        const status = mappingStatusFor(variable)
        const safeRef = extractSafeSecretRef(variable)
        const source =
          variable.source ?? (safeRef ? 'Unknown source' : 'Not mapped')
        const provider = providerFromSource(source)
        const row: SecretVariableMappingRow = {
          id: `${service.id}:${variable.scope}:${variable.key}`,
          serviceId: service.id,
          serviceName: service.name,
          variableName: variable.key,
          scope: variable.scope,
          source,
          secretRef: safeRef || 'Not mapped',
          provider,
          status,
          lastValidation: validationFor(status),
          detailHref: `/services/${encodeURIComponent(service.id)}`,
          variablesHref: `/services/${encodeURIComponent(service.id)}`,
          sourceHref: '/secrets-broker/sources',
          auditHref: '/operations/audit-logging',
          diagnosticsHref: '/secrets-broker/sources',
          searchText: '',
        }

        return {
          ...row,
          searchText: [
            row.serviceId,
            row.serviceName,
            row.variableName,
            row.scope,
            row.source,
            row.secretRef,
            row.provider,
            row.status,
            row.lastValidation,
          ]
            .join(' ')
            .toLowerCase(),
        }
      })
  )
}

function addNode(
  nodes: Map<string, SecretsBrokerTopologyNode>,
  node: SecretsBrokerTopologyNode
) {
  if (!nodes.has(node.id)) nodes.set(node.id, node)
}

function edgeStatusFor(status: SecretVariableMappingStatus) {
  if (status === 'mapped') return 'ok'
  if (status === 'unmapped') return 'missing'
  if (status === 'missing-source') return 'missing'
  return 'unknown'
}

export function buildSecretsBrokerTopology(
  services: DashboardService[] = []
): SecretsBrokerTopology {
  const rows = buildSecretVariableMappingRows(services)
  const nodes = new Map<string, SecretsBrokerTopologyNode>()
  const edges: SecretsBrokerTopologyEdge[] = []

  addNode(nodes, {
    id: 'broker:@secretsbroker',
    label: '@secretsbroker',
    kind: 'broker',
    summary: 'Broker metadata surface for service SecretRef mappings.',
    detailHref: '/secrets-broker/secrets',
    auditHref: '/operations/audit-logging',
    diagnosticHref: '/secrets-broker/sources',
  })

  rows.forEach((row) => {
    const serviceNodeId = `service:${safeNodeId(row.serviceId)}`
    const variableNodeId = `variable:${safeNodeId(row.id)}`
    const providerNodeId = `provider:${safeNodeId(row.provider)}`
    const refNodeId = `ref:${safeNodeId(row.secretRef)}`
    const status = edgeStatusFor(row.status)

    addNode(nodes, {
      id: serviceNodeId,
      label: row.serviceName,
      kind: 'service',
      summary: `${row.serviceId} runtime service`,
      detailHref: row.detailHref,
      auditHref: row.auditHref,
      diagnosticHref: row.diagnosticsHref,
    })
    addNode(nodes, {
      id: variableNodeId,
      label: row.variableName,
      kind: 'variable',
      summary: `${row.scope} variable; raw value hidden`,
      detailHref: row.variablesHref,
      auditHref: row.auditHref,
      diagnosticHref: row.diagnosticsHref,
    })

    edges.push({
      id: `service-variable:${row.id}`,
      source: serviceNodeId,
      target: variableNodeId,
      label: 'declares variable',
      kind: 'uses-variable',
      status,
      detailHref: row.detailHref,
      auditHref: row.auditHref,
      diagnosticHref: row.diagnosticsHref,
    })

    if (row.status === 'mapped' || row.status === 'unknown') {
      addNode(nodes, {
        id: refNodeId,
        label: row.secretRef,
        kind: 'ref',
        summary: 'SecretRef identifier only; resolved value hidden',
        detailHref: row.auditHref,
        auditHref: row.auditHref,
        diagnosticHref: row.diagnosticsHref,
      })
      edges.push({
        id: `variable-ref:${row.id}`,
        source: variableNodeId,
        target: refNodeId,
        label: 'maps to SecretRef',
        kind: 'maps-to',
        status,
        detailHref: row.detailHref,
        auditHref: row.auditHref,
        diagnosticHref: row.diagnosticsHref,
      })
    }

    if (row.provider !== 'None') {
      addNode(nodes, {
        id: providerNodeId,
        label: row.provider,
        kind: 'provider',
        summary: `${row.source} metadata source`,
        detailHref: row.sourceHref,
        auditHref: row.auditHref,
        diagnosticHref: row.diagnosticsHref,
      })
      edges.push({
        id: `provider-variable:${row.id}`,
        source: providerNodeId,
        target: variableNodeId,
        label: 'provides mapping metadata',
        kind: 'provided-by',
        status,
        detailHref: row.sourceHref,
        auditHref: row.auditHref,
        diagnosticHref: row.diagnosticsHref,
      })
    } else {
      edges.push({
        id: `broker-variable:${row.id}`,
        source: 'broker:@secretsbroker',
        target: variableNodeId,
        label: 'mapping missing',
        kind: 'maps-to',
        status,
        detailHref: row.detailHref,
        auditHref: row.auditHref,
        diagnosticHref: row.diagnosticsHref,
      })
    }
  })

  return { rows, nodes: Array.from(nodes.values()), edges }
}

/**
 * Rank order for Mapping graph layout. Top-to-bottom keeps populated ranks
 * as rows so siblings can spread across pane width instead of stacking in
 * a single X column per kind.
 */
export const TOPOLOGY_LAYOUT_RANK_ORDER: readonly SecretsBrokerTopologyNodeKind[] =
  ['broker', 'provider', 'service', 'variable', 'ref']

/** Fallback pane size used before ResizeObserver reports a real box. */
export const DEFAULT_TOPOLOGY_LAYOUT_BOUNDS = {
  width: 1280,
  height: 720,
} as const

export type TopologyGraphLayoutBounds = {
  width: number
  height: number
}

export type TopologyGraphLayoutOptions = {
  bounds?: TopologyGraphLayoutBounds
  nodeWidth?: number
  nodeHeight?: number
  rankdir?: 'TB' | 'LR'
  minRanksep?: number
  minNodesep?: number
  padding?: number
}

export type SecretsBrokerGraphNodeData = {
  label: string
  kind: SecretsBrokerTopologyNodeKind
}

const nodeKindColor: Record<SecretsBrokerTopologyNodeKind, string> = {
  broker: '#2563eb',
  provider: '#0891b2',
  service: '#16a34a',
  variable: '#7c3aed',
  ref: '#f59e0b',
}

const edgeStatusColor: Record<SecretsBrokerTopologyEdge['status'], string> = {
  ok: '#16a34a',
  warning: '#f59e0b',
  failed: '#dc2626',
  denied: '#991b1b',
  missing: '#f97316',
  unknown: '#64748b',
}

const DEFAULT_NODE_WIDTH = 190
const DEFAULT_NODE_HEIGHT = 72
const DEFAULT_MIN_RANKSEP = 96
const DEFAULT_MIN_NODESEP = 48
const DEFAULT_LAYOUT_PADDING = 48
const MIN_PANE_SIZE = 8

/**
 * Treat unmeasured or collapsed panes as the default operator canvas so
 * first paint still spreads horizontally instead of stacking a DAG column.
 */
function resolvedLayoutBounds(
  bounds: TopologyGraphLayoutBounds | undefined
): TopologyGraphLayoutBounds {
  const width = bounds?.width ?? 0
  const height = bounds?.height ?? 0
  return {
    width:
      width >= MIN_PANE_SIZE ? width : DEFAULT_TOPOLOGY_LAYOUT_BOUNDS.width,
    height:
      height >= MIN_PANE_SIZE ? height : DEFAULT_TOPOLOGY_LAYOUT_BOUNDS.height,
  }
}

function topologyRankGroups(
  nodes: readonly SecretsBrokerTopologyNode[]
): SecretsBrokerTopologyNode[][] {
  return TOPOLOGY_LAYOUT_RANK_ORDER.map((kind) =>
    nodes.filter((node) => node.kind === kind)
  ).filter((rankNodes) => rankNodes.length > 0)
}

function maxColumnsForWidth(
  availableWidth: number,
  nodeSize: number,
  minNodesep: number,
  nodeCount: number
) {
  const packedSlot = nodeSize + minNodesep
  const fitted = Math.max(
    1,
    Math.floor((availableWidth + minNodesep) / packedSlot)
  )
  return Math.min(nodeCount, fitted)
}

/**
 * Place one rank on a width-aware grid. Column count is how many nodes fit
 * in `availableWidth`, so a populated rank spreads across the pane instead
 * of sharing a single X.
 */
function placeRankOnGrid(options: {
  rankNodes: readonly SecretsBrokerTopologyNode[]
  originX: number
  originY: number
  availableWidth: number
  nodeWidth: number
  nodeHeight: number
  minNodesep: number
  rowStride: number
  positions: Map<string, { x: number; y: number }>
}): { rowCount: number; height: number } {
  const {
    rankNodes,
    originX,
    originY,
    availableWidth,
    nodeWidth,
    nodeHeight,
    minNodesep,
    rowStride,
    positions,
  } = options

  if (rankNodes.length === 0) {
    return { rowCount: 0, height: 0 }
  }

  const columnCount = maxColumnsForWidth(
    availableWidth,
    nodeWidth,
    minNodesep,
    rankNodes.length
  )
  const rowCount = Math.ceil(rankNodes.length / columnCount)
  const startX =
    columnCount === 1 ? originX + (availableWidth - nodeWidth) / 2 : originX
  const columnStride =
    columnCount === 1 ? 0 : (availableWidth - nodeWidth) / (columnCount - 1)

  rankNodes.forEach((node, index) => {
    const column = index % columnCount
    const row = Math.floor(index / columnCount)
    positions.set(node.id, {
      x: startX + column * columnStride,
      y: originY + row * rowStride,
    })
  })

  return {
    rowCount,
    height: rowCount * nodeHeight + Math.max(rowCount - 1, 0) * minNodesep,
  }
}

/**
 * Rank-aware Mapping graph positions. Default rankdir is TB so siblings in
 * a rank use container width; LR keeps kinds as columns and spreads them
 * across that same width.
 */
export function layoutSecretsBrokerTopologyPositions(
  nodes: readonly SecretsBrokerTopologyNode[],
  options: TopologyGraphLayoutOptions = {}
): Map<string, { x: number; y: number }> {
  const nodeWidth = options.nodeWidth ?? DEFAULT_NODE_WIDTH
  const nodeHeight = options.nodeHeight ?? DEFAULT_NODE_HEIGHT
  const minRanksep = options.minRanksep ?? DEFAULT_MIN_RANKSEP
  const minNodesep = options.minNodesep ?? DEFAULT_MIN_NODESEP
  const padding = options.padding ?? DEFAULT_LAYOUT_PADDING
  const rankdir = options.rankdir ?? 'TB'
  const bounds = resolvedLayoutBounds(options.bounds)
  const innerWidth = Math.max(bounds.width - padding * 2, nodeWidth)
  const innerHeight = Math.max(bounds.height - padding * 2, nodeHeight)
  const ranks = topologyRankGroups(nodes)
  const positions = new Map<string, { x: number; y: number }>()

  if (ranks.length === 0) {
    return positions
  }

  if (rankdir === 'LR') {
    const ranksep =
      ranks.length > 1
        ? Math.max(
            minRanksep,
            (innerWidth - ranks.length * nodeWidth) / (ranks.length - 1)
          )
        : minRanksep

    ranks.forEach((rankNodes, rankIndex) => {
      const originX = padding + rankIndex * (nodeWidth + ranksep)
      rankNodes.forEach((node, index) => {
        const packedHeight =
          rankNodes.length * nodeHeight +
          Math.max(rankNodes.length - 1, 0) * minNodesep
        const columnHeight = Math.max(packedHeight, innerHeight)
        const startY =
          rankNodes.length === 1
            ? padding + (columnHeight - nodeHeight) / 2
            : padding
        const rowStride =
          rankNodes.length === 1
            ? 0
            : (columnHeight - nodeHeight) / (rankNodes.length - 1)
        positions.set(node.id, {
          x: originX,
          y: startY + index * rowStride,
        })
      })
    })

    return positions
  }

  const rowStride = nodeHeight + minNodesep
  const packedRankHeights = ranks.map((rankNodes) => {
    const columnCount = maxColumnsForWidth(
      innerWidth,
      nodeWidth,
      minNodesep,
      rankNodes.length
    )
    const rowCount = Math.ceil(rankNodes.length / columnCount)
    return rowCount * nodeHeight + Math.max(rowCount - 1, 0) * minNodesep
  })
  const packedTotalHeight =
    packedRankHeights.reduce((total, height) => total + height, 0) +
    Math.max(ranks.length - 1, 0) * minRanksep
  const extraHeight = Math.max(0, innerHeight - packedTotalHeight)
  const ranksep =
    ranks.length > 1
      ? minRanksep + extraHeight / (ranks.length - 1)
      : minRanksep

  let cursorY = padding
  ranks.forEach((rankNodes, rankIndex) => {
    const placed = placeRankOnGrid({
      rankNodes,
      originX: padding,
      originY: cursorY,
      availableWidth: innerWidth,
      nodeWidth,
      nodeHeight,
      minNodesep,
      rowStride,
      positions,
    })
    cursorY += placed.height
    if (rankIndex < ranks.length - 1) {
      cursorY += ranksep
    }
  })

  return positions
}

function graphNodePosition(
  positions: Map<string, { x: number; y: number }>,
  nodeId: string
) {
  const position = positions.get(nodeId)
  if (position) {
    return position
  }
  return { x: 0, y: 0 }
}

/**
 * Convert topology nodes/edges into React Flow elements whose positions
 * fill the observed pane instead of a fixed skinny DAG column.
 */
export function toReactFlowSecretsBrokerTopology(
  topology: SecretsBrokerTopology,
  options: TopologyGraphLayoutOptions = {}
) {
  const positions = layoutSecretsBrokerTopologyPositions(
    topology.nodes,
    options
  )

  const nodes: Node<SecretsBrokerGraphNodeData>[] = topology.nodes.map(
    (node) => {
      return {
        id: node.id,
        position: graphNodePosition(positions, node.id),
        data: {
          label: `${node.label}\n${node.kind}`,
          kind: node.kind,
        },
        style: {
          border: `2px solid ${nodeKindColor[node.kind]}`,
          borderRadius: 8,
          background: '#ffffff',
          color: '#0f172a',
          fontSize: 12,
          minWidth: 150,
          maxWidth: 230,
          whiteSpace: 'pre-line',
        },
      }
    }
  )

  const edges: Edge[] = topology.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    animated: edge.status === 'missing',
    style: {
      stroke: edgeStatusColor[edge.status],
      strokeWidth: edge.status === 'ok' ? 2 : 3,
      strokeDasharray: edge.status === 'ok' ? undefined : '6 4',
    },
    labelStyle: { fill: edgeStatusColor[edge.status], fontWeight: 600 },
  }))

  return { nodes, edges }
}

function topologySearchMatches(
  query: string,
  values: Array<string | undefined>
) {
  return values.some((value) => value?.toLowerCase().includes(query))
}

export function filterSecretsBrokerTopology(
  topology: SecretsBrokerTopology,
  query: string
): SecretsBrokerTopology {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return topology

  const nodesById = new Map(topology.nodes.map((node) => [node.id, node]))
  const directlyMatchedNodeIds = new Set(
    topology.nodes
      .filter((node) =>
        topologySearchMatches(normalizedQuery, [
          node.id,
          node.label,
          node.kind,
          node.summary,
        ])
      )
      .map((node) => node.id)
  )
  const visibleNodeIds = new Set(directlyMatchedNodeIds)
  const visibleEdgeIds = new Set<string>()

  topology.edges.forEach((edge) => {
    const sourceNode = nodesById.get(edge.source)
    const targetNode = nodesById.get(edge.target)
    const edgeMatches = topologySearchMatches(normalizedQuery, [
      edge.id,
      edge.label,
      edge.kind,
      edge.status,
      sourceNode?.label,
      sourceNode?.kind,
      targetNode?.label,
      targetNode?.kind,
    ])

    if (
      edgeMatches ||
      directlyMatchedNodeIds.has(edge.source) ||
      directlyMatchedNodeIds.has(edge.target)
    ) {
      visibleEdgeIds.add(edge.id)
      visibleNodeIds.add(edge.source)
      visibleNodeIds.add(edge.target)
    }
  })

  return {
    rows: topology.rows.filter((row) =>
      row.searchText.includes(normalizedQuery)
    ),
    nodes: topology.nodes.filter((node) => visibleNodeIds.has(node.id)),
    edges: topology.edges.filter((edge) => visibleEdgeIds.has(edge.id)),
  }
}

export function topologyHasSecretValue(topology: SecretsBrokerTopology) {
  const joined = [
    ...topology.rows.flatMap((row) => [
      row.id,
      row.serviceId,
      row.serviceName,
      row.variableName,
      row.source,
      row.secretRef,
      row.provider,
      row.lastValidation,
    ]),
    ...topology.nodes.flatMap((node) => [node.id, node.label, node.summary]),
    ...topology.edges.flatMap((edge) => [edge.id, edge.label]),
  ].join(' ')

  return /hunter2|correct-horse|plain\s*text\s*secret|sk-[a-z0-9_-]{12,}|ghp_[a-z0-9_]{12,}|AKIA[0-9A-Z]{16}/i.test(
    joined
  )
}
