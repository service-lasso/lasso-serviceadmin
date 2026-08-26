import { describe, expect, it } from 'vitest'
import { normalizeRuntimeServiceAction } from './stub'

describe('runtime lifecycle action contract', () => {
  it.each([
    ['config', 'Configure service', 'service:configure', false],
    ['reload', 'Reload service', 'service:reload', true],
  ] as const)(
    'normalizes the authoritative %s lifecycle decision',
    (kind, label, permission, requiresConfirmation) => {
      expect(
        normalizeRuntimeServiceAction({
          id: kind,
          label,
          kind,
          permission,
          granted: true,
          requiresConfirmation,
          unavailableReason: null,
          actor: 'local-root',
          mode: 'local-root',
        })
      ).toEqual({
        id: kind,
        label,
        kind,
        permission: {
          key: permission,
          allowed: true,
          actor: 'local-root',
          mode: 'local-root',
          requiresConfirmation,
          confirmationLabel: requiresConfirmation ? label : undefined,
          reason: requiresConfirmation
            ? 'The runtime requires explicit confirmation.'
            : undefined,
        },
      })
    }
  )

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

  it.each([
    {
      permission: 'service:restart',
      granted: true,
      requiresConfirmation: true,
      unavailableReason: null,
    },
    {
      permission: 'service:restart',
      granted: true,
      requiresConfirmation: 'yes',
      unavailableReason: null,
      actor: 'local-root',
      mode: 'local-root',
    },
    {
      permission: 'service:restart',
      granted: true,
      requiresConfirmation: true,
      unavailableReason: 'permission_not_granted',
      actor: 'local-root',
      mode: 'local-root',
    },
    {
      permission: 'service:restart',
      granted: false,
      requiresConfirmation: true,
      unavailableReason: null,
      actor: 'local-root',
      mode: 'local-root',
    },
    {
      permission: 'workspace:read',
      granted: true,
      requiresConfirmation: true,
      unavailableReason: null,
      actor: 'local-root',
      mode: 'local-root',
    },
    {
      permission: 'service:restart',
      granted: true,
      requiresConfirmation: false,
      unavailableReason: null,
      actor: 'local-root',
      mode: 'local-root',
    },
  ])('fails closed for malformed or inconsistent decisions', (decision) => {
    expect(
      normalizeRuntimeServiceAction({
        id: 'restart',
        label: 'Restart service',
        kind: 'restart',
        ...decision,
      })?.permission
    ).toEqual({
      allowed: false,
      reason:
        'The runtime did not provide an authoritative permission decision.',
    })
  })

  it('drops unknown lifecycle action kinds instead of making them executable', () => {
    expect(
      normalizeRuntimeServiceAction({
        id: 'destroy',
        label: 'Destroy service',
        kind: 'destroy',
        permission: 'service:destroy',
        granted: true,
        requiresConfirmation: false,
        unavailableReason: null,
        actor: 'local-root',
        mode: 'local-root',
      })
    ).toBeNull()
  })

  it('drops unsafe action identifiers without breaking dashboard normalization', () => {
    expect(
      normalizeRuntimeServiceAction({
        id: '<script>',
        label: 'Restart service',
        kind: 'restart',
        permission: 'service:restart',
        granted: true,
        requiresConfirmation: true,
        unavailableReason: null,
        actor: 'local-root',
        mode: 'local-root',
      })
    ).toBeNull()
  })

  it('fails closed for mismatched non-lifecycle authority', () => {
    expect(
      normalizeRuntimeServiceAction({
        id: 'open_config',
        label: 'Open config',
        kind: 'open_config',
        permission: 'workspace:read',
        granted: true,
        requiresConfirmation: false,
        unavailableReason: null,
        actor: 'local-root',
        mode: 'local-root',
      })?.permission
    ).toEqual({
      allowed: false,
      reason:
        'The runtime did not provide an authoritative permission decision.',
    })
  })

  it('drops actions whose runtime-projected id does not match their kind', () => {
    expect(
      normalizeRuntimeServiceAction({
        id: 'restart-copy',
        label: 'Restart service',
        kind: 'restart',
        permission: 'service:restart',
        granted: true,
        requiresConfirmation: true,
        unavailableReason: null,
        actor: 'local-root',
        mode: 'local-root',
      })
    ).toBeNull()
  })
})
