// Test-only closed observation; never retain network or DOM objects.
const receiptSchema = 'service-admin.trusted-unlock-receipt.v1'
const receiptPrefix = '\nSERVICE_ADMIN_TRUSTED_UNLOCK_RECEIPT:'
const receiptKeys = Object.freeze([
  'schema',
  'status',
  'present',
  'verified',
  'localRoot',
  'loading',
  'unavailable',
])

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

export function parseTrustedUnlockReceipt(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  if (Object.keys(value).sort().join(',') !== receiptKeys.slice().sort().join(',')) {
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

export function observeTrustedUnlockReceiptFailure(emitter, readMarkers) {
  const detach = () => emitter.removeListener('fail', failed)
  function failed(error) {
    detach()
    try {
      const receipt = createTrustedUnlockReceipt(readMarkers())
      // Cypress delivers this original failure to its Node after:spec result.
      // No command is queued from this handler.
      if (error instanceof Error) error.message += receiptPrefix + JSON.stringify(receipt)
    } catch {
      // Receipt production must never replace the original assertion failure.
    }
    throw error
  }
  emitter.on('fail', failed)
  return detach
}

export function receiptFromCypressSpecResults(results) {
  if (!results || typeof results !== 'object' || !Array.isArray(results.tests)) {
    return null
  }
  for (const result of results.tests.slice(0, 64)) {
    const displayError = result?.displayError
    if (typeof displayError !== 'string' || displayError.length > 65_536) continue
    const start = displayError.lastIndexOf(receiptPrefix)
    if (start < 0) continue
    const encoded = displayError.slice(start + receiptPrefix.length)
    if (encoded.length > 256 || encoded.includes('\n')) continue
    try {
      const receipt = parseTrustedUnlockReceipt(JSON.parse(encoded))
      if (receipt) return receipt
    } catch {
      // The result error remains Cypress-owned and is never retained here.
    }
  }
  return null
}

export function createTrustedUnlockObservation() {
  let active = false
  let phase = 'marker_discovery'
  let latest = null
  let requestCount = 0
  let requestState = 'unobserved'
  let httpStatus = null
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
      }
    },
    isActive() { return active },
  }
}

export function observeTrustedUnlockFailure(
  emitter,
  observation,
  readMarkers,
  readReceiptMarkers
) {
  const detach = () => emitter.removeListener('fail', failed)
  function failed(error) {
    detach()
    try {
      if (observation.isActive()) {
        const diagnostic = observation.snapshot(readMarkers())
        // Supplement the original assertion; never serialize the error as metadata.
        if (error instanceof Error) error.message += `\n${JSON.stringify(diagnostic)}`
        if (typeof readReceiptMarkers === 'function' && error instanceof Error) {
          error.message += receiptPrefix + JSON.stringify(createTrustedUnlockReceipt(readReceiptMarkers()))
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
