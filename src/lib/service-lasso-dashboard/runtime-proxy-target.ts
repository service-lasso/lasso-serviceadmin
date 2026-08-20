export const DEFAULT_RUNTIME_PROXY_TARGET = 'http://127.0.0.1:17883'
export const ORIGINAL_CLIENT_ADDRESS_HEADER = 'x-service-lasso-client-address'

export function resolveRuntimeProxyTarget(target?: string) {
  return target?.trim() || DEFAULT_RUNTIME_PROXY_TARGET
}

export function shouldEnableStubLogMiddleware(value?: string) {
  return value === 'true'
}

/**
 * Overwrite any client-supplied original-client header with the socket peer.
 */
export function applyOriginalClientAddressHeader(
  setHeader: (name: string, value: string) => void,
  removeHeader: (name: string) => void,
  remoteAddress: string | undefined
): void {
  removeHeader(ORIGINAL_CLIENT_ADDRESS_HEADER)
  const address = remoteAddress?.trim()
  if (address) {
    setHeader(ORIGINAL_CLIENT_ADDRESS_HEADER, address)
  }
}
