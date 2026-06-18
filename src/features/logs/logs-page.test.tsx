import { renderRoute } from '@/test/render-route'
import { screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

describe('logs page operator states', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('explains an empty current log while still showing runtime overview entries', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const parsed = new URL(url, 'http://localhost')

        if (parsed.pathname === '/api/services/log-info') {
          return new Response(
            JSON.stringify({
              serviceId: '@serviceadmin',
              type: 'default',
              path: 'C:\\runtime\\@serviceadmin\\service.log',
              availableTypes: ['default'],
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        }

        if (parsed.pathname === '/api/logs/read') {
          return new Response(
            JSON.stringify({
              serviceId: '@serviceadmin',
              type: 'default',
              path: 'C:\\runtime\\@serviceadmin\\service.log',
              totalLines: 0,
              start: 0,
              end: 0,
              hasMore: false,
              nextBefore: 0,
              limit: 100,
              lines: [],
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        }

        if (parsed.pathname === '/api/services/%40serviceadmin/logs') {
          return new Response(
            JSON.stringify({
              logs: {
                serviceId: '@serviceadmin',
                logPath: 'C:\\runtime\\@serviceadmin\\service.log',
                stdoutPath: 'C:\\runtime\\@serviceadmin\\stdout.log',
                stderrPath: 'C:\\runtime\\@serviceadmin\\stderr.log',
                entries: [
                  {
                    level: 'stdout',
                    message:
                      '@serviceadmin listening on http://0.0.0.0:17700 token=hidden-value',
                  },
                ],
                archives: [],
                retention: { maxArchives: 3 },
              },
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        }

        return new Response('not found', { status: 404 })
      })
    )

    await renderRoute('/logs?service=@serviceadmin')

    await waitFor(() => {
      expect(screen.getByText('Runtime log overview')).toBeVisible()
    })

    expect(screen.getByText('No current log entries yet')).toBeVisible()
    expect(
      screen.getByText(/@serviceadmin listening on http:\/\/0\.0\.0\.0:17700/)
    ).toBeVisible()
    expect(screen.getByText(/token=\[redacted\]/)).toBeVisible()
  })

  it('exposes Logs actions from the services table', async () => {
    await renderRoute('/services')

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Services' })).toBeVisible()
    })

    await waitFor(() => {
      expect(screen.getByText('Service Admin UI')).toBeVisible()
    })

    const logLinks = screen
      .getAllByRole('link', { name: /^Logs$/i })
      .map((link) => link.getAttribute('href'))

    expect(logLinks).toContain('/logs?service=%40serviceadmin')
  })
})
