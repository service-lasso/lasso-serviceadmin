import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

const unsafeAuditSentinels = [
  /ACTUAL_SECRET/i,
  /RAW_SECRET/i,
  /BEGIN PRIVATE KEY/i,
  /PASSWORD=/i,
  /CLIENT_SECRET=/i,
  /REFRESH_TOKEN=/i,
  /BOT_TOKEN=/i,
  /authorization/i,
  /raw request body/i,
  /raw config payload/i,
  /raw terminal\/stdin input/i,
  /raw log line content/i,
]

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function expectUnsafeAuditSentinelsHidden(container: HTMLElement) {
  for (const sentinel of unsafeAuditSentinels) {
    expect(container).not.toHaveTextContent(sentinel)
  }
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
      rawRequestBody: 'raw request body PASSWORD=ACTUAL_SECRET',
      rawConfigPayload: 'raw config payload CLIENT_SECRET=RAW_SECRET',
      rawTerminalInput: 'raw terminal/stdin input REFRESH_TOKEN=secret',
      rawLogLineContent: 'raw log line content BOT_TOKEN=secret',
      authorization: 'Bearer ACTUAL_SECRET',
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
    expectUnsafeAuditSentinelsHidden(document.body)
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
    expect(screen.queryByText(/runtime reload/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Fixture preview/i)).not.toBeInTheDocument()
    expectUnsafeAuditSentinelsHidden(document.body)
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
    expect(screen.queryByText(/runtime reload/i)).not.toBeInTheDocument()
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

  it('keeps audit table search and source filters scoped to live rows', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/audit?limit=100') {
        return jsonResponse({
          events: [
            {
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
              chainStatus: 'valid',
            },
            {
              id: 'audit-live-secret-rotation',
              timestamp: '2026-07-10T23:25:00.000Z',
              source: 'secretsbroker',
              action: 'secret.rotated',
              actor: 'service-admin-web',
              subject: 'secret://services/example/ref',
              serviceId: '@secretsbroker',
              method: 'POST',
              routeTemplate: '/api/secrets/:secretId/rotate',
              outcome: 'success',
              statusCode: 200,
              summary: 'Rotation completed with safe audit metadata.',
              reason: 'allow: audited rotation metadata only',
              chainStatus: 'valid',
            },
          ],
          pagination: { limit: 100, nextCursor: null, total: 2 },
        })
      }

      throw new Error(`Unexpected URL: ${url}`)
    })

    await renderLiveAudit(fetchMock)

    await waitFor(() => {
      expect(screen.getAllByText('Live runtime audit')[0]).toBeVisible()
    })
    expect(screen.getByText(/service config save/i)).toBeVisible()
    expect(screen.getByText(/secret rotated/i)).toBeVisible()

    fireEvent.change(screen.getByPlaceholderText('Search audit events...'), {
      target: { value: 'config' },
    })

    expect(screen.getByText(/service config save/i)).toBeVisible()
    expect(screen.queryByText(/secret rotated/i)).not.toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Search audit events...'), {
      target: { value: '' },
    })
    await user.click(screen.getAllByRole('button', { name: /^Source$/i })[0])
    const secretsBrokerOptions = screen.getAllByText('Secrets Broker')
    await user.click(secretsBrokerOptions[secretsBrokerOptions.length - 1])

    expect(screen.queryByText(/service config save/i)).not.toBeInTheDocument()
    expect(screen.getByText(/secret rotated/i)).toBeVisible()
  })
})
