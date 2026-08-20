import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { RuntimeIdentity } from '@/lib/service-lasso-dashboard/runtime-auth'
import { LocalOperatorLoginForm } from './local-operator-login-form'

function blockedIdentity(
  overrides: Partial<RuntimeIdentity> = {}
): RuntimeIdentity {
  return {
    contractVersion: 'service-lasso.auth-status.v1',
    authenticated: false,
    actorKind: null,
    actorId: null,
    local: false,
    remoteAuthRequired: true,
    forceSso: false,
    localTokenConfigured: true,
    localOperatorConfigured: true,
    identityProviders: [],
    workspaceId: null,
    roles: [],
    permissions: [],
    blockers: ['remote_auth_required'],
    ...overrides,
  }
}

describe('LocalOperatorLoginForm', () => {
  it('shows local and token fields for remote browsers when FORCE_SSO is off', () => {
    render(
      <LocalOperatorLoginForm
        identity={blockedIdentity()}
        hostname='192.168.1.9'
        onAuthenticated={() => undefined}
      />
    )
    expect(screen.getByLabelText(/lasso-local password/i)).toBeVisible()
    expect(screen.getByLabelText(/local-admin token/i)).toBeVisible()
  })

  it('hides local and token fields when FORCE_SSO is on for a remote origin', () => {
    render(
      <LocalOperatorLoginForm
        identity={blockedIdentity({
          forceSso: true,
          identityProviders: [
            {
              id: 'zitadel',
              label: 'ZITADEL',
              kind: 'zitadel',
              startUrl: 'https://auth.example.test/start',
            },
          ],
        })}
        hostname='192.168.1.9'
        onAuthenticated={() => undefined}
      />
    )
    expect(screen.getByText(/login with zitadel/i)).toBeVisible()
    expect(
      screen.queryByLabelText(/lasso-local password/i)
    ).not.toBeInTheDocument()
    expect(
      screen.queryByLabelText(/local-admin token/i)
    ).not.toBeInTheDocument()
    expect(screen.getByText(/FORCE_SSO is on/i)).toBeVisible()
  })
})
