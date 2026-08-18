import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { KvSecretsEditor } from './kv-secrets-editor'

afterEach(() => {
  vi.unstubAllGlobals()
})

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function renderEditor() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <KvSecretsEditor overview={null} />
    </QueryClientProvider>
  )
}

describe('KV secrets editor', () => {
  it('browses keys without showing values until reveal', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/kv/metadata/') && url.includes('list=true')) {
        return jsonResponse({ data: { keys: ['apps/', 'db'] } })
      }
      if (url.includes('/kv/data/db') && (!init || init.method === 'GET')) {
        return jsonResponse({
          data: {
            data: { password: 'kv-sentinel-alpha' },
            metadata: {
              version: 1,
              created_time: '2026-08-18T00:00:00Z',
              deletion_time: '',
              destroyed: false,
            },
          },
        })
      }
      throw new Error(`Unexpected URL: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderEditor()
    expect(await screen.findByText('KV store')).toBeVisible()
    expect(await screen.findByRole('button', { name: 'db' })).toBeVisible()
    expect(
      screen.queryByDisplayValue('kv-sentinel-alpha')
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'db' }))
    await user.click(
      screen.getByRole('button', { name: /Reveal current version/i })
    )
    expect(await screen.findByDisplayValue('kv-sentinel-alpha')).toBeVisible()

    await user.click(screen.getByRole('button', { name: /Hide values/i }))
    expect(
      screen.queryByDisplayValue('kv-sentinel-alpha')
    ).not.toBeInTheDocument()
  })
})
