// Test-only closed observation; never retain network or DOM objects.
const receiptSchema = 'service-admin.trusted-unlock-receipt.v1'
const causalSchema = 'service-admin.trusted-identity-causal.v2'
const diagnosticSchema = 'service-admin.trusted-unlock-diagnostic.v2'
const receiptKeys = Object.freeze([
  'schema',
  'status',
  'present',
  'verified',
  'localRoot',
  'loading',
  'unavailable',
])
const causalKeys = Object.freeze([
  'schema',
  'sequence',
  'request',
  'contract',
  'query',
  'render',
])
const diagnosticKeys = Object.freeze(['schema', 'receipt', 'causal'])

function hasExactKeys(value, keys) {
  try {
    return Object.keys(value).sort().join(',') === keys.slice().sort().join(',')
  } catch {
    return false
  }
}

function ownValue(value, key) {
  try {
    return Object.getOwnPropertyDescriptor(value, key)?.value
  } catch {
    return undefined
  }
}

function ownBoolean(value, key) {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    return typeof descriptor?.value === 'boolean' ? descriptor.value : false
  } catch {
    return false
  }
}

export function createTrustedUnlockReceipt(markers) {
  const verified = ownBoolean(markers, 'verified')
  const localRoot = ownBoolean(markers, 'localRoot')
  const loading = ownBoolean(markers, 'loading')
  const unavailable = ownBoolean(markers, 'unavailable')
  return {
    schema: receiptSchema,
    status: 'observed',
    present: verified || localRoot || loading || unavailable,
    verified,
    localRoot,
    loading,
    unavailable,
  }
}

export function createTrustedIdentityCausalReceipt(value) {
  const sequence = ownValue(value, 'sequence')
  const request = ownValue(value, 'request')
  const contract = ownValue(value, 'contract')
  const query = ownValue(value, 'query')
  const render = ownValue(value, 'render')
  if (
    !Number.isInteger(sequence) || sequence < 0 || sequence > 999 ||
    !['unobserved', 'started', 'response_delivered', 'transport_failed'].includes(request) ||
    !['unobserved', 'parsed', 'rejected'].includes(contract) ||
    !['unobserved', 'pending', 'settled', 'failed'].includes(query) ||
    !['unobserved', 'loading', 'unavailable', 'unlocked', 'login'].includes(render)
  ) return null
  return { schema: causalSchema, sequence, request, contract, query, render }
}

export function parseTrustedIdentityCausalReceipt(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  if (!hasExactKeys(value, causalKeys) || ownValue(value, 'schema') !== causalSchema) {
    return null
  }
  return createTrustedIdentityCausalReceipt(value)
}

export function parseTrustedUnlockReceipt(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  if (!hasExactKeys(value, receiptKeys)) {
    return null
  }
  if (
    value.schema !== receiptSchema ||
    value.status !== 'observed' ||
    !['present', 'verified', 'localRoot', 'loading', 'unavailable'].every(
      (key) => typeof value[key] === 'boolean'
    ) ||
    value.present !== (value.verified || value.localRoot || value.loading || value.unavailable)
  ) {
    return null
  }
  return {
    schema: receiptSchema,
    status: 'observed',
    present: value.present,
    verified: value.verified,
    localRoot: value.localRoot,
    loading: value.loading,
    unavailable: value.unavailable,
  }
}

export function createTrustedUnlockDiagnostic(receipt, causal) {
  const safeReceipt = parseTrustedUnlockReceipt(receipt)
  const safeCausal = parseTrustedIdentityCausalReceipt(causal)
  if (!safeReceipt || !safeCausal) return null
  return { schema: diagnosticSchema, receipt: safeReceipt, causal: safeCausal }
}

export function parseTrustedUnlockDiagnostic(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  if (!hasExactKeys(value, diagnosticKeys) || ownValue(value, 'schema') !== diagnosticSchema) {
    return null
  }
  return createTrustedUnlockDiagnostic(ownValue(value, 'receipt'), ownValue(value, 'causal'))
}

export function createTrustedUnlockObservation() {
  let active = false
  let phase = 'marker_discovery'
  let latest = null
  let requestCount = 0
  let requestState = 'unobserved'
  let httpStatus = null
  let causal = null
  return {
    begin() { active = true },
    verifying() { phase = 'verified_marker' },
    complete() { active = false; latest = null },
    started() {
      if (!active) return null
      latest = Symbol('request')
      requestCount = Math.min(999, requestCount + 1)
      requestState = 'pending'
      httpStatus = null
      return latest
    },
    responded(token, status) {
      if (!active || token === null || token !== latest) return
      latest = null
      requestState = 'responded'
      httpStatus = Number.isInteger(status) && status >= 100 && status <= 599 ? status : null
    },
    causalSnapshot(value) {
      const next = createTrustedIdentityCausalReceipt(value)
      if (next) causal = next
    },
    snapshot(markers) {
      const boolean = (key) => {
        try {
          const value = Object.getOwnPropertyDescriptor(markers, key)?.value
          return typeof value === 'boolean' ? value : null
        } catch { return null }
      }
      return {
        kind: 'trusted-unlock-readiness', phase, requestCount, requestState, httpStatus,
        verifiedMarkerPresent: boolean('verifiedMarkerPresent'),
        localRootButtonPresent: boolean('localRootButtonPresent'),
        loadingMarkerPresent: boolean('loadingMarkerPresent'),
        unavailableMarkerPresent: boolean('unavailableMarkerPresent'),
        causal,
      }
    },
    isActive() { return active },
  }
}

export function observeTrustedUnlockFailure(
  emitter,
  observation,
  readMarkers,
  readReceiptMarkers,
  retainReceipt
) {
  const detach = () => emitter.removeListener('fail', failed)
  function failed(error) {
    detach()
    try {
      if (observation.isActive()) {
        const diagnostic = observation.snapshot(readMarkers())
        // Supplement the original assertion; never serialize the error as metadata.
        if (error instanceof Error) error.message += `\n${JSON.stringify(diagnostic)}`
        if (typeof readReceiptMarkers === 'function') {
          const receipt = createTrustedUnlockReceipt(readReceiptMarkers())
          if (typeof retainReceipt === 'function') retainReceipt(receipt)
        }
      }
    } catch {
      // Observation must never replace the original failure.
    } finally { observation.complete() }
    throw error
  }
  emitter.on('fail', failed)
  return () => { detach(); observation.complete() }
}
