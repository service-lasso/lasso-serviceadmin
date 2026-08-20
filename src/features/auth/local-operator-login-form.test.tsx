import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { RuntimeIdentity } from '@/lib/service-lasso-dashboard/runtime-auth'
import { LocalOperatorLoginForm } from './local-operator-login-form'

const zitadelProvider = {
  id: 'zitadel',
  label: 'ZITADEL',
  kind: 'zitadel' as const,
  startUrl: 'https://auth.example.test/start',
}

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
  it('shows local, token, and provider fields for remote browsers when FORCE_SSO is off', () => {
    render(
      <LocalOperatorLoginForm
        identity={blockedIdentity({
          identityProviders: [zitadelProvider],
        })}
        hostname='192.168.1.9'
        onAuthenticated={() => undefined}
      />
    )
    expect(screen.getByText(/login with zitadel/i)).toBeVisible()
    expect(screen.getByLabelText(/lasso-local password/i)).toBeVisible()
    expect(screen.getByLabelText(/local-admin token/i)).toBeVisible()
  })

  it('hides local and token fields when FORCE_SSO is on for a remote origin', () => {
    render(
      <LocalOperatorLoginForm
        identity={blockedIdentity({
          forceSso: true,
          identityProviders: [zitadelProvider],
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

  it('keeps local, token, and provider fields on loopback when FORCE_SSO is on', () => {
    render(
      <LocalOperatorLoginForm
        identity={blockedIdentity({
          local: true,
          remoteAuthRequired: false,
          forceSso: true,
          identityProviders: [zitadelProvider],
          blockers: [],
        })}
        hostname='127.0.0.1'
        onAuthenticated={() => undefined}
      />
    )
    expect(screen.getByText(/login with zitadel/i)).toBeVisible()
    expect(screen.getByLabelText(/lasso-local password/i)).toBeVisible()
    expect(screen.getByLabelText(/local-admin token/i)).toBeVisible()
    expect(screen.queryByText(/FORCE_SSO is on/i)).not.toBeInTheDocument()
  })

  it('keeps local and token fields when the hostname is loopback even if Core local is false', () => {
    render(
      <LocalOperatorLoginForm
        identity={blockedIdentity({
          forceSso: true,
          identityProviders: [zitadelProvider],
        })}
        hostname='localhost'
        onAuthenticated={() => undefined}
      />
    )
    expect(screen.getByText(/login with zitadel/i)).toBeVisible()
    expect(screen.getByLabelText(/lasso-local password/i)).toBeVisible()
    expect(screen.getByLabelText(/local-admin token/i)).toBeVisible()
  })
})
