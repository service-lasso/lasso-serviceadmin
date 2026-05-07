import type { Edge, Node } from '@xyflow/react'
import { secretsBrokerAuditEvents } from './audit-events'
import { secretsBrokerProviderConnections } from './provider-connections'
import { secretsBrokerSourceBackends } from './source-backends'

export type SecretsBrokerTopologyNodeKind =
  | 'broker'
  | 'source'
  | 'connection'
  | 'ref'
  | 'service'
  | 'workflow'
  | 'run'

export type SecretsBrokerTopologyEdgeKind =
  | 'resolves-from'
  | 'uses'
  | 'writes-back'
  | 'failed'
  | 'denied'
  | 'provider-owns'
  | 'run-uses'

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
  status: 'ok' | 'warning' | 'failed' | 'denied' | 'missing'
  detailHref: string
  auditHref: string
  diagnosticHref?: string
}

export type SecretsBrokerTopology = {
  nodes: SecretsBrokerTopologyNode[]
  edges: SecretsBrokerTopologyEdge[]
}

const serviceIds = ['@serviceadmin', '@secretsbroker', 'postgres']
const workflowIds = [
  'service-start',
  'secret-rotation-preview',
  'deploy-payments-api',
]
const runIds = ['run-20260507-190144', 'run-20260507-185812']

function serviceNode(id: string): SecretsBrokerTopologyNode {
  return {
    id: `service:${id}`,
    label: id,
    kind: 'service',
    summary: 'Service using broker refs or broker metadata.',
    detailHref: `/services/${encodeURIComponent(id)}`,
    auditHref: `/secrets-broker#audit-events`,
    diagnosticHref: `/secrets-broker#diagnostics`,
  }
}

function workflowNode(id: string): SecretsBrokerTopologyNode {
  return {
    id: `workflow:${id}`,
    label: id,
    kind: 'workflow',
    summary: 'Workflow using broker refs through an audited run identity.',
    detailHref: `/dependencies?service=${encodeURIComponent(id)}`,
    auditHref: `/secrets-broker#audit-events`,
    diagnosticHref: `/secrets-broker#diagnostics`,
  }
}

function runNode(id: string): SecretsBrokerTopologyNode {
  return {
    id: `run:${id}`,
    label: id,
    kind: 'run',
    summary: 'Audited workflow/service run context with safe metadata only.',
    detailHref: `/secrets-broker#audit-events`,
    auditHref: `/secrets-broker#audit-events`,
    diagnosticHref: `/secrets-broker#diagnostics`,
  }
}

function refId(ref: string) {
  return `ref:${ref.replace(/[^a-z0-9@._:/-]+/gi, '-')}`
}

function refNode(ref: string): SecretsBrokerTopologyNode {
  return {
    id: refId(ref),
    label: ref,
    kind: 'ref',
    summary: 'SecretRef identifier only; resolved value is hidden.',
    detailHref: `/secrets-broker#audit-events`,
    auditHref: `/secrets-broker#audit-events`,
    diagnosticHref: `/secrets-broker#diagnostics`,
  }
}

function edgeStatusFromOutcome(
  outcome: (typeof secretsBrokerAuditEvents)[number]['outcome']
): SecretsBrokerTopologyEdge['status'] {
  if (outcome === 'denied' || outcome === 'revoked') return 'denied'
  if (outcome === 'failure') return 'failed'
  return 'ok'
}

function edgeKindFromEvent(
  event: (typeof secretsBrokerAuditEvents)[number]
): SecretsBrokerTopologyEdgeKind {
  if (event.outcome === 'denied' || event.outcome === 'revoked') return 'denied'
  if (event.outcome === 'failure') return 'failed'
  if (event.type === 'write_back_denied' || event.type === 'secret_rotated') {
    return 'writes-back'
  }
  return 'uses'
}

export function buildSecretsBrokerTopology(): SecretsBrokerTopology {
  const nodes = new Map<string, SecretsBrokerTopologyNode>()
  const edges: SecretsBrokerTopologyEdge[] = []

  nodes.set('broker:@secretsbroker', {
    id: 'broker:@secretsbroker',
    label: '@secretsbroker',
    kind: 'broker',
    summary:
      'Broker service mediating secret refs, providers, policies, and audit.',
    detailHref: '/secrets-broker',
    auditHref: '/secrets-broker#audit-events',
    diagnosticHref: '/secrets-broker#diagnostics',
  })

  secretsBrokerSourceBackends.forEach((source) => {
    const sourceNode: SecretsBrokerTopologyNode = {
      id: `source:${source.id}`,
      label: source.title,
      kind: 'source',
      summary: `${source.provider} source · ${source.state} · ${source.mode}`,
      detailHref: '/secrets-broker#secret-sources',
      auditHref: '/secrets-broker#audit-events',
      diagnosticHref: '/secrets-broker#diagnostics',
    }
    nodes.set(sourceNode.id, sourceNode)
    edges.push({
      id: `broker-source:${source.id}`,
      source: sourceNode.id,
      target: 'broker:@secretsbroker',
      label: 'provider/source ownership',
      kind: 'provider-owns',
      status:
        source.state === 'failing'
          ? 'failed'
          : source.state === 'not-configured'
            ? 'missing'
            : 'ok',
      detailHref: '/secrets-broker#secret-sources',
      auditHref: '/secrets-broker#audit-events',
      diagnosticHref: '/secrets-broker#diagnostics',
    })

    source.exampleRefs.forEach((ref) => {
      const safeRefNode = refNode(ref)
      nodes.set(safeRefNode.id, safeRefNode)
      edges.push({
        id: `source-ref:${source.id}:${safeRefNode.id}`,
        source: sourceNode.id,
        target: safeRefNode.id,
        label: 'resolves from',
        kind: 'resolves-from',
        status:
          source.testResult.outcome === 'failure'
            ? 'failed'
            : source.testResult.outcome === 'not-run'
              ? 'warning'
              : 'ok',
        detailHref: '/secrets-broker#secret-sources',
        auditHref: '/secrets-broker#audit-events',
        diagnosticHref: '/secrets-broker#diagnostics',
      })
    })
  })

  secretsBrokerProviderConnections.forEach((connection) => {
    const connectionNode: SecretsBrokerTopologyNode = {
      id: `connection:${connection.id}`,
      label: connection.title,
      kind: 'connection',
      summary: `${connection.provider} connection · ${connection.state} · ${connection.secretMaterial.presence}`,
      detailHref: `/secrets-broker/${connection.id}`,
      auditHref: '/secrets-broker#audit-events',
      diagnosticHref: '/secrets-broker#diagnostics',
    }
    nodes.set(connectionNode.id, connectionNode)
    edges.push({
      id: `broker-connection:${connection.id}`,
      source: 'broker:@secretsbroker',
      target: connectionNode.id,
      label: 'provider connection',
      kind: 'provider-owns',
      status:
        connection.state === 'healthy'
          ? 'ok'
          : connection.state === 'missing'
            ? 'missing'
            : connection.state === 'failed'
              ? 'failed'
              : 'warning',
      detailHref: `/secrets-broker/${connection.id}`,
      auditHref: '/secrets-broker#audit-events',
      diagnosticHref: '/secrets-broker#diagnostics',
    })

    connection.usage.linkedServices.forEach((service) => {
      const node = serviceNode(service)
      nodes.set(node.id, node)
      edges.push({
        id: `connection-service:${connection.id}:${service}`,
        source: connectionNode.id,
        target: node.id,
        label:
          connection.state === 'healthy' ? 'uses' : 'missing/denied resolution',
        kind:
          connection.state === 'healthy'
            ? 'uses'
            : connection.state === 'missing'
              ? 'denied'
              : 'failed',
        status:
          connection.state === 'healthy'
            ? 'ok'
            : connection.state === 'missing'
              ? 'missing'
              : 'warning',
        detailHref: `/secrets-broker/${connection.id}`,
        auditHref: '/secrets-broker#audit-events',
        diagnosticHref: '/secrets-broker#diagnostics',
      })
    })

    connection.usage.linkedWorkflows.forEach((workflow) => {
      const node = workflowNode(workflow)
      nodes.set(node.id, node)
      edges.push({
        id: `connection-workflow:${connection.id}:${workflow}`,
        source: connectionNode.id,
        target: node.id,
        label: 'workflow uses',
        kind: 'uses',
        status: connection.state === 'healthy' ? 'ok' : 'warning',
        detailHref: `/secrets-broker/${connection.id}`,
        auditHref: '/secrets-broker#audit-events',
        diagnosticHref: '/secrets-broker#diagnostics',
      })
    })

    connection.usage.linkedRuns.forEach((run) => {
      const node = runNode(run)
      nodes.set(node.id, node)
      edges.push({
        id: `connection-run:${connection.id}:${run}`,
        source: connectionNode.id,
        target: node.id,
        label: 'audited run',
        kind: 'run-uses',
        status: connection.state === 'healthy' ? 'ok' : 'warning',
        detailHref: `/secrets-broker/${connection.id}`,
        auditHref: '/secrets-broker#audit-events',
        diagnosticHref: '/secrets-broker#diagnostics',
      })
    })
  })

  serviceIds.forEach((service) =>
    nodes.set(`service:${service}`, serviceNode(service))
  )
  workflowIds.forEach((workflow) =>
    nodes.set(`workflow:${workflow}`, workflowNode(workflow))
  )
  runIds.forEach((run) => nodes.set(`run:${run}`, runNode(run)))

  secretsBrokerAuditEvents.forEach((event) => {
    const targetKind =
      event.actorType === 'workflow'
        ? 'workflow'
        : event.actorType === 'cli-session'
          ? 'run'
          : 'service'
    const targetId = `${targetKind}:${event.serviceOrWorkflow}`
    if (!nodes.has(targetId)) {
      nodes.set(
        targetId,
        targetKind === 'workflow'
          ? workflowNode(event.serviceOrWorkflow)
          : targetKind === 'run'
            ? runNode(event.serviceOrWorkflow)
            : serviceNode(event.serviceOrWorkflow)
      )
    }
    const safeRefNode = refNode(event.ref)
    nodes.set(safeRefNode.id, safeRefNode)
    edges.push({
      id: `audit:${event.id}`,
      source: safeRefNode.id,
      target: targetId,
      label: event.type.replace(/_/g, ' '),
      kind: edgeKindFromEvent(event),
      status: edgeStatusFromOutcome(event.outcome),
      detailHref: `/secrets-broker#audit-events`,
      auditHref: `/secrets-broker#audit-events`,
      diagnosticHref:
        event.outcome === 'failure' || event.outcome === 'denied'
          ? '/secrets-broker#diagnostics'
          : undefined,
    })
  })

  return { nodes: Array.from(nodes.values()), edges }
}

const nodePositionByKind: Record<
  SecretsBrokerTopologyNodeKind,
  { x: number; y: number }
> = {
  source: { x: -620, y: 0 },
  broker: { x: -300, y: 0 },
  connection: { x: 20, y: 0 },
  ref: { x: 340, y: 0 },
  service: { x: 660, y: -120 },
  workflow: { x: 660, y: 120 },
  run: { x: 980, y: 120 },
}

const nodeKindColor: Record<SecretsBrokerTopologyNodeKind, string> = {
  broker: '#2563eb',
  source: '#0891b2',
  connection: '#7c3aed',
  ref: '#f59e0b',
  service: '#16a34a',
  workflow: '#db2777',
  run: '#64748b',
}

const edgeStatusColor: Record<SecretsBrokerTopologyEdge['status'], string> = {
  ok: '#16a34a',
  warning: '#f59e0b',
  failed: '#dc2626',
  denied: '#991b1b',
  missing: '#f97316',
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
        borderRadius: 12,
        background: '#ffffff',
        color: '#0f172a',
        fontSize: 12,
        minWidth: 150,
        maxWidth: 210,
        whiteSpace: 'pre-line',
      },
    }
  })

  const edges: Edge[] = topology.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    animated: edge.status === 'failed' || edge.status === 'denied',
    style: {
      stroke: edgeStatusColor[edge.status],
      strokeWidth: edge.status === 'ok' ? 2 : 3,
      strokeDasharray: edge.status === 'ok' ? undefined : '6 4',
    },
    labelStyle: { fill: edgeStatusColor[edge.status], fontWeight: 600 },
  }))

  return { nodes, edges }
}

export function topologyHasSecretValue(topology: SecretsBrokerTopology) {
  const joined = [
    ...topology.nodes.flatMap((node) => [node.id, node.label, node.summary]),
    ...topology.edges.flatMap((edge) => [edge.id, edge.label]),
  ].join(' ')

  return /hunter2|correct-horse|plain\s*text\s*secret|sk-[a-z0-9_-]{12,}|ghp_[a-z0-9_]{12,}|AKIA[0-9A-Z]{16}/i.test(
    joined
  )
}
