// Closed, test-only observation. Never retain request/response objects or DOM text.
export function createServiceDetailReadinessObservation() {
  let latest = null
  let requestCount = 0
  let state = 'unobserved'
  let httpStatus = null
  let servicePresent = null
  let responseToken = null
  let responseDelivery = 'unobserved'
  return {
    started() {
      latest = Symbol('request')
      requestCount = Math.min(999, requestCount + 1)
      state = 'pending'
      httpStatus = null
      servicePresent = null
      responseToken = null
      responseDelivery = 'pending'
      return latest
    },
    responded(request, status, present) {
      if (request === null || request !== latest) return
      latest = null
      responseToken = request
      state = 'responded'
      httpStatus =
        Number.isInteger(status) && status >= 100 && status <= 599
          ? status
          : null
      servicePresent = typeof present === 'boolean' ? present : null
    },
    delivered(request) {
      if (request === null || request !== responseToken) return
      responseDelivery = 'complete'
    },
    snapshot(controlsPresent, renderState) {
      return {
        kind: 'broker-detail-readiness',
        requestCount,
        state,
        httpStatus,
        servicePresent,
        responseDelivery,
        controlsPresent: controlsPresent === true,
        ...(renderState
          ? {
              renderState: {
                skeletonPresent: renderState.skeletonPresent === true,
                serviceNotFoundPresent:
                  renderState.serviceNotFoundPresent === true,
                generalErrorPresent: renderState.generalErrorPresent === true,
                pageNotFoundPresent: renderState.pageNotFoundPresent === true,
              },
            }
          : {}),
      }
    },
  }
}
