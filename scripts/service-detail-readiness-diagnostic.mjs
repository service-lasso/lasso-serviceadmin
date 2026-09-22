// Closed, test-only observation. Never retain request/response objects or DOM text.
export function createServiceDetailReadinessObservation() {
  let latest = null
  let requestCount = 0
  let state = 'unobserved'
  let httpStatus = null
  let servicePresent = null
  return {
    started() {
      latest = Symbol('request')
      requestCount = Math.min(999, requestCount + 1)
      state = 'pending'
      httpStatus = null
      servicePresent = null
      return latest
    },
    responded(request, status, present) {
      if (request === null || request !== latest) return
      latest = null
      state = 'responded'
      httpStatus =
        Number.isInteger(status) && status >= 100 && status <= 599
          ? status
          : null
      servicePresent = typeof present === 'boolean' ? present : null
    },
    snapshot(controlsPresent) {
      return {
        kind: 'broker-detail-readiness',
        requestCount,
        state,
        httpStatus,
        servicePresent,
        controlsPresent: controlsPresent === true,
      }
    },
  }
}
