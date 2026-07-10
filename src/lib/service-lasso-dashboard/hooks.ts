import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  buildServiceLogUrl,
  fetchAuditEvents,
  fetchDashboardService,
  fetchDashboardSummary,
  fetchServiceTelemetryPreview,
  fetchServices,
  fetchTelemetryPreview,
  runDashboardAction,
} from './client'
import { favoritesMutationEnabled } from './stub'
import type {
  AuditEventsFilters,
  DashboardAction,
  DashboardService,
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
