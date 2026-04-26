import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  buildStubServiceLogUrl,
  favoritesMutationEnabled,
  fetchDashboardService,
  fetchDashboardSummary,
  fetchServices,
  runDashboardAction,
  runServiceRecoveryDoctorAction,
  runServiceUpdateAction,
} from './stub'
import type {
  DashboardAction,
  DashboardService,
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

export function useServiceRecoveryDoctorAction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (serviceId: string) => runServiceRecoveryDoctorAction(serviceId),
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
