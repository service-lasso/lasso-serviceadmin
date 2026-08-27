import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ServiceLifecycleActionKind } from './types'

describe('runtime lifecycle mutation client', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_SERVICE_LASSO_ENABLE_STUB_DATA', 'false')
    vi.stubEnv('VITE_SERVICE_LASSO_API_BASE_URL', 'http://runtime.test')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('posts configure and reload through the generic lifecycle route', async () => {
    const fetchMock = vi.fn().mockImplementation(
      async () =>
        new Response(JSON.stringify({ outcome: 'applied' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
    )
    vi.stubGlobal('fetch', fetchMock)
    const { runServiceLifecycleAction } = await import('./stub')
    const actions: ServiceLifecycleActionKind[] = ['config', 'reload']

    for (const action of actions) {
      await runServiceLifecycleAction({
        action,
        serviceId: '@secretsbroker',
        confirm: action === 'reload',
      })
    }

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls).toEqual([
      [
        'http://runtime.test/api/services/%40secretsbroker/config',
        expect.objectContaining({
          body: JSON.stringify({ confirm: false }),
          method: 'POST',
        }),
      ],
      [
        'http://runtime.test/api/services/%40secretsbroker/reload',
        expect.objectContaining({
          body: JSON.stringify({ confirm: true }),
          method: 'POST',
        }),
      ],
    ])
  })

  it('fails once on a denied lifecycle response without retrying', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'permission_denied' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    vi.stubGlobal('fetch', fetchMock)
    const { runServiceLifecycleAction } = await import('./stub')

    await expect(
      runServiceLifecycleAction({
        action: 'reload',
        serviceId: '@secretsbroker',
        confirm: true,
      })
    ).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
