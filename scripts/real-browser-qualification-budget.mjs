export const cypressQualificationTimeoutMs = 12 * 60_000
export const linkedRotationExecuteCount = 2
export const linkedRotationResponseTimeoutMs = 120_000
export const brokerMetadataReadinessAttempts = 5
export const brokerMetadataRequestTimeoutMs = 10_000
export const brokerMetadataRetryDelayMs = 1_000
export const brokerMetadataEndpointCount = 2
export const brokerMetadataReservedLifecycleMs = 6 * 60_000
export const managedServiceStopReadinessAttempts = 5
export const managedServiceStopRequestTimeoutMs = 10_000
export const managedServiceStopRetryDelayMs = 1_000

export function brokerMetadataRequestOptions(url) {
  return {
    method: 'GET',
    url,
    failOnStatusCode: false,
    retryOnNetworkFailure: false,
    timeout: brokerMetadataRequestTimeoutMs,
  }
}

export function managedServiceStopRequestOptions(url) {
  return {
    method: 'GET',
    url,
    failOnStatusCode: false,
    retryOnNetworkFailure: false,
    timeout: managedServiceStopRequestTimeoutMs,
  }
}

export function isManagedServiceStoppedResponse({ status, body }) {
  return status === 200 && body?.service?.lifecycle?.running === false
}

export function managedServiceStopMutationRequestOptions(url) {
  return {
    method: 'POST',
    url,
    body: { confirm: true },
    failOnStatusCode: true,
    retryOnNetworkFailure: false,
    retryOnStatusCodeFailure: false,
    timeout: 120_000,
  }
}

export function managedServiceStopReadinessWorstCaseMs() {
  return (
    managedServiceStopReadinessAttempts * managedServiceStopRequestTimeoutMs +
    (managedServiceStopReadinessAttempts - 1) *
      managedServiceStopRetryDelayMs
  )
}

export function realBrowserQualificationWorstCaseMs() {
  const perEndpointMs =
    brokerMetadataReadinessAttempts * brokerMetadataRequestTimeoutMs +
    (brokerMetadataReadinessAttempts - 1) * brokerMetadataRetryDelayMs
  return (
    brokerMetadataReservedLifecycleMs +
    linkedRotationExecuteCount * linkedRotationResponseTimeoutMs +
    brokerMetadataEndpointCount * perEndpointMs
  )
}
