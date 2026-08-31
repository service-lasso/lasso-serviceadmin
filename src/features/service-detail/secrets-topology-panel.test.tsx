import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SecretsBrokerTopologyPanel } from './secrets-topology-panel'

vi.mock('@/components/dependency-graph-canvas', () => ({
  DependencyGraphCanvas: () => <div>topology-graph</div>,
}))

vi.mock('@/lib/service-lasso-dashboard/hooks', () => ({
  useServices: () => ({
    data: [
      {
        id: '@serviceadmin',
        name: 'Service Admin',
        environmentVariables: [
          {
            key: 'SESSION_SIGNING_KEY',
            value: 'raw-secret-value',
            scope: 'service',
            secret: true,
            source: 'services/@serviceadmin/runtime/SESSION_SIGNING_KEY',
          },
          {
            key: 'DENIED_KEY',
            value: 'another-secret',
            scope: 'service',
            secret: true,
            source: 'services/@serviceadmin/DENIED_KEY',
          },
        ],
      },
    ],
  }),
  useSecretsManagement: () => ({
    isError: false,
    data: {
      results: [
        {
          ref: 'services/@serviceadmin/runtime/SESSION_SIGNING_KEY',
          name: 'SESSION_SIGNING_KEY',
          sourceId: 'local',
          providerKind: 'local-encrypted-store',
          ownerServiceId: '@serviceadmin',
          state: 'present',
          outcome: 'ready',
          capabilities: ['metadata'],
        },
        {
          ref: 'services/@serviceadmin/DENIED_KEY',
          name: 'DENIED_KEY',
          sourceId: 'local',
          providerKind: 'local-encrypted-store',
          ownerServiceId: '@serviceadmin',
          state: 'present',
          outcome: 'policy_denied',
          capabilities: ['metadata'],
        },
      ],
    },
  }),
}))

describe('Secrets Broker topology panel', () => {
  it('renders mapped and policy-denied rows without secret values', async () => {
    const user = userEvent.setup()
    render(<SecretsBrokerTopologyPanel />)

    expect(screen.getByText('SESSION_SIGNING_KEY')).toBeVisible()
    expect(screen.getByText('DENIED_KEY')).toBeVisible()
    expect(screen.getByText('mapped')).toBeVisible()
    expect(screen.getByText('policy-denied')).toBeVisible()
    expect(screen.getByText(/not authorized/i)).toBeVisible()

    await user.type(screen.getByLabelText(/Search mappings/i), 'no-such-ref')
    expect(screen.getByText(/No mapping rows match this search/i)).toBeVisible()

    const rendered = document.body.textContent ?? ''
    expect(rendered).not.toContain('raw-secret-value')
    expect(rendered).not.toContain('another-secret')
  })
})
