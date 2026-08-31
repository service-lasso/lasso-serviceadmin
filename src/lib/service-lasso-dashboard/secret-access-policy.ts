import {
  containsUnsafeBrokerText,
  requireSafeBrokerIdentifier,
  sanitizeBrokerDisplayText,
  withheldBrokerText,
} from './secrets-safe-text'
import type {
  SecretAccessAssignmentAudit,
  SecretAccessAssignmentFinding,
  SecretAccessPolicyGrant,
  SecretAccessPolicyOperation,
  SecretAccessPolicyScope,
} from './types'

const ACCESS_OPERATIONS: readonly SecretAccessPolicyOperation[] = [
  'resolve',
  'create',
  'update',
  'rotate',
  'delete',
]

const ACCESS_SCOPES: readonly SecretAccessPolicyScope[] = [
  'workspace',
  'service',
  'app',
  'shared',
  'global',
]

/**
 * Inspector row compiled from a live grant or a missing Core audit finding.
 */
export type SecretAccessAssignmentRow = {
  id: string
  kind: 'grant' | 'missing'
  serviceId: string
  workspace: string | null
  namespace: string
  refsLabel: string
  operationsLabel: string
  purpose: string
  status: 'assigned' | 'missing' | 'malformed'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isAccessOperation(
  value: unknown
): value is SecretAccessPolicyOperation {
  return (
    typeof value === 'string' &&
    ACCESS_OPERATIONS.some((operation) => operation === value)
  )
}

function isAccessScope(value: unknown): value is SecretAccessPolicyScope {
  return (
    typeof value === 'string' && ACCESS_SCOPES.some((scope) => scope === value)
  )
}

/**
 * Read a JSON object from a live service.json document without keeping the
 * raw payload for display.
 */
function parseJsonObject(content: string): Record<string, unknown> | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    return null
  }
  if (!isRecord(parsed)) return null
  return parsed
}

/**
 * Sanitize a broker identifier and drop the grant when Core metadata is unsafe.
 */
function safeOptionalIdentifier(value: unknown, field: string): string | null {
  if (value === undefined || value === null) return null
  try {
    return requireSafeBrokerIdentifier(value, field)
  } catch {
    return null
  }
}

/**
 * Parse `broker.accessPolicy.grants` from one live manifest.
 * Only grant metadata is retained. Env values and secret payloads are ignored.
 */
export function parseManifestAccessPolicyGrants(
  content: string,
  fallbackServiceId: string
): SecretAccessPolicyGrant[] {
  const manifest = parseJsonObject(content)
  if (!manifest) return []

  const manifestId =
    safeOptionalIdentifier(manifest.id, 'manifest.id') ??
    safeOptionalIdentifier(fallbackServiceId, 'serviceId')
  if (!manifestId) return []

  const broker = manifest.broker
  if (!isRecord(broker)) return []

  const accessPolicy = broker.accessPolicy
  if (!isRecord(accessPolicy)) return []

  const policyServiceId =
    safeOptionalIdentifier(accessPolicy.serviceId, 'broker.accessPolicy.serviceId') ??
    manifestId
  if (policyServiceId !== manifestId) return []

  const workspace =
    safeOptionalIdentifier(
      accessPolicy.workspace,
      'broker.accessPolicy.workspace'
    ) ?? null

  const grantsValue = accessPolicy.grants
  if (!Array.isArray(grantsValue)) return []

  const grants: SecretAccessPolicyGrant[] = []
  for (const [index, entry] of grantsValue.entries()) {
    if (!isRecord(entry)) continue

    const namespace = safeOptionalIdentifier(
      entry.namespace,
      `broker.accessPolicy.grants[${index}].namespace`
    )
    if (!namespace) continue

    const operationsValue = entry.operations
    if (!Array.isArray(operationsValue)) continue
    const operations = operationsValue.filter(isAccessOperation)
    if (operations.length === 0) continue

    const refsValue = entry.refs
    const refs: string[] = []
    if (Array.isArray(refsValue)) {
      for (const refValue of refsValue) {
        const ref = safeOptionalIdentifier(
          refValue,
          `broker.accessPolicy.grants[${index}].refs`
        )
        if (ref) refs.push(ref)
      }
    }

    const scope = isAccessScope(entry.scope) ? entry.scope : null
    const purpose =
      sanitizeBrokerDisplayText(entry.purpose) ?? withheldBrokerText

    grants.push({
      id: `${policyServiceId}:${namespace}:${index}`,
      serviceId: policyServiceId,
      workspace,
      namespace,
      scope,
      refs,
      namespaceWide: refs.length === 0,
      operations,
      purpose,
    })
  }

  return grants
}

/**
 * Flatten Core secret-reference audit findings that report missing assignment.
 */
export function collectMissingAccessAssignments(
  audit: SecretAccessAssignmentAudit
): SecretAccessAssignmentFinding[] {
  return audit.services.flatMap((service) =>
    service.findings.filter((finding) => {
      if (finding.source !== 'broker.import') return false
      return (
        finding.status === 'malformed' ||
        finding.accessPolicy.status === 'missing'
      )
    })
  )
}

/**
 * Build the operator table from live grants plus missing Core audit rows.
 */
export function buildSecretAccessAssignmentRows(
  audit: SecretAccessAssignmentAudit
): SecretAccessAssignmentRow[] {
  const grantRows: SecretAccessAssignmentRow[] = audit.grants.map((grant) => ({
    id: grant.id,
    kind: 'grant',
    serviceId: grant.serviceId,
    workspace: grant.workspace,
    namespace: grant.namespace,
    refsLabel: grant.namespaceWide
      ? 'namespace-wide'
      : grant.refs.join(', '),
    operationsLabel: grant.operations.join(', '),
    purpose: grant.purpose,
    status: 'assigned',
  }))

  const missingRows: SecretAccessAssignmentRow[] =
    collectMissingAccessAssignments(audit).map((finding, index) => ({
      id: `missing:${finding.serviceId}:${finding.location}:${index}`,
      kind: 'missing',
      serviceId: finding.serviceId,
      workspace: null,
      namespace: finding.namespace ?? 'unspecified',
      refsLabel: finding.ref,
      operationsLabel: finding.accessPolicy.operation,
      purpose:
        sanitizeBrokerDisplayText(finding.accessPolicy.reason) ??
        withheldBrokerText,
      status: finding.status === 'malformed' ? 'malformed' : 'missing',
    }))

  return [...grantRows, ...missingRows]
}

/**
 * True when serialized inspector metadata looks like secret material.
 */
export function secretAccessAssignmentsHaveSecretMaterial(
  audit: SecretAccessAssignmentAudit
): boolean {
  const serialized = JSON.stringify(buildSecretAccessAssignmentRows(audit))
  return containsUnsafeBrokerText(serialized)
}
