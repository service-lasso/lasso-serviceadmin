import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  buildServiceLogUrl,
  fetchDashboardService,
  fetchDashboardSummary,
  fetchServices,
  fetchTelemetryPreview,
  runDashboardAction,
} from './client'
import { favoritesMutationEnabled } from './stub'
import type { DashboardAction, DashboardService } from './types'

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
    },
    onError: (error, action) => {
      if (action !== 'reload-runtime' && action !== 'start-services') {
        return
      }

      const fallback =
        action === 'reload-runtime'
          ? 'Runtime reload failed. Check the Service Lasso runtime API logs.'
          : 'Start services failed. Check the Service Lasso runtime API logs.'

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
