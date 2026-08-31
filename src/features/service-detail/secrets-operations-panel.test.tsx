import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SecretsBrokerOperationsPanel } from './secrets-operations-panel'

const controls = vi.hoisted(() => ({
  clear: vi.fn(),
  eventFilters: vi.fn(),
  telemetryRefetch: vi.fn(),
  eventsRefetch: vi.fn(),
}))

vi.mock('@/lib/service-lasso-dashboard/hooks', () => ({
  useRuntimeIdentity: () => ({ data: { permissions: ['*'] } }),
  useBrokerTelemetry: () => ({
    data: {
      serviceId: '@secretsbroker',
      apiVersion: 'v1',
      outcome: 'ready',
      generatedAt: '2026-08-14T00:00:00Z',
      counters: {
        activeLockouts: 2,
        localApiAuthFailures: 3,
        operations: [],
        policyDecisions: [],
        providerStates: [],
        sourceStates: [],
        auditRecords: [
          { auditStatus: 'audit_recorded', outcome: 'ready', count: 7 },
          { auditStatus: 'audit_recorded', outcome: 'denied', count: 2 },
        ],
      },
      safety: { lowCardinalityLabels: true, valueMaterialIncluded: false },
    },
    isError: false,
    isFetching: false,
    refetch: controls.telemetryRefetch,
  }),
  useBrokerEvents: (filters: unknown) => {
    controls.eventFilters(filters)
    return {
      data: {
        serviceId: '@secretsbroker',
        apiVersion: 'v1',
        outcome: 'ready',
        generatedAt: '2026-08-14T00:00:00Z',
        limit: 25,
        nextCursor: '1',
        events: [
          {
            id: 'event-safe-1',
            ts: '2026-08-14T00:00:00Z',
            family: 'auth_failure',
            severity: 'warning',
            operation: 'local_api_auth',
            serviceId: '@secretsbroker',
            outcome: 'denied',
          },
          {
            id: 'event-lockout-1',
            ts: '2026-08-14T00:01:00Z',
            family: 'lockout_started',
            severity: 'warning',
            operation: 'local_api_auth',
            outcome: 'locked',
            lockoutScope: 'local_api:pipe-safe',
            retryAfterSeconds: 30,
          },
        ],
        safety: {
          metadataOnly: true,
          rawRefIncluded: false,
          valueMaterialIncluded: false,
        },
      },
      isError: false,
      isLoading: false,
      isFetching: false,
      refetch: controls.eventsRefetch,
    }
  },
  useBrokerLockoutClear: () => ({
    isPending: false,
    mutateAsync: controls.clear,
  }),
  useSecretAccessAssignments: () => ({
    isError: false,
    data: {
      grants: [
        {
          id: 'grant-1',
          serviceId: '@serviceadmin',
          workspace: 'local',
          namespace: 'services/@serviceadmin/runtime',
          scope: 'service',
          refs: ['services/@serviceadmin/runtime/SESSION_SIGNING_KEY'],
          namespaceWide: false,
          operations: ['resolve'],
          purpose: 'runtime signing',
        },
      ],
    },
  }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:operational-export')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
  controls.clear.mockResolvedValue({
    serviceId: '@secretsbroker',
    apiVersion: 'v1',
    operation: 'lockout_clear',
    outcome: 'cleared',
    cleared: true,
    lockoutScope: 'local_api:\\\\.\\pipe\\service-lasso-secretsbroker-safe',
    auditStatus: 'audit_recorded',
  })
})

describe('Secrets Broker operational controls', () => {
  it('shows safe counters and events, supports bounded filters, and clears an exact audited lockout', async () => {
    const user = userEvent.setup()
    render(<SecretsBrokerOperationsPanel />)

    expect(screen.getByText('2')).toBeVisible()
    expect(screen.getByText('3')).toBeVisible()
    expect(screen.getByText('9')).toBeVisible()
    expect(screen.getByText(/Audit recorded/i)).toBeVisible()
    expect(screen.getByText('local_api:pipe-safe')).toBeVisible()
    expect(screen.getByText(/Retry window 30 seconds/i)).toBeVisible()
    expect(screen.getAllByText('@serviceadmin').length).toBeGreaterThan(0)
    expect(screen.getByText('services/@serviceadmin/runtime')).toBeVisible()

    await user.type(screen.getByLabelText('Service'), '@secretsbroker')
    await user.type(screen.getByLabelText('Provider'), 'local')
    await user.type(screen.getByLabelText('Operation'), 'local_api_auth')
    await user.type(screen.getByLabelText('Outcome'), 'denied')
    await waitFor(() => {
      expect(controls.eventFilters).toHaveBeenCalledWith(
        expect.objectContaining({
          serviceId: '@secretsbroker',
          providerId: 'local',
          operation: 'local_api_auth',
          outcome: 'denied',
        })
      )
    })

    await user.click(screen.getByRole('button', { name: /Export metadata/i }))
    expect(
      await screen.findByText(/Metadata-only operational export downloaded/i)
    ).toBeVisible()

    await user.selectOptions(screen.getByLabelText('Event severity'), 'warning')
    await user.selectOptions(
      screen.getByLabelText('Event family'),
      'auth_failure'
    )
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => {
      expect(controls.eventFilters).toHaveBeenLastCalledWith(
        expect.objectContaining({
          severity: 'warning',
          family: 'auth_failure',
          limit: 25,
          cursor: '1',
        })
      )
    })

    await user.type(
      screen.getByLabelText('Exact lockout scope'),
      'local_api:\\\\.\\pipe\\service-lasso-secretsbroker-safe'
    )
    await user.type(
      screen.getByLabelText('Audit reason'),
      'operator verified identity recovery'
    )
    await user.click(
      screen.getByLabelText('Confirm this exact audited lockout clear')
    )
    await user.click(
      screen.getByRole('button', { name: 'Clear exact lockout' })
    )

    await waitFor(() => {
      expect(controls.clear).toHaveBeenCalledWith({
        scope: 'local_api:\\\\.\\pipe\\service-lasso-secretsbroker-safe',
        reason: 'operator verified identity recovery',
      })
    })
    expect(await screen.findByText(/was cleared and audited/i)).toBeVisible()
  })
})
