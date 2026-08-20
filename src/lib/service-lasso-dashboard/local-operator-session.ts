export const LOCAL_OPERATOR_SESSION_KEY = 'service-lasso.local-operator-session'
export const ORIGINAL_CLIENT_ADDRESS_HEADER = 'x-service-lasso-client-address'
export const LOCAL_ADMIN_TOKEN_HEADER = 'x-service-lasso-admin-token'
export const LOCAL_OPERATOR_USERNAME = 'local-operator'

/**
 * Loopback browser origins that may accept Core local-root without a form.
 * Hostnames such as serviceadmin.servicelasso.localhost are not loopback.
 */
export function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
  return (
    normalized === 'localhost' ||
    normalized === '::1' ||
    normalized === '0:0:0:0:0:0:0:1' ||
    /^127(?:\.\d{1,3}){3}$/u.test(normalized)
  )
}

export function readLocalOperatorSession(): string | null {
  try {
    const value = sessionStorage.getItem(LOCAL_OPERATOR_SESSION_KEY)
    const trimmed = value?.trim()
    return trimmed ? trimmed : null
  } catch {
    return null
  }
}

export function writeLocalOperatorSession(token: string): void {
  const trimmed = token.trim()
  if (!trimmed) {
    clearLocalOperatorSession()
    return
  }
  sessionStorage.setItem(LOCAL_OPERATOR_SESSION_KEY, trimmed)
}

export function clearLocalOperatorSession(): void {
  try {
    sessionStorage.removeItem(LOCAL_OPERATOR_SESSION_KEY)
  } catch {
    // sessionStorage may be unavailable in locked-down browsers.
  }
}

export function withLocalOperatorRequestInit(
  init: RequestInit = {}
): RequestInit {
  const headers = new Headers(init.headers)
  const session = readLocalOperatorSession()
  if (
    session &&
    !headers.has('authorization') &&
    !headers.has(LOCAL_ADMIN_TOKEN_HEADER)
  ) {
    headers.set(LOCAL_ADMIN_TOKEN_HEADER, session)
  }
  return {
    ...init,
    headers,
    credentials: init.credentials ?? 'same-origin',
  }
}
