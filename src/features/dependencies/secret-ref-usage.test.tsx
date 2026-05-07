import { renderRoute } from '@/test/render-route'
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  buildSecretRefUsageRows,
  groupSecretRefUsageByRef,
  groupSecretRefUsageByService,
} from './secret-ref-usage'

describe('Secrets Broker reference usage view', () => {
  it('renders service-centric and ref-centric usage without secret values', async () => {
    await renderRoute('/dependencies')

    expect(
      await screen.findByText(/Secrets Broker reference usage/i)
    ).toBeVisible()
    expect(screen.getByText(/Values hidden/i)).toBeVisible()
    expect(screen.getByText(/By service\/workflow/i)).toBeVisible()
    expect(screen.getByText(/By broker namespace\/ref/i)).toBeVisible()
    expect(
      screen.getAllByText(/openclaw\/anthropic\/api_key/i)[0]
    ).toBeVisible()
    expect(screen.getAllByText(/postgres\.ADMIN_PASSWORD/i)[0]).toBeVisible()
    expect(screen.getAllByText(/telegram\.bot_token/i)[0]).toBeVisible()
    expect(screen.getAllByText(/Denied/i)[0]).toBeVisible()
    expect(screen.getAllByText(/Missing/i)[0]).toBeVisible()
    expect(screen.getAllByText(/Open diagnostics\/logs/i)[0]).toBeVisible()
    expect(screen.queryByText(/supersecret/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/plaintext secret/i)).not.toBeInTheDocument()
  })

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
