import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  acknowledgeFirstRunVaultKey,
  buildStubServiceLogUrl,
  favoritesMutationEnabled,
  fetchDashboardService,
  fetchDashboardSummary,
  fetchSecurityState,
  fetchFirstRunSetupState,
  fetchServiceSetup,
  fetchServices,
  runDashboardAction,
  runServiceRecoveryDoctorAction,
  runServiceSetupAction,
  runServiceUpdateAction,
} from './stub'
import type {
  DashboardAction,
  DashboardService,
  ServiceSecurityState,
  ServiceSetupRunResult,
  ServiceUpdateAction,
} from './types'

const dashboardQueryKey = ['service-lasso-dashboard']
const firstRunSetupQueryKey = ['service-lasso-first-run-setup']

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

export function useFirstRunSetupState() {
  return useQuery({
    queryKey: firstRunSetupQueryKey,
    queryFn: fetchFirstRunSetupState,
  })
}

export function useFirstRunSetupKeyAcknowledgement() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: acknowledgeFirstRunVaultKey,
    onSuccess: (result) => {
      queryClient.setQueryData(firstRunSetupQueryKey, result.setup)
      queryClient.invalidateQueries({ queryKey: dashboardQueryKey })
    },
  })
}

export function useDashboardService(serviceId: string) {
  return useQuery({
    queryKey: [...dashboardQueryKey, serviceId],
    queryFn: () => fetchDashboardService(serviceId),
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

export function getServiceLogStubUrl(
  serviceId: string,
  options?: {
    type?: 'default' | 'access' | 'error'
  }
) {
  return buildStubServiceLogUrl(serviceId, options)
}

export function useDashboardAction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (action: DashboardAction) => runDashboardAction(action),
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

export function useToggleFavorite() {
  const dashboardAction = useDashboardAction()

  return useMutation({
    mutationFn: async (serviceId: string) => {
      if (!favoritesMutationEnabled) {
        return null
      }

      return dashboardAction.mutateAsync({ kind: 'toggle-favorite', serviceId })
    },
  })
}

export function useFavoriteFeatureState() {
  return {
    enabled: favoritesMutationEnabled,
  }
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
