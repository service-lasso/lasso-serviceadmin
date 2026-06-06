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
          auditHref: '/secrets-broker/audit-events',
          diagnosticsHref: '/secrets-broker/diagnostics',
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
    detailHref: '/secrets-broker',
    auditHref: '/secrets-broker/audit-events',
    diagnosticHref: '/secrets-broker/diagnostics',
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

const nodePositionByKind: Record<
  SecretsBrokerTopologyNodeKind,
  { x: number; y: number }
> = {
  broker: { x: -580, y: 0 },
  provider: { x: -300, y: -120 },
  service: { x: -300, y: 160 },
  variable: { x: 20, y: 0 },
  ref: { x: 340, y: 0 },
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

export function toReactFlowSecretsBrokerTopology(
  topology: SecretsBrokerTopology
) {
  const kindIndexes = new Map<SecretsBrokerTopologyNodeKind, number>()

  const nodes: Node[] = topology.nodes.map((node) => {
    const index = kindIndexes.get(node.kind) ?? 0
    kindIndexes.set(node.kind, index + 1)
    const base = nodePositionByKind[node.kind]

    return {
      id: node.id,
      position: { x: base.x, y: base.y + index * 110 },
      data: {
        label: `${node.label}\n${node.kind}`,
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
  })

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
