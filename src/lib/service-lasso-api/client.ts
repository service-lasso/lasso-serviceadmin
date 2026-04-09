import axios from 'axios'
import type {
  DependencyGraph,
  InstalledRecord,
  NetworkBinding,
  OperatorSetting,
  RuntimeSummary,
  ServiceAction,
  ServiceActionResult,
  ServiceDetail,
  ServiceSummary,
} from './types'

const api = axios.create({
  baseURL: import.meta.env.VITE_SERVICE_LASSO_API_BASE_URL ?? '/api',
  timeout: 10_000,
})

export const serviceLassoApi = {
  async getHealth(): Promise<{ ok: boolean; source: string }> {
    const response = await api.get('/health')
    return response.data
  },

  async getRuntimeSummary(): Promise<RuntimeSummary> {
    const response = await api.get('/runtime/status')
    return response.data
  },

  async getServices(): Promise<ServiceSummary[]> {
    const response = await api.get('/services')
    return response.data
  },

  async getService(serviceId: string): Promise<ServiceDetail> {
    const response = await api.get(`/services/${encodeURIComponent(serviceId)}`)
    return response.data
  },

  async runServiceAction(
    serviceId: string,
    action: ServiceAction
  ): Promise<ServiceActionResult> {
    const response = await api.post(
      `/services/${encodeURIComponent(serviceId)}/actions/${encodeURIComponent(action)}`
    )
    return response.data
  },

  async runRuntimeAction(action: ServiceAction): Promise<ServiceActionResult> {
    const response = await api.post(
      `/runtime/actions/${encodeURIComponent(action)}`
    )
    return response.data
  },

  async getDependencyGraph(): Promise<DependencyGraph> {
    const response = await api.get('/dependencies')
    return response.data
  },

  async getNetworkBindings(): Promise<NetworkBinding[]> {
    const response = await api.get('/network')
    return response.data
  },

  async getInstalledRecords(): Promise<InstalledRecord[]> {
    const response = await api.get('/installed')
    return response.data
  },

  async getOperatorSettings(): Promise<OperatorSetting[]> {
    const response = await api.get('/settings')
    return response.data
  },
}
