import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  fieldRowVisibleInKeyFilter,
  filterKvPaths,
  KvSecretsEditor,
  KV_LOAD_FIELD_NAMES_REASON,
  kvPathBoxValue,
  matchesKvFilter,
  parseKvPathNavigation,
} from './kv-secrets-editor'

afterEach(() => {
  vi.unstubAllGlobals()
})

function auditReasonFromInit(init?: RequestInit): string {
  const headers = init?.headers
  if (
    !headers ||
    typeof headers !== 'object' ||
    headers instanceof Headers ||
    Array.isArray(headers)
  ) {
    return ''
  }
  const reason = headers['X-Secretsbroker-Audit-Reason']
  return typeof reason === 'string' ? reason : ''
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function renderEditor(pathFilter?: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <KvSecretsEditor overview={null} pathFilter={pathFilter} />
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

function generatedTokenBody() {
  return {
    data: {
      data: {
        value: 'kv-sentinel-alpha',
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

/**
 * Child keys for a list=true metadata URL. Longer prefixes are matched first.
 */
function listKeysForUrl(url: string): string[] {
  if (url.includes('/kv/metadata/services/node-sample-service')) {
    return ['sample.GENERATED_TOKEN']
  }
  if (url.includes('/kv/metadata/services')) {
    return ['node-sample-service/']
  }
  return ['apps/', 'db', 'services/']
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
        return jsonResponse({ data: { keys: listKeysForUrl(url) } })
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
      screen.queryByText(/OpenBao-compatible secrets/i)
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText('No values in the key list')
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/^local$/i)).not.toBeInTheDocument()
    expect(
      screen.queryByDisplayValue('kv-sentinel-alpha')
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'db' }))
    expect(await screen.findByDisplayValue('username')).toBeVisible()
    expect(screen.getByDisplayValue('password')).toBeVisible()
    expect(
      screen.queryByDisplayValue('kv-sentinel-alpha')
    ).not.toBeInTheDocument()
    expect(screen.queryByDisplayValue('db-user')).not.toBeInTheDocument()
    const hydrateCall = fetchMock.mock.calls.find((call) =>
      String(call[0]).includes('/kv/data/db')
    )
    expect(hydrateCall?.[1]?.headers).toEqual({
      'X-Secretsbroker-Audit-Reason': KV_LOAD_FIELD_NAMES_REASON,
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
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/kv/metadata/') && url.includes('list=true')) {
        return jsonResponse({ data: { keys: listKeysForUrl(url) } })
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
    await user.click(await screen.findByRole('button', { name: 'db' }))
    expect(await screen.findByDisplayValue('password')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Reveal password' }))
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
      fetchMock.mock.calls
        .filter((call) => String(call[0]).includes('/kv/data/db'))
        .map((call) => auditReasonFromInit(call[1]))
    ).toEqual([KV_LOAD_FIELD_NAMES_REASON])
  })

  it('shows version metadata without values', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/kv/metadata/') && url.includes('list=true')) {
        return jsonResponse({ data: { keys: listKeysForUrl(url) } })
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
    await user.click(await screen.findByRole('button', { name: 'db' }))
    expect(
      await screen.findByRole('button', { name: 'v2 deleted' })
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'v1' })).toBeVisible()
    expect(await screen.findByDisplayValue('username')).toBeVisible()
    expect(screen.getByDisplayValue('password')).toBeVisible()
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
        if (body.includes('kv-test-field')) {
          stored['kv-test-field'] = 'kv-sentinel-alpha'
        }
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
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/kv/metadata/') && url.includes('list=true')) {
        return jsonResponse({ data: { keys: listKeysForUrl(url) } })
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
    await user.click(await screen.findByRole('button', { name: 'db' }))
    const revealButton = await screen.findByRole('button', {
      name: 'Reveal password',
    })
    expect(revealButton).toHaveAttribute('aria-label', 'Reveal password')
    expect(revealButton.textContent?.trim() ?? '').toBe('')

    await user.click(revealButton)
    expect(await screen.findByRole('dialog')).toBeVisible()
    expect(
      screen.getByText(/Clicking outside this dialog cancels the reveal/i)
    ).toBeVisible()
    expect(revealOverlay().className).toMatch(/backdrop-blur/)

    await user.click(revealOverlay())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(
      fetchMock.mock.calls
        .filter((call) => String(call[0]).includes('/kv/data/db'))
        .map((call) => auditReasonFromInit(call[1]))
    ).toEqual([KV_LOAD_FIELD_NAMES_REASON])
  })

  it('keeps Source outside the KV store card and splits Path/Value panes', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/kv/metadata/') && url.includes('list=true')) {
        return jsonResponse({ data: { keys: [] } })
      }
      throw new Error(`Unexpected URL: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderEditor()
    expect(await screen.findByText('KV store')).toBeVisible()
    expect(screen.getByText('KV Path')).toBeVisible()
    expect(screen.getByText('KV Value')).toBeVisible()
    expect(
      screen.queryByText(/OpenBao-compatible secrets/i)
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText('No values in the key list')
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/^local$/i)).not.toBeInTheDocument()

    const chrome = screen.getByTestId('kv-source-chrome')
    const card = screen.getByTestId('kv-store-card')
    expect(within(chrome).getByLabelText('Source')).toBeVisible()
    expect(within(card).queryByLabelText('Source')).not.toBeInTheDocument()
    expect(card).toHaveClass('flex-1')
    expect(card).toHaveClass('min-h-0')
    expect(card).toHaveClass('overflow-hidden')

    const split = screen.getByTestId('kv-path-pane').parentElement
    expect(split).toHaveClass('grid-cols-2')
    expect(
      within(screen.getByTestId('kv-path-pane')).getByRole('textbox', {
        name: 'KV path',
      })
    ).toBeVisible()
    expect(
      within(screen.getByTestId('kv-value-pane')).queryByRole('textbox', {
        name: 'KV path',
      })
    ).not.toBeInTheDocument()

    const keyList = screen.getByTestId('kv-store-key-list')
    expect(keyList).toHaveClass('flex-1')
    expect(keyList).toHaveClass('min-h-0')
    expect(keyList).toHaveClass('overflow-auto')

    const fieldEditor = screen.getByTestId('kv-store-field-editor')
    expect(fieldEditor).toHaveClass('flex-1')
    expect(fieldEditor).toHaveClass('min-h-0')
    expect(fieldEditor).toHaveClass('overflow-auto')
    expect(fieldEditor).not.toHaveClass('max-h-[55%]')
  })

  it('filters listed paths in the KV Path pane', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/kv/metadata/') && url.includes('list=true')) {
        return jsonResponse({ data: { keys: ['apps/', 'db', 'cache'] } })
      }
      throw new Error(`Unexpected URL: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderEditor()
    expect(await screen.findByRole('button', { name: 'db' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'apps/' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'cache' })).toBeVisible()

    await user.type(screen.getByLabelText('Filter paths'), 'db')
    expect(screen.getByRole('button', { name: 'db' })).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'apps/' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'cache' })
    ).not.toBeInTheDocument()
  })

  it('filters field keys in the KV Value table', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/kv/metadata/') && url.includes('list=true')) {
        return jsonResponse({ data: { keys: ['db'] } })
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
    await user.click(await screen.findByRole('button', { name: 'db' }))
    expect(await screen.findByDisplayValue('username')).toBeVisible()
    expect(screen.getByDisplayValue('password')).toBeVisible()

    await user.type(screen.getByLabelText('Search keys'), 'pass')
    expect(screen.getByDisplayValue('password')).toBeVisible()
    expect(screen.queryByDisplayValue('username')).not.toBeInTheDocument()
    expect(screen.getByRole('table')).toBeVisible()
  })

  it('matches path and key filters without exposing values', () => {
    expect(matchesKvFilter('apps/', '')).toBe(true)
    expect(matchesKvFilter('db', 'DB')).toBe(true)
    expect(matchesKvFilter('apps/', 'db')).toBe(false)
    expect(filterKvPaths(['apps/', 'db', 'cache'], 'db')).toEqual(['db'])
    expect(fieldRowVisibleInKeyFilter('', 'pass')).toBe(true)
    expect(fieldRowVisibleInKeyFilter('password', 'pass')).toBe(true)
    expect(fieldRowVisibleInKeyFilter('username', 'pass')).toBe(false)
  })

  it('parses pasted KV paths into folder browse vs leaf select', () => {
    expect(
      parseKvPathNavigation(
        'services/node-sample-service/sample.GENERATED_TOKEN'
      )
    ).toEqual({
      prefix: 'services/node-sample-service',
      selectedPath: 'services/node-sample-service/sample.GENERATED_TOKEN',
      folder: false,
    })
    expect(parseKvPathNavigation('services/node-sample-service/')).toEqual({
      prefix: 'services/node-sample-service',
      selectedPath: '',
      folder: true,
    })
    expect(kvPathBoxValue('services/node-sample-service', '')).toBe(
      'services/node-sample-service/'
    )
    expect(
      kvPathBoxValue(
        'services/node-sample-service',
        'services/node-sample-service/sample.GENERATED_TOKEN'
      )
    ).toBe('services/node-sample-service/sample.GENERATED_TOKEN')
  })

  it('navigates when a path is pasted into KV Path and hydrates masked names', async () => {
    const user = userEvent.setup()
    const generatedPath = 'services/node-sample-service/sample.GENERATED_TOKEN'
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/kv/metadata/') && url.includes('list=true')) {
        return jsonResponse({ data: { keys: listKeysForUrl(url) } })
      }
      if (
        url.includes(`/kv/metadata/${generatedPath}`) &&
        !url.includes('list=true')
      ) {
        return jsonResponse(metadataBody())
      }
      if (
        url.includes(`/kv/data/${generatedPath}`) &&
        (!init?.method || init.method === 'GET')
      ) {
        return jsonResponse(generatedTokenBody())
      }
      throw new Error(`Unexpected URL: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderEditor()
    expect(
      await screen.findByRole('button', { name: 'services/' })
    ).toBeVisible()
    const pathBox = screen.getByRole('textbox', { name: 'KV path' })
    await user.click(pathBox)
    await user.paste(generatedPath)

    expect(await screen.findByDisplayValue('value')).toBeVisible()
    expect(
      screen.getByRole('button', { name: '/ node-sample-service' })
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'sample.GENERATED_TOKEN' })
    ).toBeVisible()
    expect(
      screen.queryByDisplayValue('kv-sentinel-alpha')
    ).not.toBeInTheDocument()
    expect(
      fetchMock.mock.calls
        .filter((call) => String(call[0]).includes('/kv/data/'))
        .map((call) => auditReasonFromInit(call[1]))
    ).toEqual([KV_LOAD_FIELD_NAMES_REASON])
  })

  it('seeds the path filter from the supplied service identity', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/kv/metadata/') && url.includes('list=true')) {
        return jsonResponse({
          data: {
            keys: ['apps/', 'db', 'services/@serviceadmin/'],
          },
        })
      }
      throw new Error(`Unexpected URL: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderEditor('@serviceadmin')

    expect(screen.getByLabelText('Filter paths')).toHaveValue('@serviceadmin')
    expect(
      await screen.findByRole('button', { name: 'services/@serviceadmin/' })
    ).toBeVisible()
    expect(screen.queryByRole('button', { name: 'db' })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'apps/' })
    ).not.toBeInTheDocument()
  })
})
