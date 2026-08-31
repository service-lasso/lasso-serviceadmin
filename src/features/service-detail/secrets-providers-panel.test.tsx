import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  buildProviderActionResult,
  gatedProviderActionResult,
} from '@/lib/service-lasso-dashboard/broker-provider-actions'
import type {
  BrokerOperationCapability,
  BrokerProviderRowActionRequest,
  BrokerProviderStatus,
} from '@/lib/service-lasso-dashboard/types'
import { SecretsBrokerProvidersPanel } from './secrets-providers-panel'

const mutateRowAction = vi.fn()

function operation(
  path: string,
  maturity: BrokerOperationCapability['maturity'],
  extras: Partial<BrokerOperationCapability> = {}
): BrokerOperationCapability {
  return {
    operationId: path.replace(/[^a-z0-9]+/gi, '_'),
    method: path.includes('config/') ? 'POST' : 'GET',
    path,
    maturity,
    classification: maturity === 'read-only' ? 'read' : 'mutation',
    authenticationRequired: true,
    policyRequired: maturity !== 'read-only',
    auditRequired: maturity !== 'read-only',
    scope: 'mixed',
    completionMode: 'synchronous',
    limitationCode: extras.limitationCode ?? '',
    reasonCode: extras.reasonCode ?? maturity,
    nextAction: extras.nextAction ?? 'inspect_source_or_provider_status',
  }
}

function provider(
  providerId: string,
  kind: string,
  operations: BrokerOperationCapability[],
  extras: Partial<BrokerProviderStatus> = {}
): BrokerProviderStatus {
  return {
    providerId,
    providerKind: kind,
    displayName: extras.displayName ?? providerId,
    state: extras.state ?? 'ready',
    outcome: extras.outcome ?? 'ready',
    credentialHandle: extras.credentialHandle,
    namespaces: extras.namespaces ?? ['services'],
    capabilities: extras.capabilities ?? ['read'],
    operations,
    auditStatus: 'audit_available',
    nextAction: extras.nextAction,
  }
}

const providers: BrokerProviderStatus[] = [
  provider('local', 'local-encrypted-store', [
    operation('/v1/providers/config/status', 'read-only'),
    operation('/v1/sources/status', 'read-only'),
    operation('/v1/providers/config/validate', 'dry-run'),
  ]),
  provider('vault-target', 'vault', [
    operation('/v1/providers/config/status', 'read-only'),
    operation('/v1/sources/status', 'read-only'),
    operation('/v1/providers/config/validate', 'dry-run'),
    operation('/v1/providers/config/apply', 'validated'),
  ]),
  provider(
    'openbao-auth',
    'openbao',
    [
      operation('/v1/providers/config/status', 'read-only'),
      operation('/v1/sources/status', 'read-only', {
        limitationCode: 'source_auth_required',
        nextAction: 'reconnect_source',
      }),
      operation('/v1/providers/config/validate', 'unavailable', {
        limitationCode: 'source_auth_required',
        nextAction: 'reconnect_source',
      }),
    ],
    {
      displayName: 'OpenBao auth required',
      state: 'auth_required',
      outcome: 'source_auth_required',
      nextAction: 'reconnect_source',
    }
  ),
  provider('env-readonly', 'env', [
    operation('/v1/providers/config/status', 'read-only'),
  ]),
]

vi.mock('@/lib/service-lasso-dashboard/hooks', () => ({
  useRuntimeIdentity: () => ({ data: { permissions: ['*'] } }),
  useBrokerProviderStatus: () => ({
    isLoading: false,
    isError: false,
    data: {
      providers,
      currentProvider: providers[0],
      outcome: 'ready',
    },
  }),
  useBrokerProviderValidation: () => ({
    isPending: false,
    reset: vi.fn(),
    mutateAsync: vi.fn(),
  }),
  useBrokerProviderRowAction: () => ({
    isPending: false,
    mutateAsync: mutateRowAction,
  }),
}))

vi.mock('@/lib/service-lasso-dashboard/stub', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/service-lasso-dashboard/stub')>()
  return {
    ...actual,
    serviceLassoStubDataEnabled: false,
  }
})

describe('Secrets Broker provider row actions', () => {
  it('shows live pending then success on the clicked ready provider row', async () => {
    const user = userEvent.setup()
    mutateRowAction.mockImplementation(
      async (request: BrokerProviderRowActionRequest) =>
        gatedProviderActionResult(request, false) ??
        buildProviderActionResult({
          providerId: request.provider.providerId,
          operation: request.action,
          state: 'ready',
          summary: 'Provider validate ready.',
          nextAction: 'inspect_provider_status',
          correlationId: 'row-validate-ready',
          fixtureDemo: false,
        })
    )
    render(<SecretsBrokerProvidersPanel />)

    const row = screen.getByTestId('provider-row-vault-target')
    await user.click(within(row).getByRole('button', { name: /Actions/i }))
    await user.click(
      await screen.findByRole('menuitem', { name: /Test connection/i })
    )

    const result = await screen.findByTestId(
      'provider-action-result-vault-target'
    )
    expect(result).toHaveTextContent('success')
    expect(result).toHaveTextContent('ready')
    expect(result).toHaveTextContent('validate')
    expect(screen.queryByTestId('provider-action-result-local')).toBeNull()
  })

  it('shows blocked auth-required on the clicked reconnect row', async () => {
    const user = userEvent.setup()
    mutateRowAction.mockImplementation(
      async (request: BrokerProviderRowActionRequest) =>
        gatedProviderActionResult(request, false) ??
        buildProviderActionResult({
          providerId: request.provider.providerId,
          operation: request.action,
          state: 'auth-required',
          summary: 'Reconnect status source_auth_required.',
          nextAction: 'reconnect_source',
          fixtureDemo: false,
        })
    )
    render(<SecretsBrokerProvidersPanel />)

    const row = screen.getByTestId('provider-row-openbao-auth')
    await user.click(within(row).getByRole('button', { name: /Actions/i }))
    await user.click(
      await screen.findByRole('menuitem', { name: /Reconnect \/ reauth/i })
    )

    const result = await screen.findByTestId(
      'provider-action-result-openbao-auth'
    )
    expect(result).toHaveTextContent('blocked')
    expect(result).toHaveTextContent('auth-required')
    expect(result).toHaveTextContent('reconnect_source')
  })

  it('fails closed with unsupported on a provider without the advertised operation', async () => {
    const user = userEvent.setup()
    mutateRowAction.mockImplementation(
      async (request: BrokerProviderRowActionRequest) =>
        gatedProviderActionResult(request, false) ??
        buildProviderActionResult({
          providerId: request.provider.providerId,
          operation: request.action,
          state: 'unsupported',
          summary: 'validate is not advertised for this source.',
          nextAction: 'wait_for_advertised_source_operation',
          fixtureDemo: false,
        })
    )
    render(<SecretsBrokerProvidersPanel />)

    const row = screen.getByTestId('provider-row-env-readonly')
    await user.click(within(row).getByRole('button', { name: /Actions/i }))
    await user.click(
      await screen.findByRole('menuitem', { name: /Test connection/i })
    )

    const result = await screen.findByTestId(
      'provider-action-result-env-readonly'
    )
    expect(result).toHaveTextContent('blocked')
    expect(result).toHaveTextContent('unsupported')
    expect(result).toHaveTextContent('not advertised')
  })
})
