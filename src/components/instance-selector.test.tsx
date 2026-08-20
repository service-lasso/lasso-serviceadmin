import { renderRoute } from '@/test/render-route'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import {
  activeInstanceSelectorState,
  instanceSelectorHasSecretMaterial,
} from './instance-selector-model'

describe('instance selector shell control', () => {
  it('defaults the authenticated shell to the local Service Lasso instance', async () => {
    await renderRoute('/')

    const selectors = await screen.findAllByRole('button', {
      name: /Service Lasso instance selector/i,
    })

    expect(selectors.length).toBeGreaterThan(0)
    expect(within(selectors[0]).getByText('Local')).toBeVisible()
    expect(
      within(selectors[0]).getByText(activeInstanceSelectorState.endpoint)
    ).toBeVisible()
    expect(screen.queryByText(/Not signed in/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/No active session/i)).not.toBeInTheDocument()
  })

  it('keeps the instance selector out of the page header controls', async () => {
    await renderRoute('/')

    const header = document.querySelector('header')

    expect(header).not.toBeNull()
    expect(
      within(header!).queryByRole('button', {
        name: /Service Lasso instance selector/i,
      })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: /Service Lasso instance selector/i,
      })
    ).toBeVisible()
  })

  it('opens local metadata and a setup-needed remote connect affordance', async () => {
    const user = userEvent.setup()
    await renderRoute('/')

    const [selector] = await screen.findAllByRole('button', {
      name: /Service Lasso instance selector/i,
    })

    await user.click(selector)

    expect(screen.getByText(/Service Lasso instance/i)).toBeVisible()
    expect(screen.getByText(/Local on-prem control is selected/i)).toBeVisible()
    expect(screen.getByText(/Local development instance/i)).toBeVisible()
    expect(
      screen.getByText(/instance:\/\/local\/serviceadmin\/default/i)
    ).toBeVisible()
    expect(screen.getByText(/Connect remote/i)).toBeVisible()
    expect(screen.getByText(/Setup needed/i)).toBeVisible()
  })

  it('renders as an icon-only affordance when the desktop sidebar is collapsed', async () => {
    const user = userEvent.setup()
    await renderRoute('/')

    const sidebarTrigger = document.querySelector<HTMLButtonElement>(
      '[data-sidebar="trigger"]'
    )

    expect(sidebarTrigger).not.toBeNull()
    await user.click(sidebarTrigger!)

    const [selector] = await screen.findAllByRole('button', {
      name: /Service Lasso instance selector/i,
    })

    expect(within(selector).queryByText('Local')).not.toBeInTheDocument()
    expect(
      within(selector).queryByText(activeInstanceSelectorState.endpoint)
    ).not.toBeInTheDocument()

    await user.click(selector)

    expect(screen.getByText(/Service Lasso instance/i)).toBeVisible()
    expect(screen.getByText(/Local on-prem control is selected/i)).toBeVisible()
  })

  it('keeps selector metadata free of secret material', () => {
    expect(instanceSelectorHasSecretMaterial()).toBe(false)
  })
})
