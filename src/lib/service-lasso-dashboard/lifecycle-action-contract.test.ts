import { describe, expect, it } from 'vitest'
import { normalizeRuntimeServiceAction } from './stub'

describe('runtime lifecycle action contract', () => {
  it('uses the runtime permission and confirmation decision', () => {
    expect(
      normalizeRuntimeServiceAction({
        id: 'restart',
        label: 'Restart service',
        kind: 'restart',
        permission: 'service:restart',
        granted: true,
        requiresConfirmation: true,
        unavailableReason: null,
        actor: 'local-root',
        mode: 'local-root',
      })
    ).toEqual({
      id: 'restart',
      label: 'Restart service',
      kind: 'restart',
      permission: {
        key: 'service:restart',
        allowed: true,
        actor: 'local-root',
        mode: 'local-root',
        requiresConfirmation: true,
        confirmationLabel: 'Restart service',
        reason: 'The runtime requires explicit confirmation.',
      },
    })
  })

  it('fails closed when permission metadata is absent and withholds unsafe labels', () => {
    expect(
      normalizeRuntimeServiceAction({
        id: 'start',
        label: 'Start service',
        kind: 'start',
      })?.permission
    ).toMatchObject({ allowed: false })

    expect(
      normalizeRuntimeServiceAction({
        id: 'restart',
        label: 'token=do-not-render',
        kind: 'restart',
        permission: 'service:restart',
        granted: true,
        requiresConfirmation: true,
      })?.label
    ).toBe('[unsafe metadata withheld]')
  })
})
