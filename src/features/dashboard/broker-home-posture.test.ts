import { describe, expect, it } from 'vitest'
import type {
  DashboardService,
  DashboardSummary,
} from '@/lib/service-lasso-dashboard/types'
import {
  brokerReadyLabel,
  deriveBrokerReadyState,
  findSecretsBrokerService,
  formatBrokerLockoutCount,
} from './broker-home-posture'

function brokerService(
  overrides: Partial<DashboardService> = {}
): DashboardService {
  return {
    id: '@secretsbroker',
    name: 'Secrets Broker',
    status: 'running',
    favorite: false,
    note: 'Local encrypted KV',
    links: [],
    installed: true,
    role: 'secrets-broker',
    runtimeHealth: {
      state: 'running',
      health: 'healthy',
      uptime: '1h',
      lastCheckAt: '2026-08-19T10:26:00.000Z',
      summary: 'Healthy',
    },
    endpoints: [],
    metadata: {
      serviceType: 'core',
      runtime: 'node',
      version: 'test',
      build: 'test',
    },
    dependencies: [],
    dependents: [],
    environmentVariables: [],
    recentLogs: [],
    actions: [],
    ...overrides,
  }
}

function summaryWith(
  services: DashboardService[],
  problemServices: DashboardService[] = []
): DashboardSummary {
  return {
    runtime: {
      status: 'healthy',
      lastReloadedAt: '2026-08-19T10:26:00.000Z',
      warningCount: 0,
    },
    servicesTotal: services.length,
    servicesRunning: services.filter((service) => service.status === 'running')
      .length,
    servicesStopped: 0,
    servicesDegraded: 0,
    networkExposureCount: 0,
    installedCount: services.length,
    favorites: [],
    others: services,
    warnings: [],
    problemServices,
  }
}

describe('broker home posture', () => {
  it('finds @secretsbroker from dashboard lists without duplicating problem tiles', () => {
    const broker = brokerService()
    const found = findSecretsBrokerService(summaryWith([broker], [broker]))

    expect(found?.id).toBe('@secretsbroker')
    expect(found?.runtimeHealth.health).toBe('healthy')
  })

  it('treats a missing broker service as unavailable', () => {
    expect(findSecretsBrokerService(summaryWith([]))).toBeNull()
    expect(deriveBrokerReadyState(null)).toBe('unavailable')
    expect(brokerReadyLabel('unavailable')).toBe('Unavailable')
  })

  it('maps running healthy to Ready and degraded or stopped to operator labels', () => {
    expect(deriveBrokerReadyState(brokerService())).toBe('ready')
    expect(brokerReadyLabel('ready')).toBe('Ready')
    expect(
      deriveBrokerReadyState(
        brokerService({
          status: 'degraded',
          runtimeHealth: {
            state: 'degraded',
            health: 'warning',
            uptime: '1h',
            lastCheckAt: '2026-08-19T10:26:00.000Z',
            summary: 'Degraded',
          },
        })
      )
    ).toBe('degraded')
    expect(brokerReadyLabel('degraded')).toBe('Degraded')
    expect(
      deriveBrokerReadyState(
        brokerService({
          status: 'stopped',
          runtimeHealth: {
            state: 'stopped',
            health: 'critical',
            uptime: '0m',
            lastCheckAt: '2026-08-19T10:26:00.000Z',
            summary: 'Stopped',
          },
        })
      )
    ).toBe('unavailable')
  })

  it('formats lockout counts as integers and fails closed when telemetry is missing', () => {
    expect(formatBrokerLockoutCount(0)).toBe('0')
    expect(formatBrokerLockoutCount(3)).toBe('3')
    expect(formatBrokerLockoutCount(null)).toBe('—')
    expect(formatBrokerLockoutCount(-1)).toBe('—')
    expect(formatBrokerLockoutCount(1.5)).toBe('—')
  })
})
