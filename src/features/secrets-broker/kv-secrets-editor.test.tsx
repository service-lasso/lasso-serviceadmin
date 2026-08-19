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

function metadataBody() {
  return {
    data: {
      current_version: 1,
      created_time: '2026-08-18T00:00:00Z',
      updated_time: '2026-08-18T00:00:00Z',
      versions: {
        '1': {
          created_time: '2026-08-18T00:00:00Z',
          deletion_time: '',
          destroyed: false,
        },
      },
    },
  }
}

function secretBody() {
  return {
    data: {
      data: {
        username: 'db-user',
        password: 'kv-sentinel-alpha',
      },
      metadata: {
        version: 1,
        created_time: '2026-08-18T00:00:00Z',
        deletion_time: '',
        destroyed: false,
      },
    },
  }
}

async function confirmAuditedReveal(
  user: ReturnType<typeof userEvent.setup>,
  reason: string
) {
  expect(await screen.findByRole('dialog')).toBeVisible()
  await user.type(screen.getByLabelText('Audit reason'), reason)
  await user.click(screen.getByLabelText('Confirm this controlled reveal'))
  await user.click(screen.getByRole('button', { name: 'Request reveal' }))
}

function revealOverlay(): HTMLElement {
  const overlay = document.querySelector('[data-slot="dialog-overlay"]')
  if (!(overlay instanceof HTMLElement)) {
    throw new Error('Reveal dialog overlay was not found.')
  }
  return overlay
}

describe('KV secrets editor', () => {
  it('reveals one field at a time after an audited confirm', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/kv/metadata/') && url.includes('list=true')) {
        return jsonResponse({ data: { keys: ['apps/', 'db'] } })
      }
      if (url.includes('/kv/metadata/db') && !url.includes('list=true')) {
        return jsonResponse(metadataBody())
      }
      if (
        url.includes('/kv/data/db') &&
        (!init?.method || init.method === 'GET')
      ) {
        return jsonResponse(secretBody())
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
    await user.click(screen.getByRole('button', { name: 'Load fields' }))
    await confirmAuditedReveal(user, 'incident review for db credentials')

    expect(await screen.findByDisplayValue('username')).toBeVisible()
    expect(screen.getByDisplayValue('password')).toBeVisible()
    expect(
      screen.queryByDisplayValue('kv-sentinel-alpha')
    ).not.toBeInTheDocument()
    expect(screen.queryByDisplayValue('db-user')).not.toBeInTheDocument()
    const firstDataCall = fetchMock.mock.calls.find((call) =>
      String(call[0]).includes('/kv/data/db')
    )
    expect(firstDataCall?.[1]?.headers).toEqual({
      'X-Secretsbroker-Audit-Reason': 'incident review for db credentials',
    })

    await user.click(screen.getByRole('button', { name: 'Reveal password' }))
    await confirmAuditedReveal(user, 'need password for local restore')
    expect(await screen.findByDisplayValue('kv-sentinel-alpha')).toBeVisible()
    expect(screen.queryByDisplayValue('db-user')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reveal username' }))
    await confirmAuditedReveal(user, 'need username for local restore')
    expect(await screen.findByDisplayValue('db-user')).toBeVisible()
    expect(
      screen.queryByDisplayValue('kv-sentinel-alpha')
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Hide username' }))
    expect(screen.queryByDisplayValue('db-user')).not.toBeInTheDocument()
    expect(
      screen.queryByDisplayValue('kv-sentinel-alpha')
    ).not.toBeInTheDocument()
  })

  it('rejects empty or secret-like audit reasons', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/kv/metadata/') && url.includes('list=true')) {
        return jsonResponse({ data: { keys: ['db'] } })
      }
      if (url.includes('/kv/metadata/db') && !url.includes('list=true')) {
        return jsonResponse(metadataBody())
      }
      throw new Error(`Unexpected URL: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderEditor()
    await user.click(await screen.findByRole('button', { name: 'db' }))
    await user.click(screen.getByRole('button', { name: 'Load fields' }))
    await user.click(screen.getByRole('button', { name: 'Request reveal' }))
    expect(
      await screen.findByText('Enter an audit reason before revealing.')
    ).toBeVisible()

    await user.type(
      screen.getByLabelText('Audit reason'),
      'password=SuperSecret1234'
    )
    await user.click(screen.getByLabelText('Confirm this controlled reveal'))
    await user.click(screen.getByRole('button', { name: 'Request reveal' }))
    expect(
      await screen.findByText('Audit reason cannot contain secret material.')
    ).toBeVisible()
    expect(
      fetchMock.mock.calls.some((call) =>
        String(call[0]).includes('/kv/data/db')
      )
    ).toBe(false)
  })

  it('shows version metadata without values', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/kv/metadata/') && url.includes('list=true')) {
        return jsonResponse({ data: { keys: ['db'] } })
      }
      if (url.includes('/kv/metadata/db') && !url.includes('list=true')) {
        return jsonResponse({
          data: {
            current_version: 2,
            created_time: '2026-08-18T00:00:00Z',
            updated_time: '2026-08-18T00:00:02Z',
            versions: {
              '1': {
                created_time: '2026-08-18T00:00:00Z',
                deletion_time: '',
                destroyed: false,
              },
              '2': {
                created_time: '2026-08-18T00:00:02Z',
                deletion_time: '2026-08-18T00:00:03Z',
                destroyed: false,
              },
            },
          },
        })
      }
      throw new Error(`Unexpected URL: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderEditor()
    await user.click(await screen.findByRole('button', { name: 'db' }))
    expect(
      await screen.findByRole('button', { name: 'v2 deleted' })
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'v1' })).toBeVisible()
    expect(
      screen.queryByDisplayValue('kv-sentinel-alpha')
    ).not.toBeInTheDocument()
  })

  it('keeps a newly added field name visible after save', async () => {
    const user = userEvent.setup()
    const stored: Record<string, string> = {
      username: 'db-user',
      password: 'kv-sentinel-alpha',
    }
    let version = 1
    const patchedBodies: string[] = []
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      if (url.includes('/kv/metadata/') && url.includes('list=true')) {
        return jsonResponse({ data: { keys: ['db'] } })
      }
      if (url.includes('/kv/metadata/db') && !url.includes('list=true')) {
        return jsonResponse({
          data: {
            current_version: version,
            created_time: '2026-08-18T00:00:00Z',
            updated_time: '2026-08-18T00:00:00Z',
            versions: {
              '1': {
                created_time: '2026-08-18T00:00:00Z',
                deletion_time: '',
                destroyed: false,
              },
              ...(version >= 2
                ? {
                    '2': {
                      created_time: '2026-08-18T00:00:02Z',
                      deletion_time: '',
                      destroyed: false,
                    },
                  }
                : {}),
            },
          },
        })
      }
      if (url.includes('/kv/data/db') && method === 'PATCH') {
        const body = typeof init?.body === 'string' ? init.body : ''
        patchedBodies.push(body)
        version += 1
        return jsonResponse({
          data: {
            version,
            created_time: '2026-08-18T00:00:02Z',
            deletion_time: '',
            destroyed: false,
          },
        })
      }
      if (
        url.includes('/kv/data/db') &&
        (!init?.method || init.method === 'GET')
      ) {
        return jsonResponse({
          data: {
            data: stored,
            metadata: {
              version,
              created_time: '2026-08-18T00:00:00Z',
              deletion_time: '',
              destroyed: false,
            },
          },
        })
      }
      throw new Error(`Unexpected URL: ${url} ${method}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderEditor()
    await user.click(await screen.findByRole('button', { name: 'db' }))
    await user.click(screen.getByRole('button', { name: 'Load fields' }))
    await confirmAuditedReveal(user, 'incident review for db credentials')
    expect(await screen.findByDisplayValue('username')).toBeVisible()
    expect(screen.getByDisplayValue('password')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Add field' }))
    await user.type(screen.getByLabelText('Field 3 name'), 'kv-test-field')
    await user.type(screen.getByLabelText('Field 3 value'), 'kv-sentinel-alpha')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Saved version 2.')).toBeVisible()
    expect(screen.getByDisplayValue('username')).toBeVisible()
    expect(screen.getByDisplayValue('password')).toBeVisible()
    expect(screen.getByDisplayValue('kv-test-field')).toBeVisible()
    expect(
      screen.queryByDisplayValue('kv-sentinel-alpha')
    ).not.toBeInTheDocument()
    expect(patchedBodies).toHaveLength(1)
    expect(patchedBodies[0]).toContain('kv-test-field')
    expect(patchedBodies[0]).not.toContain('username')
    expect(screen.queryByDisplayValue('value')).not.toBeInTheDocument()
  })

  it('opens an icon-only reveal modal and cancels on overlay click', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/kv/metadata/') && url.includes('list=true')) {
        return jsonResponse({ data: { keys: ['db'] } })
      }
      if (url.includes('/kv/metadata/db') && !url.includes('list=true')) {
        return jsonResponse(metadataBody())
      }
      throw new Error(`Unexpected URL: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderEditor()
    await user.click(await screen.findByRole('button', { name: 'db' }))
    const loadButton = screen.getByRole('button', { name: 'Load fields' })
    expect(loadButton).toHaveAttribute('aria-label', 'Load fields')
    expect(loadButton.textContent?.trim() ?? '').toBe('')

    await user.click(loadButton)
    expect(await screen.findByRole('dialog')).toBeVisible()
    expect(
      screen.getByText(/Clicking outside this dialog cancels the reveal/i)
    ).toBeVisible()
    expect(revealOverlay().className).toMatch(/backdrop-blur/)

    await user.click(revealOverlay())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(
      fetchMock.mock.calls.some((call) =>
        String(call[0]).includes('/kv/data/db')
      )
    ).toBe(false)
  })

  it('fills remaining height and scrolls the key list internally', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/kv/metadata/') && url.includes('list=true')) {
        return jsonResponse({ data: { keys: [] } })
      }
      throw new Error(`Unexpected URL: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderEditor()
    expect(await screen.findByText('KV store')).toBeVisible()

    const card = screen.getByTestId('kv-store-card')
    expect(card).toHaveClass('flex-1')
    expect(card).toHaveClass('min-h-0')
    expect(card).toHaveClass('overflow-hidden')

    const keyList = screen.getByTestId('kv-store-key-list')
    expect(keyList).toHaveClass('flex-1')
    expect(keyList).toHaveClass('min-h-0')
    expect(keyList).toHaveClass('overflow-auto')

    const fieldEditor = screen.getByTestId('kv-store-field-editor')
    expect(fieldEditor).toHaveClass('overflow-auto')
    expect(fieldEditor).toHaveClass('max-h-[55%]')
  })
})
