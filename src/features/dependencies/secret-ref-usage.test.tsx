import { describe, expect, it } from 'vitest'
import {
  buildSecretRefUsageRows,
  groupSecretRefUsageByRef,
  groupSecretRefUsageByService,
} from './secret-ref-usage'

describe('Secrets Broker reference usage view', () => {
  it('groups the same safe metadata by service and by ref', () => {
    const rows = buildSecretRefUsageRows([
      {
        id: '@serviceadmin',
        name: 'Service Admin UI',
        status: 'running',
        favorite: false,
        note: '',
        links: [],
        installed: true,
        role: 'Operator dashboard',
        runtimeHealth: {
          state: 'running',
          health: 'healthy',
          uptime: '1m',
          lastCheckAt: '2026-05-07T17:40:00Z',
          summary: 'ok',
        },
        endpoints: [],
        metadata: {
          serviceType: 'ui-admin',
          runtime: 'node',
          version: 'test',
          build: 'test',
        },
        dependencies: [],
        dependents: [],
        environmentVariables: [
          {
            key: 'OPENCLAW_ANTHROPIC_API_KEY',
            value: 'secret://openclaw/anthropic/api_key',
            scope: 'service',
            secret: true,
            source: '@secretsbroker/openclaw/service-lasso',
          },
        ],
        recentLogs: [],
        actions: [],
      },
    ])

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      ref: 'openclaw/anthropic/api_key',
      serviceId: '@serviceadmin',
      outcome: 'resolved',
    })
    expect(groupSecretRefUsageByService(rows)[0].serviceName).toBe(
      'Service Admin UI'
    )
    expect(groupSecretRefUsageByRef(rows)[0].namespace).toBe(
      'openclaw/anthropic'
    )
  })
})
