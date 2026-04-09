import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { serviceLassoApi } from './client'
import type { ServiceAction } from './types'

export const serviceLassoKeys = {
  runtime: ['service-lasso', 'runtime'] as const,
  services: ['service-lasso', 'services'] as const,
  service: (serviceId: string) =>
    ['service-lasso', 'services', serviceId] as const,
  dependencies: ['service-lasso', 'dependencies'] as const,
  network: ['service-lasso', 'network'] as const,
  installed: ['service-lasso', 'installed'] as const,
  settings: ['service-lasso', 'settings'] as const,
}

export const useRuntimeSummary = () =>
  useQuery({
    queryKey: serviceLassoKeys.runtime,
    queryFn: () => serviceLassoApi.getRuntimeSummary(),
  })

export const useServices = () =>
  useQuery({
    queryKey: serviceLassoKeys.services,
    queryFn: () => serviceLassoApi.getServices(),
  })

export const useServiceDetail = (serviceId: string) =>
  useQuery({
    queryKey: serviceLassoKeys.service(serviceId),
    queryFn: () => serviceLassoApi.getService(serviceId),
  })

export const useDependencyGraph = () =>
  useQuery({
    queryKey: serviceLassoKeys.dependencies,
    queryFn: () => serviceLassoApi.getDependencyGraph(),
  })

export const useNetworkBindings = () =>
  useQuery({
    queryKey: serviceLassoKeys.network,
    queryFn: () => serviceLassoApi.getNetworkBindings(),
  })

export const useInstalledRecords = () =>
  useQuery({
    queryKey: serviceLassoKeys.installed,
    queryFn: () => serviceLassoApi.getInstalledRecords(),
  })

export const useOperatorSettings = () =>
  useQuery({
    queryKey: serviceLassoKeys.settings,
    queryFn: () => serviceLassoApi.getOperatorSettings(),
  })

export const useRunServiceAction = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      serviceId,
      action,
    }: {
      serviceId: string
      action: ServiceAction
    }) => serviceLassoApi.runServiceAction(serviceId, action),
    onSuccess: (result) => {
      toast.success(result.message)
      void queryClient.invalidateQueries({
        queryKey: serviceLassoKeys.services,
      })
      if (result.serviceId) {
        void queryClient.invalidateQueries({
          queryKey: serviceLassoKeys.service(result.serviceId),
        })
      }
    },
  })
}

export const useRunRuntimeAction = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (action: ServiceAction) =>
      serviceLassoApi.runRuntimeAction(action),
    onSuccess: (result) => {
      toast.success(result.message)
      void queryClient.invalidateQueries({ queryKey: serviceLassoKeys.runtime })
      void queryClient.invalidateQueries({
        queryKey: serviceLassoKeys.services,
      })
    },
  })
}
