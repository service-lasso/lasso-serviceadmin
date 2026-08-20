import { renderRoute } from '@/test/render-route'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

describe('operator Inbox page', () => {
  it('lists unread fixture notices and deep-links to a service', async () => {
    const user = userEvent.setup()
    const { router } = await renderRoute('/inbox')

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Update available: @traefik' })
      ).toBeVisible()
    })

    expect(
      screen.getByRole('heading', { name: 'Service health degraded: dagu' })
    ).toBeVisible()
    expect(
      screen.queryByRole('heading', {
        name: 'Update installed: @serviceadmin',
      })
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/operator\.json/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/bearer /i)).not.toBeInTheDocument()

    const updateCard = screen.getByTestId(
      'inbox-item-inbox-update-available-traefik'
    )
    await user.click(
      within(updateCard).getByRole('link', { name: 'Open service' })
    )

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/services/%40traefik')
    })
  })

  it('shows the read list after marking a notice read', async () => {
    const user = userEvent.setup()
    await renderRoute('/inbox')

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Runtime startup' })
      ).toBeVisible()
    })

    const runtimeCard = screen.getByTestId('inbox-item-inbox-system-startup')
    await user.click(
      within(runtimeCard).getByRole('button', { name: 'Mark read' })
    )

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { name: 'Runtime startup' })
      ).not.toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Read' }))

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Runtime startup' })
      ).toBeVisible()
    })
  })

  it('shows an honest unavailable state when the runtime Inbox API is missing', async () => {
    await renderRoute('/inbox', { stubData: false })

    await waitFor(() => {
      expect(screen.getByText('Inbox unavailable')).toBeVisible()
    })
    expect(
      screen.getByText('Service Lasso runtime Inbox API is not available.')
    ).toBeVisible()
    expect(
      screen.getByText('Runtime Inbox messages are unavailable.')
    ).toBeVisible()
  })
})
