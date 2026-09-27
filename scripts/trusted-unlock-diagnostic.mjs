// Test-only closed observation; never retain network or DOM objects.
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

export function observeTrustedUnlockFailure(emitter, observation, readMarkers) {
  const detach = () => emitter.removeListener('fail', failed)
  function failed(error) {
    detach()
    try {
      if (observation.isActive()) {
        const diagnostic = observation.snapshot(readMarkers())
        // Supplement the original assertion; never serialize the error as metadata.
        if (error instanceof Error) error.message += `\n${JSON.stringify(diagnostic)}`
      }
    } catch {
      // Observation must never replace the original failure.
    } finally { observation.complete() }
    throw error
  }
  emitter.on('fail', failed)
  return () => { detach(); observation.complete() }
}
