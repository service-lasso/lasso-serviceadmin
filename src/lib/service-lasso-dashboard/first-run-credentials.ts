/**
 * Loopback-only first-run credential reveal. Secrets stay off
 * `/api/runtime/security` because `normalizeRuntimeIdentity` rejects
 * password/token-shaped payloads.
 */

export type FirstRunCredentials = {
  username: string
  token: string
  password: string
}

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
 * Fetch one-time loopback credentials. Returns null when Core reports
 * not-pending (404) so the login form can take over.
 */
export async function fetchFirstRunCredentials(): Promise<FirstRunCredentials | null> {
  const response = await fetch('/api/runtime/auth/first-run')
  const payload: unknown = await response.json().catch(() => null)
  if (response.status === 404) {
    return null
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
  return credentials
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
