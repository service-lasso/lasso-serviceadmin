import { renderRoute } from '@/test/render-route'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import {
  zitadelSessionHasSecretMaterial,
  zitadelSessionScenarios,
} from './zitadel-session'

describe('ZITADEL session and role surface', () => {
  it('renders signed-in session metadata and role summaries without secret material', async () => {
    await renderRoute('/auth-session')

    expect(
      await screen.findByRole('heading', {
        name: /ZITADEL session and roles/i,
      })
    ).toBeVisible()
    expect(screen.getAllByText(/Signed-in admin/i)[0]).toBeVisible()
    expect(screen.getAllByText(/Signed in/i)[0]).toBeVisible()
    expect(
      screen.getByText(/workspace:service-lasso\/local-dev/i)
    ).toBeVisible()
    expect(
      screen.getByText(/zitadel-subject:\/\/service-lasso\/users\/max/i)
    ).toBeVisible()
    expect(screen.getByText(/serviceadmin.operator/i)).toBeVisible()
    expect(
      screen.getByText(/serviceadmin:secrets:values:reveal/i)
    ).toBeVisible()
    expect(screen.getByText(/raw secret reveal is not enabled/i)).toBeVisible()
    expect(screen.getByText(/Metadata only/i)).toBeVisible()
    expect(
      screen.queryByText(/access_token|refresh_token|id_token|session_secret/i)
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(/bearer\s+[a-z0-9_-]+\.[a-z0-9._-]+/i)
    ).not.toBeInTheDocument()
  })

  it('covers signed-out setup-needed and permission-denied states', async () => {
    const user = userEvent.setup()
    await renderRoute('/auth-session')

    await user.selectOptions(
      screen.getByLabelText(/Auth scenario/i),
      'signed-out'
    )
    expect(screen.getAllByText(/Login required/i)[0]).toBeVisible()
    expect(screen.getByText(/Start the ZITADEL login flow/i)).toBeVisible()
    expect(screen.getByText(/No signed-in user metadata/i)).toBeVisible()
    expect(screen.getByText(/none until login/i)).toBeVisible()

    await user.selectOptions(
      screen.getByLabelText(/Auth scenario/i),
      'setup-needed'
    )
    expect(screen.getAllByText(/Setup needed/i)[0]).toBeVisible()
    expect(screen.getByText(/not-configured/i)).toBeVisible()
    expect(screen.getByText(/local-dev-open/i)).toBeVisible()
    expect(screen.getByText(/Do not force ZITADEL/i)).toBeVisible()

    await user.selectOptions(
      screen.getByLabelText(/Auth scenario/i),
      'permission-denied'
    )
    expect(screen.getAllByText(/Permission denied/i)[0]).toBeVisible()
    expect(screen.getByText(/Readonly Operator/i)).toBeVisible()
    expect(screen.getByText(/workspace-viewer/i)).toBeVisible()
    expect(screen.getByText(/operator role is required/i)).toBeVisible()
    expect(screen.getByText(/least-privilege role/i)).toBeVisible()
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

  it('keeps ZITADEL session fixtures free of secret material', () => {
    expect(zitadelSessionHasSecretMaterial()).toBe(false)
    expect(zitadelSessionScenarios).toHaveLength(4)
    expect(
      zitadelSessionScenarios.some(
        (scenario) => scenario.state === 'permission-denied'
      )
    ).toBe(true)
  })
})
