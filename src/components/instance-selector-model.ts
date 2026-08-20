import {
  fleetInstanceSummaries,
  fleetOverviewHasSecretMaterial,
} from '@/features/fleet-overview/fleet-overview'

const localInstance =
  fleetInstanceSummaries.find((instance) => instance.kind === 'local') ??
  fleetInstanceSummaries[0]

export const activeInstanceSelectorState = {
  label: 'Local',
  endpoint: '127.0.0.1:17700',
  instance: localInstance,
  remoteConnectState:
    'Setup needed: runtime instance registry is not available yet.',
}

export function instanceSelectorHasSecretMaterial() {
  return fleetOverviewHasSecretMaterial([activeInstanceSelectorState.instance])
}
