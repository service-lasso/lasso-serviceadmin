import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  buildServiceLogUrl,
  fetchAuditEvents,
  fetchDashboardService,
  fetchDashboardSummary,
  fetchFleetMetrics,
  fetchInbox,
  fetchInboxCounts,
  fetchNetworkHome,
  fetchRuntimeInstanceHome,
  fetchServiceTelemetryPreview,
  fetchServices,
  fetchTelemetryPreview,
  hideInboxItem,
  markInboxItemsRead,
  markInboxRead,
  runDashboardAction,
  unhideInboxItem,
} from './client'
import {
  fetchRuntimeIdentity,
  runtimeIdentityAuditContext,
  type RuntimeIdentity,
} from './runtime-auth'
import {
  applyBrokerBulkCampaign,
  applyBrokerLifecycleRestore,
  applyBrokerMigration,
  applyManagedSecretCreate,
  applyManagedSecretMutation,
  applySecretDecommission,
  bootstrapFirstRunSetup,
  clearBrokerLockout,
  createBrokerBulkCampaign,
  createBrokerLifecycleBackup,
  executeCoreSecretRotation,
  fetchBrokerBulkCampaignStatus,
  fetchBrokerEvents,
  fetchBrokerLifecycleBackups,
  fetchBrokerLifecycleStatus,
  fetchBrokerProviderStatus,
  fetchBrokerTelemetry,
  fetchCoreSecretRotationExecutionState,
  fetchCoreSecretRotationImpactPlan,
  fetchFirstRunSetupState,
  fetchInboxSummary,
  fetchMcpState,
  fetchSecretAccessAssignments,
  fetchSecretsManagementState,
  fetchSecurityState,
  fetchServiceSetup,
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
  runInboxMessageAction,
  runSecretRotationVersionAction,
  runServiceLifecycleAction,
  runServiceRecoveryDoctorAction,
  runServiceSetupAction,
  runServiceUpdateAction,
  isFavoritesFeatureEnabled,
  validateBrokerProviderConfiguration,
  verifyBrokerLifecycleBackup,
} from './stub'
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
  InboxMessageActionKind,
  InboxQuery,
  McpState,
  SecretAccessAssignmentAudit,
  SecretCreateRequest,
  SecretDecommissionRequest,
  SecretMutationRequest,
  SecretPolicyPreviewRequest,
  SecretRevealRequest,
  SecretRotationPreviewRequest,
  SecretRotationVersionRequest,
  ServiceLifecycleActionKind,
  ServiceSecurityState,
  ServiceSetupRunResult,
  ServiceUpdateAction,
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

const inboxQueryKey = ['service-lasso-inbox']

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
    refetchInterval: 30000,
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
    refetchInterval: 30000,
  })
}

/**
 * Loads GET /api/runtime/instance for the generation-lane chip.
 */
export function useRuntimeInstanceHome() {
  return useQuery({
    queryKey: runtimeInstanceHomeQueryKey,
    queryFn: fetchRuntimeInstanceHome,
    refetchInterval: 30000,
  })
}

/**
 * Loads GET /api/network for Traefik reserved-route counting on home.
 */
export function useNetworkHome() {
  return useQuery({
    queryKey: networkHomeQueryKey,
    queryFn: fetchNetworkHome,
    refetchInterval: 30000,
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
    staleTime: 5 * 60 * 1000,
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
    refetchInterval: 30000,
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
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...dashboardQueryKey, 'secrets-management'],
      })
    },
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
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...dashboardQueryKey, 'secrets-management'],
      })
    },
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
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...dashboardQueryKey, 'secrets-management'],
      })
    },
  })
}

export function useSecretDecommissionRestore() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: SecretDecommissionRequest) =>
      restoreSecretDecommission(request),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...dashboardQueryKey, 'secrets-management'],
      })
    },
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
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...dashboardQueryKey, 'secrets-management'],
      })
    },
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

const firstRunSetupQueryKey = ['service-lasso-first-run-setup']

export const runtimeIdentityQueryKey = ['service-lasso-runtime-identity']

export function useRuntimeIdentity() {
  return useQuery<RuntimeIdentity>({
    queryKey: runtimeIdentityQueryKey,
    queryFn: fetchRuntimeIdentity,
    retry: false,
    staleTime: 5000,
  })
}

export function useInboxSummary() {
  return useQuery({
    queryKey: inboxQueryKey,
    queryFn: fetchInboxSummary,
  })
}

export function useInboxMessageAction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (options: {
      messageId: string
      action: InboxMessageActionKind
    }) => runInboxMessageAction(options),
    onSuccess: (result) => {
      queryClient.setQueryData(inboxQueryKey, result.inbox)
    },
  })
}

export function useFirstRunSetupState() {
  return useQuery({
    queryKey: firstRunSetupQueryKey,
    queryFn: fetchFirstRunSetupState,
    refetchInterval: (query) =>
      query.state.data?.state === 'setup_in_progress' ? 1000 : false,
  })
}

export function useFirstRunSetupBootstrap() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (setupToken?: string) => bootstrapFirstRunSetup(setupToken),
    onSuccess: (result) => {
      queryClient.setQueryData(firstRunSetupQueryKey, result.setup)
      queryClient.invalidateQueries({ queryKey: dashboardQueryKey })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: firstRunSetupQueryKey })
    },
  })
}

export function useServiceSetup(serviceId: string) {
  return useQuery({
    queryKey: [...dashboardQueryKey, serviceId, 'setup'],
    queryFn: () => fetchServiceSetup(serviceId),
  })
}

export function useSecurityState() {
  return useQuery<ServiceSecurityState>({
    queryKey: [...dashboardQueryKey, 'security'],
    queryFn: fetchSecurityState,
  })
}

export function useSecretAccessAssignments() {
  return useQuery<SecretAccessAssignmentAudit>({
    queryKey: [...dashboardQueryKey, 'secret-access-assignments'],
    queryFn: fetchSecretAccessAssignments,
  })
}

export function useMcpState() {
  return useQuery<McpState>({
    queryKey: [...dashboardQueryKey, 'mcp'],
    queryFn: fetchMcpState,
  })
}

export function useCoreSecretRotationPlan() {
  return useMutation({
    mutationFn: (ref: string) => fetchCoreSecretRotationImpactPlan(ref),
  })
}

export function useCoreSecretRotationOperation(
  operationId: string | undefined,
  enabled = true
) {
  return useQuery({
    queryKey: [...dashboardQueryKey, 'secret-rotation-operation', operationId],
    queryFn: () => fetchCoreSecretRotationExecutionState(operationId!),
    enabled: enabled && Boolean(operationId),
    retry: false,
    refetchInterval: (query) =>
      query.state.data?.outcome === 'in_progress' ? 2000 : false,
  })
}

export function useCoreSecretRotationExecution() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: CoreSecretRotationExecutionRequest) =>
      executeCoreSecretRotation(request),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...dashboardQueryKey, 'secrets-management'],
      })
      queryClient.invalidateQueries({
        queryKey: dashboardQueryKey,
        predicate: (query) => query.queryKey[1] !== 'secrets-broker-providers',
      })
    },
  })
}

export function useServiceUpdateAction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (options: {
      action: ServiceUpdateAction
      serviceId: string
      force?: boolean
    }) => runServiceUpdateAction(options),
    onSuccess: (data) => {
      queryClient.setQueryData(dashboardQueryKey, data)
      const allServices = [
        ...data.favorites,
        ...data.others,
      ] satisfies DashboardService[]
      queryClient.setQueryData([...dashboardQueryKey, 'services'], allServices)
      for (const service of allServices) {
        queryClient.setQueryData([...dashboardQueryKey, service.id], service)
      }
    },
  })
}

export function useServiceLifecycleAction() {
  const queryClient = useQueryClient()
  const refreshLifecycleViews = async (serviceId: string) => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: dashboardQueryKey,
        exact: true,
      }),
      queryClient.invalidateQueries({
        queryKey: [...dashboardQueryKey, 'services'],
        exact: true,
      }),
      queryClient.invalidateQueries({
        queryKey: [...dashboardQueryKey, serviceId],
        exact: true,
      }),
    ])
  }
  return useMutation({
    mutationFn: (options: {
      action: ServiceLifecycleActionKind
      serviceId: string
      confirm?: boolean
    }) => runServiceLifecycleAction(options),
    onSettled: async (_result, _error, options) =>
      refreshLifecycleViews(options.serviceId),
  })
}

export function useServiceSetupAction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (options: {
      serviceId: string
      stepId?: string
      force?: boolean
    }) => runServiceSetupAction(options),
    onSuccess: (result: ServiceSetupRunResult) => {
      queryClient.setQueryData(
        [...dashboardQueryKey, result.serviceId, 'setup'],
        result.setup
      )
      queryClient.setQueryData<DashboardService | null>(
        [...dashboardQueryKey, result.serviceId],
        (service) => (service ? { ...service, setup: result.setup } : service)
      )
      queryClient.setQueryData<DashboardService[]>(
        [...dashboardQueryKey, 'services'],
        (services) =>
          services?.map((service) =>
            service.id === result.serviceId
              ? { ...service, setup: result.setup }
              : service
          )
      )
      queryClient.invalidateQueries({ queryKey: dashboardQueryKey })
    },
  })
}

export function useServiceRecoveryDoctorAction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (serviceId: string) =>
      runServiceRecoveryDoctorAction(serviceId),
    onSuccess: (result) => {
      const patchService = (service: DashboardService) =>
        service.id === result.serviceId
          ? { ...service, recovery: result.recovery }
          : service
      queryClient.setQueryData<DashboardService[]>(
        [...dashboardQueryKey, 'services'],
        (services) => services?.map(patchService)
      )
      queryClient.setQueryData<DashboardService | null>(
        [...dashboardQueryKey, result.serviceId],
        (service) => (service ? patchService(service) : service)
      )
      queryClient.invalidateQueries({ queryKey: dashboardQueryKey })
    },
  })
}
