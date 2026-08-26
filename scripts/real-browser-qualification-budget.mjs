export const cypressQualificationTimeoutMs = 12 * 60_000
export const brokerMetadataReadinessAttempts = 5
export const brokerMetadataRequestTimeoutMs = 20_000
export const brokerMetadataRetryDelayMs = 1_000
export const brokerMetadataEndpointCount = 2
export const brokerMetadataReservedLifecycleMs = 8 * 60_000

export function brokerMetadataRequestOptions(url) {
  return {
    method: 'GET',
    url,
    failOnStatusCode: false,
    retryOnNetworkFailure: false,
    timeout: brokerMetadataRequestTimeoutMs,
  }
}

export function brokerMetadataQualificationWorstCaseMs() {
  const perEndpointMs =
    brokerMetadataReadinessAttempts * brokerMetadataRequestTimeoutMs +
    (brokerMetadataReadinessAttempts - 1) * brokerMetadataRetryDelayMs
  return (
    brokerMetadataReservedLifecycleMs +
    brokerMetadataEndpointCount * perEndpointMs
  )
}
