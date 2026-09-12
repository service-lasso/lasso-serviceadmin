import type {
  ServiceIsolationDegradeReason,
  ServiceIsolationLimits,
  ServiceIsolationMode,
  ServiceIsolationRequire,
  ServiceIsolationStatus,
} from './types'

function isIsolationMode(value: unknown): value is ServiceIsolationMode {
  return value === 'direct' || value === 'compose-scripts'
}

function isIsolationRequire(value: unknown): value is ServiceIsolationRequire {
  return (
    value === 'none' ||
    value === 'limits' ||
    value === 'dedicated-user' ||
    value === 'hardened'
  )
}

function isDegradeReason(
  value: unknown
): value is ServiceIsolationDegradeReason {
  return (
    value === 'limits_not_applied' ||
    value === 'dedicated_user_unavailable' ||
    value === 'hardening_unavailable'
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readLimits(value: unknown): ServiceIsolationLimits | undefined {
  if (value === undefined) {
    return undefined
  }
  if (!isRecord(value)) {
    return undefined
  }
  const cpuPercent =
    typeof value.cpuPercent === 'number' ? value.cpuPercent : undefined
  const memoryMb =
    typeof value.memoryMb === 'number' ? value.memoryMb : undefined
  const pids = typeof value.pids === 'number' ? value.pids : undefined
  if (
    cpuPercent === undefined &&
    memoryMb === undefined &&
    pids === undefined
  ) {
    return undefined
  }
  return { cpuPercent, memoryMb, pids }
}

/**
 * Accepts Core dashboard `isolation` JSON or ignores unknown/missing payloads.
 * Never treats a Docker control plane as present.
 *
 * @param input Raw `service.isolation` field from Core or stub data.
 */
export function parseServiceIsolation(
  input: unknown
): ServiceIsolationStatus | undefined {
  if (input === undefined || input === null) {
    return undefined
  }
  if (!isRecord(input)) {
    return undefined
  }
  const declaredMode = isIsolationMode(input.declaredMode)
    ? input.declaredMode
    : undefined
  const effectiveMode = isIsolationMode(input.effectiveMode)
    ? input.effectiveMode
    : undefined
  const require = isIsolationRequire(input.require) ? input.require : undefined
  if (
    declaredMode === undefined ||
    effectiveMode === undefined ||
    require === undefined ||
    typeof input.limitsEnforced !== 'boolean' ||
    typeof input.startBlocked !== 'boolean' ||
    !Array.isArray(input.degradeReasons) ||
    !Array.isArray(input.workspace)
  ) {
    return undefined
  }
  const workspace = input.workspace.filter(
    (entry): entry is string => typeof entry === 'string' && entry.length > 0
  )
  const reasons = input.degradeReasons.filter(isDegradeReason)
  const startBlockedReason =
    typeof input.startBlockedReason === 'string'
      ? input.startBlockedReason
      : undefined
  return {
    declaredMode,
    effectiveMode,
    require,
    workspace,
    limits: readLimits(input.limits),
    limitsEnforced: input.limitsEnforced,
    degradeReasons: reasons,
    startBlocked: input.startBlocked,
    startBlockedReason,
  }
}
