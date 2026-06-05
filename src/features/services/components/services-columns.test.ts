import { describe, expect, it } from 'vitest'
import type { DashboardService } from '@/lib/service-lasso-dashboard/types'
import { hasLifecycleAction } from './services-columns'

function service(overrides: Partial<DashboardService> = {}): DashboardService {
  return {
    id: 'echo-service',
    name: 'Echo Service',
    status: 'running',
    favorite: false,
    note: 'ready',
    links: [],
    installed: true,
    role: 'service',
    runtimeHealth: {
      state: 'running',
      health: 'healthy',
      uptime: '1m',
      lastCheckAt: '2026-06-05T00:00:00.000Z',
      summary: 'ready',
    },
    endpoints: [],
    metadata: {
      serviceType: 'app',
      runtime: 'direct',
      version: '0.1.0',
      build: 'runtime/server.js',
    },
    dependencies: [],
    dependents: [],
    environmentVariables: [],
    recentLogs: [],
    actions: [
      { id: 'start', label: 'Start service', kind: 'start' },
      { id: 'stop', label: 'Stop service', kind: 'stop' },
      { id: 'restart', label: 'Restart service', kind: 'restart' },
    ],
    ...overrides,
  }
}

describe('services table lifecycle controls', () => {
  it('allows lifecycle actions for daemon services when the runtime advertises them', () => {
    const daemon = service()

    expect(hasLifecycleAction(daemon, 'start')).toBe(true)
    expect(hasLifecycleAction(daemon, 'stop')).toBe(true)
    expect(hasLifecycleAction(daemon, 'restart')).toBe(true)
  })

  it('hides daemon lifecycle actions for provider services even if stale runtime data advertises them', () => {
    const provider = service({
      id: '@archive',
      name: 'Archive Runtime',
      status: 'available',
      role: 'provider',
      metadata: {
        serviceType: 'provider',
        runtime: 'direct',
        version: '0.1.0',
        build: 'manifest-only',
      },
    })

    expect(hasLifecycleAction(provider, 'start')).toBe(false)
    expect(hasLifecycleAction(provider, 'stop')).toBe(false)
    expect(hasLifecycleAction(provider, 'restart')).toBe(false)
  })
})
