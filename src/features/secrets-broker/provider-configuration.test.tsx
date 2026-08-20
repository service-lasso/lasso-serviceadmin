import { renderRoute } from '@/test/render-route'
import {
  assertNoSecretMaterial,
  collectBrowserLeakSurfaces,
} from '@/test/secret-leak-harness'
import { canonicalBrokerOverviewResponse } from '@/test/secrets-broker-contract'
import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  configurationFixturesHaveSecretMaterial,
  migrationPlans,
  providerConfigurations,
} from './provider-configuration'

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('Secrets Broker provider configuration fixtures', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('keeps provider and migration fixtures free of secret material', () => {
    expect(configurationFixturesHaveSecretMaterial()).toBe(false)
    expect(providerConfigurations.healthy.credentialHandle).toContain('ref:')
    expect(migrationPlans['dry-run-partial'].items).toHaveLength(3)
    expect(
      migrationPlans['apply-ready'].applyEnabled,
      'apply-ready requires UI confirmation and audit reason before button enables'
    ).toBe(true)
  })

  it('shows explicit stub-mode provider configuration metadata safely', async () => {
    await renderRoute('/secrets-broker/configuration')

    expect(
      await screen.findByRole('region', {
        name: /Live provider configuration metadata/i,
      })
    ).toBeVisible()
    expect(screen.getByText(/stub fixture metadata/i)).toBeVisible()
    expect(
      screen.getAllByText(/Local encrypted store/i).length
    ).toBeGreaterThan(0)
    expect(screen.getAllByText(/Provider config/i).length).toBeGreaterThan(0)
    expect(screen.queryByText(/provider-token/i)).not.toBeInTheDocument()
    assertNoSecretMaterial(collectBrowserLeakSurfaces())
  })

  it('renders runtime provider configuration metadata without provider credentials', async () => {
    vi.stubEnv('VITE_SERVICE_LASSO_API_BASE_URL', 'http://runtime.test')
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/api/dashboard/services/%40secretsbroker')) {
          return jsonResponse({
            service: {
              id: '@secretsbroker',
              name: 'Secrets Broker',
              status: 'running',
              favorite: false,
              note: 'Runtime metadata only.',
              installed: true,
              role: 'Secret metadata broker',
              links: [],
              runtimeHealth: {
                state: 'running',
                health: 'healthy',
                uptime: '2m',
                lastCheckAt: '2026-07-05T08:25:00.000Z',
                summary: 'Healthy',
              },
              endpoints: [],
              metadata: {
                serviceType: 'core',
                runtime: 'service-lasso',
                version: 'test',
                build: 'test',
              },
              dependencies: [],
              dependents: [],
              environmentVariables: [],
              recentLogs: [],
              actions: [],
            },
          })
        }

        const contractResponse = canonicalBrokerOverviewResponse(url, {
          description: 'Live provider configuration metadata available.',
          source: {
            sourceId: 'vault-prod',
            kind: 'vault',
            displayName: 'Vault production',
            state: 'auth_required',
            outcome: 'source_auth_required',
            nextAction: 'reconnect_source',
          },
        })
        if (contractResponse) return contractResponse

        throw new Error(`Unexpected URL: ${url}`)
      })
    )

    await renderRoute('/secrets-broker/configuration', { stubData: false })

    expect(
      await screen.findByRole('region', {
        name: /Live provider configuration metadata/i,
      })
    ).toBeVisible()
    expect(
      await screen.findByText(/Live provider configuration metadata available/i)
    ).toBeVisible()
    expect(screen.getByText(/runtime metadata/i)).toBeVisible()
    expect(await screen.findByText(/Vault production/i)).toBeVisible()
    expect(screen.getAllByText(/auth-required/i).length).toBeGreaterThan(0)
    expect(
      screen.queryByText(/provider-token-must-not-render/i)
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(/client-secret-must-not-render/i)
    ).not.toBeInTheDocument()
    assertNoSecretMaterial(collectBrowserLeakSurfaces())
  })
})
