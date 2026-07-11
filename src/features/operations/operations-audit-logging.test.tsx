import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function renderLiveAudit(fetchMock: ReturnType<typeof vi.fn>) {
  vi.resetModules()
  vi.unstubAllEnvs()
  vi.stubEnv('VITE_SERVICE_LASSO_ENABLE_STUB_DATA', 'false')
  vi.stubGlobal('fetch', fetchMock)

  const { renderRoute } = await import('@/test/render-route')
  return renderRoute('/operations/audit-logging', { stubData: false })
}

describe('Operations Audit page', () => {
  it('renders live runtime audit rows from the Service Lasso audit hook', async () => {
    const auditEvent = {
      id: 'audit-live-config-save',
      timestamp: '2026-07-10T23:20:00.000Z',
      source: 'runtime',
      action: 'service.config.save',
      actor: 'service-admin-web',
      subject: 'server.json',
      serviceId: '@serviceadmin',
      method: 'PUT',
      routeTemplate: '/api/services/:serviceId/config',
      outcome: 'success',
      statusCode: 200,
      summary: 'Config saved with metadata-only audit event.',
      reason: 'operator requested config update',
      correlationId: 'correlation-live',
      relatedRevisionId: 'revision-live',
      chainId: 'service:@serviceadmin',
      sequence: 4,
      previousHash: 'previous-hash',
      eventHash: 'event-hash',
      chainStatus: 'valid',
    }
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/audit?limit=100') {
        return jsonResponse({
          events: [auditEvent],
          pagination: { limit: 100, nextCursor: null, total: 1 },
        })
      }

      throw new Error(`Unexpected URL: ${url}`)
    })

    await renderLiveAudit(fetchMock)

    await waitFor(() => {
      expect(screen.getAllByText('Live runtime audit')[0]).toBeVisible()
    })
    expect(screen.getByText(/service config save/i)).toBeVisible()
    expect(screen.getByText(/service-admin-web/i)).toBeVisible()
    expect(
      screen.getByText(/Config saved with metadata-only audit event/i)
    ).toBeVisible()
    expect(screen.queryByText(/stub audit fixture/i)).not.toBeInTheDocument()
  })

  it('shows an honest unavailable state when the runtime audit API is missing', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/audit?limit=100') {
        return jsonResponse({ detail: 'not found' }, { status: 404 })
      }

      throw new Error(`Unexpected URL: ${url}`)
    })

    await renderLiveAudit(fetchMock)

    await waitFor(() => {
      expect(screen.getByText('Audit unavailable')).toBeVisible()
    })
    expect(
      screen.getByText(/Service Lasso runtime audit API is not available/i)
    ).toBeVisible()
    expect(
      screen.getByText(/Runtime audit events are unavailable/i)
    ).toBeVisible()
  })

  it('shows the empty audit state for a healthy runtime with no events', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/audit?limit=100') {
        return jsonResponse({
          events: [],
          pagination: { limit: 100, nextCursor: null, total: 0 },
        })
      }

      throw new Error(`Unexpected URL: ${url}`)
    })

    await renderLiveAudit(fetchMock)

    await waitFor(() => {
      expect(screen.getByText('Empty audit')).toBeVisible()
    })
    expect(
      screen.getAllByText('No durable audit events have been recorded yet.')[0]
    ).toBeVisible()
  })

  it('labels fixture rows only when explicit stub mode is enabled', async () => {
    vi.resetModules()
    vi.unstubAllEnvs()
    vi.stubEnv('VITE_SERVICE_LASSO_ENABLE_STUB_DATA', 'true')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { renderRoute } = await import('@/test/render-route')
    await renderRoute('/operations/audit-logging', { stubData: true })

    await waitFor(() => {
      expect(screen.getAllByText('Fixture preview')[0]).toBeVisible()
    })
    expect(
      screen.getByText(/explicit Service Admin stub mode is enabled/i)
    ).toBeVisible()
    expect(screen.getAllByText(/runtime reload/i)[0]).toBeVisible()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
