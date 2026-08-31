import type {
  BrokerOperationCapability,
  BrokerProviderActionPhase,
  BrokerProviderActionResult,
  BrokerProviderActionUiState,
  BrokerProviderRowActionName,
  BrokerProviderRowActionRequest,
  BrokerProviderStatus,
} from './types'

type RuntimeUnavailableDetailsLike = {
  status: number | null
  errorCode?: string | null
}

/**
 * Duck-types runtime API failures without importing the dashboard client.
 */
function readUnavailableDetails(
  error: unknown
): RuntimeUnavailableDetailsLike | null {
  if (typeof error !== 'object' || error === null) return null
  if (!('details' in error)) return null
  const details = Reflect.get(error, 'details')
  if (typeof details !== 'object' || details === null) return null
  const status = Reflect.get(details, 'status')
  const errorCode = Reflect.get(details, 'errorCode')
  if (status !== null && typeof status !== 'number') return null
  if (
    errorCode !== undefined &&
    errorCode !== null &&
    typeof errorCode !== 'string'
  ) {
    return null
  }
  return {
    status: typeof status === 'number' ? status : null,
    errorCode: typeof errorCode === 'string' ? errorCode : undefined,
  }
}

export const LOCAL_ENCRYPTED_STORE_KIND = 'local-encrypted-store'
export const LOCAL_FALLBACK_PROVIDER_ID = 'local'
export const LOCAL_FALLBACK_BLOCK_REASON =
  'Local encrypted store is the fallback provider and cannot be disabled or removed.'

const READ_MATURITIES = new Set(['read-only', 'executable', 'validated'])
const DRY_RUN_MATURITIES = new Set(['dry-run', 'executable', 'validated'])
const APPLY_MATURITIES = new Set(['executable', 'validated'])

const ACTION_ROUTES: Record<
  BrokerProviderRowActionName,
  { path: string; kind: 'read' | 'dry-run' | 'apply' | 'unadvertised' }
> = {
  status: { path: '/v1/providers/config/status', kind: 'read' },
  capabilities: { path: '/v1/providers/capabilities', kind: 'read' },
  validate: { path: '/v1/providers/config/validate', kind: 'dry-run' },
  reconnect: { path: '/v1/sources/status', kind: 'read' },
  'configure-dry-run': {
    path: '/v1/providers/config/validate',
    kind: 'dry-run',
  },
  'configure-apply': { path: '/v1/providers/config/apply', kind: 'apply' },
  disable: { path: '', kind: 'unadvertised' },
  remove: { path: '', kind: 'unadvertised' },
}

const ACTION_LABELS: Record<BrokerProviderRowActionName, string> = {
  status: 'status',
  capabilities: 'capabilities',
  validate: 'validate',
  reconnect: 'reconnect',
  'configure-dry-run': 'configure-dry-run',
  'configure-apply': 'configure-apply',
  disable: 'disable',
  remove: 'remove',
}

/**
 * Returns true when the provider is the local encrypted fallback store.
 */
export function isLocalEncryptedStoreProvider(provider: BrokerProviderStatus) {
  return (
    provider.providerId === LOCAL_FALLBACK_PROVIDER_ID ||
    provider.providerKind === LOCAL_ENCRYPTED_STORE_KIND
  )
}

/**
 * Finds the exact connection-scoped operation for a Broker path.
 */
export function findProviderOperation(
  provider: BrokerProviderStatus,
  path: string
): BrokerOperationCapability | undefined {
  return provider.operations.find((operation) => operation.path === path)
}

function maturityAllowed(
  kind: 'read' | 'dry-run' | 'apply' | 'unadvertised',
  maturity: string
) {
  if (kind === 'read') return READ_MATURITIES.has(maturity)
  if (kind === 'dry-run') return DRY_RUN_MATURITIES.has(maturity)
  if (kind === 'apply') return APPLY_MATURITIES.has(maturity)
  return false
}

export type ProviderRowActionGate = {
  enabled: boolean
  state: BrokerProviderActionUiState
  summary: string
  nextAction: string
}

/**
 * Decides whether a row action may call a live route.
 * Family capability strings never enable a mutation.
 */
export function evaluateProviderRowAction(
  request: Pick<BrokerProviderRowActionRequest, 'action' | 'provider'>
): ProviderRowActionGate {
  const { action, provider } = request

  if (action === 'disable' || action === 'remove') {
    if (isLocalEncryptedStoreProvider(provider)) {
      return {
        enabled: false,
        state: 'policy-denied',
        summary: LOCAL_FALLBACK_BLOCK_REASON,
        nextAction: 'keep_local_encrypted_store_enabled',
      }
    }
    return {
      enabled: false,
      state: 'unsupported',
      summary: `Provider ${action} is not advertised by this source.`,
      nextAction: 'wait_for_advertised_source_operation',
    }
  }

  if (action === 'status') {
    return {
      enabled: true,
      state: 'ready',
      summary: 'Refresh live provider status metadata.',
      nextAction: 'inspect_provider_status',
    }
  }

  if (action === 'capabilities') {
    return {
      enabled: true,
      state: 'ready',
      summary: 'Read live provider capability catalog metadata.',
      nextAction: 'inspect_provider_capabilities',
    }
  }

  const route = ACTION_ROUTES[action]
  const operation = findProviderOperation(provider, route.path)
  if (!operation) {
    return {
      enabled: false,
      state: 'unsupported',
      summary: `${ACTION_LABELS[action]} is not advertised for this source.`,
      nextAction: 'wait_for_advertised_source_operation',
    }
  }
  if (!maturityAllowed(route.kind, operation.maturity)) {
    return {
      enabled: false,
      state: mapBrokerOutcomeToUiState(
        operation.limitationCode || operation.reasonCode || operation.maturity
      ),
      summary: `${ACTION_LABELS[action]} is not executable on this source.`,
      nextAction:
        operation.nextAction || 'wait_for_advertised_source_operation',
    }
  }

  return {
    enabled: true,
    state: 'ready',
    summary: `Call live ${ACTION_LABELS[action]} for this source.`,
    nextAction: operation.nextAction || 'execute_guarded_operation',
  }
}

/**
 * Maps Broker outcomes and reason codes onto the typed Admin UI states.
 */
export function mapBrokerOutcomeToUiState(
  outcome: string
): BrokerProviderActionUiState {
  const normalized = outcome.trim().toLowerCase().replace(/_/g, '-')
  if (
    normalized === 'ready' ||
    normalized === 'applied' ||
    normalized === 'dry-run-ready' ||
    normalized === 'connected'
  ) {
    return 'ready'
  }
  if (normalized === 'loading' || normalized === 'pending') return 'loading'
  if (
    normalized === 'source-auth-required' ||
    normalized === 'auth-required' ||
    normalized === 'identity-expired'
  ) {
    return 'auth-required'
  }
  if (normalized === 'locked' || normalized === 'reconnect-required') {
    return 'locked'
  }
  if (normalized === 'policy-denied' || normalized === 'denied') {
    return 'policy-denied'
  }
  if (
    normalized === 'unsupported' ||
    normalized === 'planned' ||
    normalized === 'not-implemented'
  ) {
    return 'unsupported'
  }
  if (
    normalized === 'setup-needed' ||
    normalized === 'missing' ||
    normalized === 'missing-ref' ||
    normalized === 'not-configured'
  ) {
    return 'setup-needed'
  }
  if (normalized === 'audit-unavailable') return 'audit-unavailable'
  if (
    normalized === 'degraded' ||
    normalized === 'source-unavailable' ||
    normalized === 'partial-failure'
  ) {
    return 'degraded'
  }
  if (
    normalized === 'unavailable' ||
    normalized === 'not-found' ||
    normalized === 'conflict'
  ) {
    return 'unavailable'
  }
  return 'unavailable'
}

/**
 * Maps a clicked-row typed state onto pending/success/failure/blocked chrome.
 */
export function phaseForUiState(
  state: BrokerProviderActionUiState
): BrokerProviderActionPhase {
  if (state === 'loading') return 'pending'
  if (state === 'ready') return 'success'
  if (
    state === 'unsupported' ||
    state === 'policy-denied' ||
    state === 'auth-required' ||
    state === 'locked' ||
    state === 'setup-needed'
  ) {
    return 'blocked'
  }
  return 'failure'
}

/**
 * Maps a runtime HTTP/fetch failure onto a typed, secret-free action result.
 */
export function mapRuntimeErrorToActionState(
  error: unknown
): Pick<BrokerProviderActionResult, 'state' | 'summary' | 'nextAction'> {
  const details = readUnavailableDetails(error)
  if (!details) {
    return {
      state: 'unavailable',
      summary: 'Provider action failed closed.',
      nextAction: 'retry_or_inspect_source',
    }
  }
  const status = details.status
  const code = (details.errorCode ?? '').toLowerCase()
  if (status === 401 || code === 'source_auth_required') {
    return {
      state: 'auth-required',
      summary: 'Provider authentication is required before this action.',
      nextAction: 'reconnect_source',
    }
  }
  if (status === 403 || code === 'policy_denied') {
    return {
      state: 'policy-denied',
      summary: 'Provider action was denied by policy.',
      nextAction: 'review_policy',
    }
  }
  if (status === 423 || code === 'locked') {
    return {
      state: 'locked',
      summary: 'Provider or local store is locked.',
      nextAction: 'unlock_or_unseal_source',
    }
  }
  if (status === 501 || code === 'unsupported' || code === 'not_implemented') {
    return {
      state: 'unsupported',
      summary: 'Provider action is unsupported on this source.',
      nextAction: 'wait_for_advertised_source_operation',
    }
  }
  if (status === 404) {
    return {
      state: 'unavailable',
      summary: 'Provider action route is unavailable.',
      nextAction: 'inspect_broker_route_advertisement',
    }
  }
  if (code === 'audit_unavailable' || status === 503) {
    return {
      state: code === 'audit_unavailable' ? 'audit-unavailable' : 'unavailable',
      summary:
        code === 'audit_unavailable'
          ? 'Provider action failed closed because audit is unavailable.'
          : 'Provider action route is unavailable.',
      nextAction:
        code === 'audit_unavailable'
          ? 'restore_audit_and_retry'
          : 'retry_or_inspect_source',
    }
  }
  return {
    state: 'unavailable',
    summary: 'Provider action failed closed.',
    nextAction: 'retry_or_inspect_source',
  }
}

/**
 * Builds the secret-free row-action result operators may render.
 */
export function buildProviderActionResult(input: {
  providerId: string
  sourceId?: string
  operation: BrokerProviderRowActionName
  state: BrokerProviderActionUiState
  summary: string
  nextAction: string
  correlationId?: string
  checkedAt?: string
  fixtureDemo: boolean
}): BrokerProviderActionResult {
  return {
    providerId: input.providerId,
    sourceId: input.sourceId ?? input.providerId,
    operation: input.operation,
    phase: phaseForUiState(input.state),
    state: input.state,
    summary: input.fixtureDemo
      ? `${input.summary} (fixture/demo)`
      : input.summary,
    nextAction: input.nextAction,
    correlationId: input.correlationId,
    checkedAt: input.checkedAt ?? new Date().toISOString(),
    fixtureDemo: input.fixtureDemo,
  }
}

export function pendingProviderActionResult(
  request: BrokerProviderRowActionRequest,
  fixtureDemo: boolean
): BrokerProviderActionResult {
  return buildProviderActionResult({
    providerId: request.provider.providerId,
    sourceId: request.provider.providerId,
    operation: request.action,
    state: 'loading',
    summary: `Calling live ${ACTION_LABELS[request.action]}.`,
    nextAction: 'wait_for_provider_action',
    fixtureDemo,
  })
}

export function gatedProviderActionResult(
  request: BrokerProviderRowActionRequest,
  fixtureDemo: boolean
): BrokerProviderActionResult | null {
  const gate = evaluateProviderRowAction(request)
  if (gate.enabled) return null
  return buildProviderActionResult({
    providerId: request.provider.providerId,
    sourceId: request.provider.providerId,
    operation: request.action,
    state: gate.state,
    summary: gate.summary,
    nextAction: gate.nextAction,
    fixtureDemo,
  })
}

export function actionResultFromRuntimeError(
  request: BrokerProviderRowActionRequest,
  error: unknown,
  fixtureDemo: boolean
): BrokerProviderActionResult {
  const mapped = mapRuntimeErrorToActionState(error)
  const details = readUnavailableDetails(error)
  return buildProviderActionResult({
    providerId: request.provider.providerId,
    sourceId: request.provider.providerId,
    operation: request.action,
    state: mapped.state,
    summary: mapped.summary,
    nextAction: mapped.nextAction,
    correlationId: details?.errorCode ?? undefined,
    fixtureDemo,
  })
}
