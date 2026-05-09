import { renderRoute } from '@/test/render-route'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import {
  trustedIdentityHasSecretMaterial,
  trustedIdentityScenarios,
} from './zitadel-session'

describe('Trusted SSO identity context surface', () => {
  it('renders authenticated identity, workspace, roles, and audit actor without secret material', async () => {
    await renderRoute('/auth-session')

    expect(
      await screen.findByRole('heading', {
        name: /Trusted SSO identity context/i,
      })
    ).toBeVisible()
    expect(screen.getAllByText(/Authenticated admin/i)[0]).toBeVisible()
    expect(screen.getAllByText(/Authenticated/i)[0]).toBeVisible()
    expect(screen.getAllByText(/traefik-oidc-auth/i)[0]).toBeVisible()
    expect(
      screen.getAllByText(/workspace:service-lasso\/local-dev/i)[0]
    ).toBeVisible()
    expect(
      screen.getByText(/zitadel-subject:\/\/service-lasso\/users\/max/i)
    ).toBeVisible()
    expect(screen.getByText(/serviceadmin.operator/i)).toBeVisible()
    expect(
      screen.getByText(/serviceadmin:secrets:values:reveal/i)
    ).toBeVisible()
    expect(screen.getByText(/raw secret reveal is not enabled/i)).toBeVisible()
    expect(screen.getAllByText(/Audit actor metadata/i)[0]).toBeVisible()
    expect(screen.getByText(/audit-actor:\/\/zitadel\/max/i)).toBeVisible()
    expect(screen.getByText(/Metadata only/i)).toBeVisible()
    expect(
      screen.queryByText(/access_token|refresh_token|id_token|session_secret/i)
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(/bearer\s+[a-z0-9_-]+\.[a-z0-9._-]+/i)
    ).not.toBeInTheDocument()
  })

  it('covers unauthenticated expired forbidden workspace-mismatch and invalid states', async () => {
    const user = userEvent.setup()
    await renderRoute('/auth-session')

    await user.selectOptions(
      screen.getByLabelText(/Identity scenario/i),
      'unauthenticated'
    )
    expect(screen.getAllByText(/Login required/i)[0]).toBeVisible()
    expect(screen.getByText(/No trusted user metadata/i)).toBeVisible()
    expect(screen.getByText(/none until login/i)).toBeVisible()
    expect(screen.getByText(/no trusted identity metadata/i)).toBeVisible()

    await user.selectOptions(
      screen.getByLabelText(/Identity scenario/i),
      'expired'
    )
    expect(screen.getAllByText(/Expired/i)[0]).toBeVisible()
    expect(
      screen.getByText(/trusted identity context is expired/i)
    ).toBeVisible()
    expect(screen.getByText(/Expired Operator \(expired\)/i)).toBeVisible()

    await user.selectOptions(
      screen.getByLabelText(/Identity scenario/i),
      'forbidden'
    )
    expect(screen.getAllByText(/Forbidden/i)[0]).toBeVisible()
    expect(screen.getAllByText(/Readonly Operator/i)[0]).toBeVisible()
    expect(screen.getByText(/workspace-viewer/i)).toBeVisible()
    expect(screen.getByText(/operator role is required/i)).toBeVisible()
    expect(screen.getByText(/least-privilege role/i)).toBeVisible()

    await user.selectOptions(
      screen.getByLabelText(/Identity scenario/i),
      'workspace-mismatch'
    )
    expect(screen.getAllByText(/Workspace mismatch/i)[0]).toBeVisible()
    expect(
      screen.getByText(/workspace:service-lasso\/other-dev/i)
    ).toBeVisible()
    expect(
      screen.getByText(/does not match the active route workspace/i)
    ).toBeVisible()

    await user.selectOptions(
      screen.getByLabelText(/Identity scenario/i),
      'invalid'
    )
    expect(screen.getAllByText(/Invalid context/i)[0]).toBeVisible()
    expect(screen.getByText(/contract is incomplete/i)).toBeVisible()
    expect(
      screen.getByText(/Browser-supplied identity headers are not trusted/i)
    ).toBeVisible()
  })

  it('renders permission decisions as metadata only', async () => {
    await renderRoute('/auth-session')

    const permissionTable = screen.getByRole('table')
    expect(
      within(permissionTable).getByText(/serviceadmin:services:read/i)
    ).toBeVisible()
    expect(within(permissionTable).getAllByText(/allowed/i)[0]).toBeVisible()
    expect(within(permissionTable).getAllByText(/denied/i)[0]).toBeVisible()
  })

  it('keeps trusted identity fixtures free of secret material', () => {
    expect(trustedIdentityHasSecretMaterial()).toBe(false)
    expect(trustedIdentityScenarios).toHaveLength(6)
    expect(
      trustedIdentityScenarios.some(
        (scenario) => scenario.state === 'workspace-mismatch'
      )
    ).toBe(true)
  })
})
