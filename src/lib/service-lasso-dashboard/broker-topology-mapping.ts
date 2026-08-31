import type {
  SecretManagementRecord,
  ServiceEnvironmentVariable,
} from './types'

/**
 * Runtime service slice required to join variables onto Broker metadata.
 */
export type TopologyServiceInput = {
  id: string
  name: string
  environmentVariables: ServiceEnvironmentVariable[]
}

/**
 * Topology mapping statuses. Local-only rows stay on the original four
 * values when Broker validation metadata is unavailable.
 */
export const TOPOLOGY_MAPPING_STATUSES = [
  'mapped',
  'unmapped',
  'missing-source',
  'source-auth-required',
  'policy-denied',
  'broker-locked',
  'audit-unavailable',
  'stale',
  'validation-failed',
  'unknown',
] as const

export type TopologyMappingStatus = (typeof TOPOLOGY_MAPPING_STATUSES)[number]

export type TopologyMappingRow = {
  id: string
  serviceId: string
  serviceName: string
  variableKey: string
  variableScope: 'global' | 'service'
  variableSource: string
  secretRef?: string
  providerId?: string
  providerKind?: string
  status: TopologyMappingStatus
  nextAction: string
  brokerMetadataAvailable: boolean
}

const UNSAFE_TOPOLOGY_KEYS = [
  'masterKey',
  'recoveryShare',
  'passphrase',
  'secretValue',
  'ciphertext',
  'payload',
  'token',
  'password',
  'privateKey',
  'cookie',
  'authorization',
]

/**
 * True when a candidate string looks like a Secrets Broker SecretRef.
 */
export function looksLikeSecretRef(value: string | undefined): boolean {
  if (!value) return false
  return value.startsWith('services/') || value.startsWith('@')
}

/**
 * Maps a Broker inventory outcome onto the topology status set.
 */
export function classifyBrokerValidationStatus(input: {
  outcome?: string
  state?: string
  auditStatus?: string
}): TopologyMappingStatus | undefined {
  const outcome = (input.outcome ?? '').trim().toLowerCase().replace(/_/g, '-')
  const state = (input.state ?? '').trim().toLowerCase().replace(/_/g, '-')
  const audit = (input.auditStatus ?? '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')

  if (audit === 'audit-unavailable') return 'audit-unavailable'
  if (outcome === 'source-auth-required' || state === 'source-auth-required') {
    return 'source-auth-required'
  }
  if (
    outcome === 'policy-denied' ||
    outcome === 'denied' ||
    state === 'policy-denied'
  ) {
    return 'policy-denied'
  }
  if (
    outcome === 'broker-locked' ||
    outcome === 'locked' ||
    state === 'locked'
  ) {
    return 'broker-locked'
  }
  if (outcome === 'stale' || state === 'stale') return 'stale'
  if (
    outcome === 'validation-failed' ||
    outcome === 'failed' ||
    state === 'validation-failed'
  ) {
    return 'validation-failed'
  }
  if (outcome === 'ready' || outcome === 'present' || state === 'present') {
    return 'mapped'
  }
  return undefined
}

/**
 * Local-only mapping status when Broker validation metadata is absent.
 */
export function classifyLocalMappingStatus(input: {
  secret: boolean
  source?: string
}): TopologyMappingStatus {
  const source = input.source?.trim() ?? ''
  if (!input.secret && !looksLikeSecretRef(source)) return 'unmapped'
  if (!source) return 'missing-source'
  if (looksLikeSecretRef(source)) return 'mapped'
  return 'unknown'
}

/**
 * Operator guidance for a non-happy topology status.
 */
export function topologyNextAction(status: TopologyMappingStatus): string {
  switch (status) {
    case 'mapped':
      return 'Mapping is current. Continue monitoring validation metadata.'
    case 'unmapped':
      return 'Create or bind a SecretRef for this variable.'
    case 'missing-source':
      return 'Record a SecretRef source on this service variable.'
    case 'source-auth-required':
      return 'Complete source authentication, then revalidate this mapping.'
    case 'policy-denied':
      return 'Inspect Broker policy grants. This mapping is not authorized.'
    case 'broker-locked':
      return 'Wait for Broker lockout to clear, then retry validation.'
    case 'audit-unavailable':
      return 'Restore Broker audit before treating this mapping as verified.'
    case 'stale':
      return 'Revalidate this mapping against the current Broker store.'
    case 'validation-failed':
      return 'Inspect Broker validation metadata and repair the mapping.'
    default:
      return 'Broker validation metadata is unavailable. Status is not certain.'
  }
}

function inventoryForVariable(
  records: readonly SecretManagementRecord[],
  serviceId: string,
  variableKey: string,
  source: string
): SecretManagementRecord | undefined {
  const sourceRef = looksLikeSecretRef(source) ? source : undefined
  return records.find((record) => {
    if (sourceRef && record.ref === sourceRef) return true
    if (record.name !== variableKey) return false
    if (!record.ownerServiceId) return true
    return (
      record.ownerServiceId === serviceId ||
      record.ownerServiceId === `@${serviceId.replace(/^@/, '')}`
    )
  })
}

/**
 * Joins runtime service variables to safe Broker validation metadata.
 * Graph and table callers must use this same row list.
 */
export function buildTopologyMappingRows(input: {
  services: readonly TopologyServiceInput[]
  inventory: readonly SecretManagementRecord[]
  brokerMetadataAvailable: boolean
}): TopologyMappingRow[] {
  const rows: TopologyMappingRow[] = []
  for (const service of input.services) {
    for (const variable of service.environmentVariables) {
      if (!variable.secret && !looksLikeSecretRef(variable.source)) {
        continue
      }
      const record = inventoryForVariable(
        input.inventory,
        service.id,
        variable.key,
        variable.source ?? ''
      )
      let status: TopologyMappingStatus
      if (!input.brokerMetadataAvailable) {
        status = classifyLocalMappingStatus({
          secret: Boolean(variable.secret),
          source: variable.source,
        })
      } else if (!record) {
        status = variable.source?.trim() ? 'unmapped' : 'missing-source'
      } else {
        status =
          classifyBrokerValidationStatus({
            outcome: record.outcome,
            state: record.state,
            auditStatus: record.auditStatus,
          }) ?? 'unknown'
      }
      rows.push({
        id: `${service.id}:${variable.key}`,
        serviceId: service.id,
        serviceName: service.name,
        variableKey: variable.key,
        variableScope: variable.scope,
        variableSource: variable.source ?? '',
        secretRef: record?.ref,
        providerId: record?.sourceId,
        providerKind: record?.providerKind,
        status,
        nextAction: topologyNextAction(status),
        brokerMetadataAvailable: input.brokerMetadataAvailable,
      })
    }
  }
  return rows
}

/**
 * Throws when topology rows contain secret material fields.
 */
export function assertSafeTopologyRows(
  rows: readonly TopologyMappingRow[]
): void {
  const serialized = JSON.stringify(rows)
  for (const key of UNSAFE_TOPOLOGY_KEYS) {
    if (serialized.includes(`"${key}"`)) {
      throw new Error(
        'Topology mapping rows included withheld secret material.'
      )
    }
  }
}

/**
 * Filters topology rows by status and a metadata-only search string.
 */
export function filterTopologyMappingRows(
  rows: readonly TopologyMappingRow[],
  input: { status?: TopologyMappingStatus | 'all'; query?: string }
): TopologyMappingRow[] {
  const query = input.query?.trim().toLowerCase() ?? ''
  return rows.filter((row) => {
    if (input.status && input.status !== 'all' && row.status !== input.status) {
      return false
    }
    if (!query) return true
    const haystack = [
      row.serviceId,
      row.serviceName,
      row.variableKey,
      row.variableSource,
      row.secretRef ?? '',
      row.providerId ?? '',
      row.status,
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(query)
  })
}

export type TopologyGraphNode = {
  id: string
  label: string
  kind: 'service' | 'ref'
}

export type TopologyGraphEdge = {
  id: string
  source: string
  target: string
  status: TopologyMappingStatus
}

/**
 * Builds graph nodes and edges from the same mapping rows as the table.
 */
export function topologyGraphFromRows(rows: readonly TopologyMappingRow[]): {
  nodes: TopologyGraphNode[]
  edges: TopologyGraphEdge[]
} {
  const nodes = new Map<string, TopologyGraphNode>()
  const edges: TopologyGraphEdge[] = []
  for (const row of rows) {
    nodes.set(row.serviceId, {
      id: row.serviceId,
      label: row.serviceName,
      kind: 'service',
    })
    const targetId = row.secretRef || `${row.serviceId}:${row.variableKey}`
    nodes.set(targetId, {
      id: targetId,
      label: row.secretRef ?? row.variableKey,
      kind: 'ref',
    })
    edges.push({
      id: row.id,
      source: row.serviceId,
      target: targetId,
      status: row.status,
    })
  }
  return { nodes: [...nodes.values()], edges }
}
