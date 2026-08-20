import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  applyBrokerBulkCampaign,
  applyBrokerLifecycleRestore,
  applyBrokerMigration,
  applyManagedSecretCreate,
  applyManagedSecretMutation,
  applySecretDecommission,
  clearBrokerLockout,
  createBrokerBulkCampaign,
  createBrokerLifecycleBackup,
  executeCoreSecretRotation,
  fetchBrokerEvents,
  fetchBrokerLifecycleBackups,
  fetchBrokerLifecycleStatus,
  fetchBrokerProviderStatus,
  fetchBrokerTelemetry,
  fetchBrokerBulkCampaignStatus,
  fetchCoreSecretRotationImpactPlan,
  fetchSecretsManagementState,
  previewBrokerLifecycleRestore,
  previewBrokerMigration,
  previewManagedSecretCreate,
  previewManagedSecretMutation,
  previewManagedSecretPolicy,
  previewSecretDecommission,
  previewSecretRotation,
  restoreSecretDecommission,
  revealManagedSecret,
  revalidateBrokerBulkCampaign,
  rotateBrokerLifecycleKey,
  runSecretRotationVersionAction,
  validateBrokerProviderConfiguration,
  verifyBrokerLifecycleBackup,
} from './broker-operator-client'
import {
  buildServiceLogUrl,
  fetchAuditEvents,
  fetchDashboardService,
  fetchDashboardSummary,
  fetchInbox,
  fetchInboxCounts,
  fetchFleetMetrics,
  fetchRuntimeInstanceHome,
  fetchNetworkHome,
  fetchServiceTelemetryPreview,
  fetchServices,
  fetchTelemetryPreview,
  hideInboxItem,
  markInboxItemsRead,
  markInboxRead,
  unhideInboxItem,
  runDashboardAction,
} from './client'
import { runtimeIdentityAuditContext, useRuntimeIdentity } from './runtime-auth'
import { isFavoritesFeatureEnabled } from './stub'
import type {
  AuditEventsFilters,
  BrokerBulkCampaignRequest,
  BrokerEventFilters,
  BrokerLifecycleOperationRequest,
  BrokerLockoutClearRequest,
  BrokerMigrationRequest,
  BrokerProviderValidationRequest,
  CoreSecretRotationExecutionRequest,
  DashboardAction,
  DashboardService,
  InboxQuery,
  SecretCreateRequest,
  SecretDecommissionRequest,
  SecretMutationRequest,
  SecretPolicyPreviewRequest,
  SecretRevealRequest,
  SecretRotationPreviewRequest,
  SecretRotationVersionRequest,
} from './types'

const dashboardQueryKey = ['service-lasso-dashboard']

export function useDashboardSummary() {
  return useQuery({
    queryKey: dashboardQueryKey,
    queryFn: fetchDashboardSummary,
  })
}

export function useServices() {
  return useQuery({
    queryKey: [...dashboardQueryKey, 'services'],
    queryFn: fetchServices,
  })
}

export function useTelemetryPreview() {
  return useQuery({
    queryKey: [...dashboardQueryKey, 'telemetry-preview'],
    queryFn: fetchTelemetryPreview,
  })
}

export function useServiceTelemetryPreview(serviceId: string) {
  return useQuery({
    queryKey: [...dashboardQueryKey, serviceId, 'telemetry-preview'],
    queryFn: () => fetchServiceTelemetryPreview(serviceId),
  })
}

export function useAuditEvents(filters: AuditEventsFilters = {}) {
  return useQuery({
    queryKey: [...dashboardQueryKey, 'audit-events', filters],
    queryFn: () => fetchAuditEvents(filters),
  })
}

const inboxQueryKey = [...dashboardQueryKey, 'inbox']
const inboxCountsQueryKey = [...dashboardQueryKey, 'inbox-counts']

/**
 * Loads durable operator Inbox messages for the Inbox page.
 */
export function useInbox(query: InboxQuery = {}) {
  return useQuery({
    queryKey: [...inboxQueryKey, query],
    queryFn: () => fetchInbox(query),
  })
}

/**
 * Loads unread Inbox counts for header and sidebar badges.
 */
export function useInboxCounts() {
  return useQuery({
    queryKey: inboxCountsQueryKey,
    queryFn: fetchInboxCounts,
    refetchInterval: 30_000,
  })
}

const fleetMetricsQueryKey = [...dashboardQueryKey, 'fleet-metrics']
const runtimeInstanceHomeQueryKey = [...dashboardQueryKey, 'runtime-instance']
const networkHomeQueryKey = [...dashboardQueryKey, 'network-home']

/**
 * Loads GET /api/metrics for crash and log-volume chips on Dashboard home.
 */
export function useFleetMetrics() {
  return useQuery({
    queryKey: fleetMetricsQueryKey,
    queryFn: fetchFleetMetrics,
    refetchInterval: 30_000,
  })
}

/**
 * Loads GET /api/runtime/instance for the generation-lane chip.
 */
export function useRuntimeInstanceHome() {
  return useQuery({
    queryKey: runtimeInstanceHomeQueryKey,
    queryFn: fetchRuntimeInstanceHome,
    refetchInterval: 30_000,
  })
}

/**
 * Loads GET /api/network for Traefik reserved-route counting on home.
 */
export function useNetworkHome() {
  return useQuery({
    queryKey: networkHomeQueryKey,
    queryFn: fetchNetworkHome,
    refetchInterval: 30_000,
  })
}

/**
 * Marks one Inbox item read and refreshes list plus badge counts.
 */
export function useMarkInboxRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (itemId: string) => markInboxRead(itemId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: inboxQueryKey })
      void queryClient.invalidateQueries({ queryKey: inboxCountsQueryKey })
    },
  })
}

/**
 * Marks many Inbox items read and refreshes list plus badge counts.
 */
export function useMarkInboxItemsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (itemIds: string[]) => markInboxItemsRead(itemIds),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: inboxQueryKey })
      void queryClient.invalidateQueries({ queryKey: inboxCountsQueryKey })
    },
  })
}

/**
 * Hides one Inbox item and refreshes list plus badge counts.
 */
export function useHideInboxItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (itemId: string) => hideInboxItem(itemId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: inboxQueryKey })
      void queryClient.invalidateQueries({ queryKey: inboxCountsQueryKey })
    },
  })
}

/**
 * Restores one hidden Inbox item and refreshes list plus badge counts.
 */
export function useUnhideInboxItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (itemId: string) => unhideInboxItem(itemId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: inboxQueryKey })
      void queryClient.invalidateQueries({ queryKey: inboxCountsQueryKey })
    },
  })
}

export function useDashboardService(serviceId: string) {
  return useQuery({
    queryKey: [...dashboardQueryKey, serviceId],
    queryFn: () => fetchDashboardService(serviceId),
  })
}

export function getServiceLogStubUrl(
  serviceId: string,
  options?: {
    type?: 'default' | 'access' | 'error'
  }
) {
  return buildServiceLogUrl(serviceId, options)
}

export function useDashboardAction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (action: DashboardAction) => runDashboardAction(action),
    onSuccess: (data, action) => {
      queryClient.setQueryData(dashboardQueryKey, data)

      const allServices = [
        ...data.favorites,
        ...data.others,
      ] satisfies DashboardService[]
      queryClient.setQueryData([...dashboardQueryKey, 'services'], allServices)

      for (const service of allServices) {
        queryClient.setQueryData([...dashboardQueryKey, service.id], service)
      }

      if (action === 'reload-runtime') {
        toast.success('Runtime reloaded and health data refreshed.')
      }

      if (action === 'start-services') {
        toast.success(
          'Start services request accepted. Services status refreshed.'
        )
      }

      if (typeof action === 'object' && action.kind === 'service-lifecycle') {
        const label = {
          start: 'Start service',
          stop: 'Stop service',
          restart: 'Restart service',
        }[action.action]

        toast.success(`${label} request accepted. Service status refreshed.`)
      }
    },
    onError: (error, action) => {
      const isLifecycleAction =
        typeof action === 'object' && action.kind === 'service-lifecycle'

      if (
        action !== 'reload-runtime' &&
        action !== 'start-services' &&
        !isLifecycleAction
      ) {
        return
      }

      const fallback =
        action === 'reload-runtime'
          ? 'Runtime reload failed. Check the Service Lasso runtime API logs.'
          : action === 'start-services'
            ? 'Start services failed. Check the Service Lasso runtime API logs.'
            : 'Service lifecycle action failed. Check the Service Lasso runtime API logs.'

      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : fallback

      toast.error(message)
    },
  })
}

export function useToggleFavorite() {
  const dashboardAction = useDashboardAction()

  return useMutation({
    mutationFn: async (serviceId: string) => {
      if (!isFavoritesFeatureEnabled()) {
        return null
      }

      return dashboardAction.mutateAsync({ kind: 'toggle-favorite', serviceId })
    },
  })
}

export function useFavoriteFeatureState() {
  return {
    enabled: isFavoritesFeatureEnabled(),
  }
}

const brokerProviderQueryKey = [
  ...dashboardQueryKey,
  'secrets-broker-providers',
]
const brokerLifecycleQueryKey = [
  ...dashboardQueryKey,
  'secrets-broker-lifecycle',
]
const brokerOperationsQueryKey = [
  ...dashboardQueryKey,
  'secrets-broker-operations',
]
export { runtimeIdentityQueryKey, useRuntimeIdentity } from './runtime-auth'

export function useSecretsManagement(search = '') {
  return useQuery({
    queryKey: [...dashboardQueryKey, 'secrets-management', search],
    queryFn: () => fetchSecretsManagementState(search),
  })
}

export function useBrokerProviderStatus() {
  return useQuery({
    queryKey: brokerProviderQueryKey,
    queryFn: fetchBrokerProviderStatus,
  })
}

export function useBrokerLifecycleStatus(enabled = true) {
  return useQuery({
    queryKey: brokerLifecycleQueryKey,
    queryFn: fetchBrokerLifecycleStatus,
    enabled,
  })
}

export function useBrokerLifecycleBackups(enabled = true) {
  return useQuery({
    queryKey: [...brokerLifecycleQueryKey, 'backups'],
    queryFn: fetchBrokerLifecycleBackups,
    enabled,
  })
}

export function useBrokerLifecycleBackupCreate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: BrokerLifecycleOperationRequest) =>
      createBrokerLifecycleBackup(request),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: brokerLifecycleQueryKey }),
  })
}

export function useBrokerLifecycleBackupVerify() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: BrokerLifecycleOperationRequest) =>
      verifyBrokerLifecycleBackup(request),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: brokerLifecycleQueryKey }),
  })
}

export function useBrokerLifecycleRestorePreview() {
  return useMutation({
    mutationFn: (request: BrokerLifecycleOperationRequest) =>
      previewBrokerLifecycleRestore(request),
  })
}

export function useBrokerLifecycleRestoreApply() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: BrokerLifecycleOperationRequest) =>
      applyBrokerLifecycleRestore(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: brokerLifecycleQueryKey })
      queryClient.invalidateQueries({
        queryKey: [...dashboardQueryKey, 'secrets-management'],
      })
    },
  })
}

export function useBrokerLifecycleKeyRotate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: BrokerLifecycleOperationRequest) =>
      rotateBrokerLifecycleKey(request),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: brokerLifecycleQueryKey }),
  })
}

export function useBrokerTelemetry(enabled = true) {
  return useQuery({
    queryKey: [...brokerOperationsQueryKey, 'telemetry'],
    queryFn: fetchBrokerTelemetry,
    enabled,
    refetchInterval: 30_000,
  })
}

export function useBrokerEvents(
  filters: BrokerEventFilters = {},
  enabled = true
) {
  return useQuery({
    queryKey: [...brokerOperationsQueryKey, 'events', filters],
    queryFn: () => fetchBrokerEvents(filters),
    enabled,
  })
}

export function useBrokerLockoutClear() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: BrokerLockoutClearRequest) =>
      clearBrokerLockout(request),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: brokerOperationsQueryKey }),
  })
}

export function useBrokerProviderValidation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: BrokerProviderValidationRequest) =>
      validateBrokerProviderConfiguration(request),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: brokerProviderQueryKey }),
  })
}

export function useBrokerMigrationPreview() {
  return useMutation({
    mutationFn: (request: BrokerMigrationRequest) =>
      previewBrokerMigration(request),
  })
}

export function useBrokerMigrationApply() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: BrokerMigrationRequest) =>
      applyBrokerMigration(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: brokerProviderQueryKey })
      queryClient.invalidateQueries({
        queryKey: [...dashboardQueryKey, 'secrets-management'],
      })
    },
  })
}

export function useBrokerBulkCampaignCreate() {
  return useMutation({
    mutationFn: (request: BrokerBulkCampaignRequest) =>
      createBrokerBulkCampaign(request),
  })
}

export function useBrokerBulkCampaignRevalidate() {
  return useMutation({
    mutationFn: (request: BrokerBulkCampaignRequest) =>
      revalidateBrokerBulkCampaign(request),
  })
}

export function useBrokerBulkCampaignStatus() {
  return useMutation({
    mutationFn: (request: BrokerBulkCampaignRequest) =>
      fetchBrokerBulkCampaignStatus(request),
  })
}

export function useBrokerBulkCampaignApply() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: BrokerBulkCampaignRequest) =>
      applyBrokerBulkCampaign(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: brokerProviderQueryKey })
      queryClient.invalidateQueries({
        queryKey: [...dashboardQueryKey, 'secrets-management'],
      })
    },
  })
}

export function useSecretReveal() {
  const identity = useRuntimeIdentity()
  return useMutation({
    mutationFn: (request: SecretRevealRequest) => {
      if (!identity.data) {
        throw new Error('A trusted runtime identity is required for reveal.')
      }
      return revealManagedSecret(
        request,
        runtimeIdentityAuditContext(identity.data)
      )
    },
  })
}

export function useSecretCreatePreview() {
  return useMutation({
    mutationFn: (request: SecretCreateRequest) =>
      previewManagedSecretCreate(request),
  })
}

export function useSecretCreateApply() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: SecretCreateRequest) =>
      applyManagedSecretCreate(request),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: [...dashboardQueryKey, 'secrets-management'],
      }),
  })
}

export function useSecretMutationPreview() {
  return useMutation({
    mutationFn: (request: SecretMutationRequest) =>
      previewManagedSecretMutation(request),
  })
}

export function useSecretMutationApply() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: SecretMutationRequest) =>
      applyManagedSecretMutation(request),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: [...dashboardQueryKey, 'secrets-management'],
      }),
  })
}

export function useSecretPolicyPreview() {
  return useMutation({
    mutationFn: (request: SecretPolicyPreviewRequest) =>
      previewManagedSecretPolicy(request),
  })
}

export function useSecretDecommissionPreview() {
  return useMutation({
    mutationFn: (request: SecretDecommissionRequest) =>
      previewSecretDecommission(request),
  })
}

export function useSecretDecommissionApply() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: SecretDecommissionRequest) =>
      applySecretDecommission(request),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: [...dashboardQueryKey, 'secrets-management'],
      }),
  })
}

export function useSecretDecommissionRestore() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: SecretDecommissionRequest) =>
      restoreSecretDecommission(request),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: [...dashboardQueryKey, 'secrets-management'],
      }),
  })
}

export function useSecretRotationPreview() {
  return useMutation({
    mutationFn: (request: SecretRotationPreviewRequest) =>
      previewSecretRotation(request),
  })
}

export function useSecretRotationVersionAction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: SecretRotationVersionRequest) =>
      runSecretRotationVersionAction(request),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: [...dashboardQueryKey, 'secrets-management'],
      }),
  })
}

export function useCoreSecretRotationImpactPlan() {
  return useMutation({
    mutationFn: (ref: string) => fetchCoreSecretRotationImpactPlan(ref),
  })
}

export function useCoreSecretRotationExecute() {
  return useMutation({
    mutationFn: (request: CoreSecretRotationExecutionRequest) =>
      executeCoreSecretRotation(request),
  })
}
