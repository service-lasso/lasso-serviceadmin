export const DEFAULT_RUNTIME_PROXY_TARGET = 'http://127.0.0.1:17883'

export function resolveRuntimeProxyTarget(target?: string) {
  return target?.trim() || DEFAULT_RUNTIME_PROXY_TARGET
}
