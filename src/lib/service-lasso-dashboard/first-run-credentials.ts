/**
 * Loopback-only first-run credential reveal. Secrets stay off
 * `/api/runtime/security` because `normalizeRuntimeIdentity` rejects
 * password/token-shaped payloads.
 *
 * SPEC-005 `AC-5C`: Core persists username/token/password into Broker KV
 * path `runtime/local-operator` before writing the INIT envelope.
 * SPEC-005 `AC-5J`: copy/save/acknowledge remains the operator backup;
 * GET first-run is 503 `first_run_vault_not_ready` until that envelope
 * exists, and 404 once first-run is not pending.
 * SPEC-005 `AC-5H`: callers must never log or dump live secret values.
 */

/** Broker KV path for the three local-operator first-run fields. */
export const LOCAL_OPERATOR_VAULT_PATH = 'runtime/local-operator'

/** Field names only. Never interpolate live secret values next to these. */
export const LOCAL_OPERATOR_VAULT_FIELD_NAMES = [
  'LOCAL_OPERATOR_USERNAME',
  'LOCAL_ADMIN_TOKEN',
  'LOCAL_OPERATOR_PASSWORD',
] as const

/** Core error code while hashed first-run state exists but the envelope is not written. */
export const FIRST_RUN_VAULT_NOT_READY = 'first_run_vault_not_ready'

/** Backoff between GET retries while Broker ingest is still in flight. */
export const FIRST_RUN_VAULT_RETRY_MS = 1500

/**
 * Operator-facing INIT copy. Path and field names only; no env dump and no
 * live secret values (SPEC-005 `AC-5C`, `AC-5J`, `AC-5H`).
 */
export const FIRST_RUN_VAULT_BACKUP_COPY = [
  'These three values are already stored in Secrets Broker at well-known path',
  `${LOCAL_OPERATOR_VAULT_PATH} (${LOCAL_OPERATOR_VAULT_FIELD_NAMES.join(', ')}).`,
  'Copy and save this screen as a backup. Later visits require this token or',
  'the local-operator password. This screen will not dismiss itself.',
].join(' ')

export type FirstRunCredentials = {
  username: string
  token: string
  password: string
}

export type FirstRunFetchResult =
  | { kind: 'ready'; credentials: FirstRunCredentials }
  | { kind: 'not_pending' }
  | { kind: 'vault_not_ready' }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Parse the dedicated first-run envelope. Never pass this payload through
 * `normalizeRuntimeIdentity`.
 */
export function parseFirstRunCredentials(
  payload: unknown
): FirstRunCredentials | null {
  if (!isRecord(payload) || !isRecord(payload.firstRun)) {
    return null
  }
  const firstRun = payload.firstRun
  if (firstRun.pending !== true) {
    return null
  }
  if (
    typeof firstRun.username !== 'string' ||
    firstRun.username.trim().length === 0 ||
    typeof firstRun.token !== 'string' ||
    firstRun.token.length === 0 ||
    typeof firstRun.password !== 'string' ||
    firstRun.password.length === 0
  ) {
    return null
  }
  return {
    username: firstRun.username.trim(),
    token: firstRun.token,
    password: firstRun.password,
  }
}

/**
 * Wait before retrying GET first-run while Broker ingest is still in flight
 * (SPEC-005 `AC-5J` `first_run_vault_not_ready`).
 */
export function delayFirstRunVaultRetry(): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, FIRST_RUN_VAULT_RETRY_MS)
  })
}

/**
 * Fetch one-time loopback credentials.
 *
 * - 200 with a pending envelope → `ready` (show copy/save).
 * - 404 → `not_pending` (skip INIT to login).
 * - 503 `first_run_vault_not_ready` → `vault_not_ready` (keep INIT, retry).
 */
export async function fetchFirstRunCredentials(): Promise<FirstRunFetchResult> {
  const response = await fetch('/api/runtime/auth/first-run')
  const payload: unknown = await response.json().catch(() => null)
  if (response.status === 404) {
    return { kind: 'not_pending' }
  }
  if (
    response.status === 503 &&
    isRecord(payload) &&
    payload.error === FIRST_RUN_VAULT_NOT_READY
  ) {
    return { kind: 'vault_not_ready' }
  }
  if (!response.ok) {
    const error =
      isRecord(payload) && typeof payload.error === 'string'
        ? payload.error
        : 'first_run_unavailable'
    throw new Error(error)
  }
  const credentials = parseFirstRunCredentials(payload)
  if (!credentials) {
    throw new Error('first_run_payload_invalid')
  }
  return { kind: 'ready', credentials }
}

/**
 * Tell Core the operator saved the token. Invalidates Core's local-auth cache.
 */
export async function acknowledgeFirstRunCredentials(): Promise<void> {
  const response = await fetch('/api/runtime/auth/first-run/acknowledge', {
    method: 'POST',
  })
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const error =
      isRecord(payload) && typeof payload.error === 'string'
        ? payload.error
        : 'first_run_acknowledge_rejected'
    throw new Error(error)
  }
}
