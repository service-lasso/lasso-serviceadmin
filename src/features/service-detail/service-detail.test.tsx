import { renderRoute } from '@/test/render-route'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

describe('service detail quick actions', () => {
  it('keeps jump actions in the header and removes duplicate log-panel actions', async () => {
    const user = userEvent.setup()

    await renderRoute('/services/@serviceadmin')

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /^Service Admin UI$/i })
      ).toBeVisible()
    })

    const quickActions = within(
      screen.getByTestId('service-detail-quick-actions')
    )

    expect(quickActions.getByRole('link', { name: /logs/i })).toHaveAttribute(
      'href',
      '/logs?service=%40serviceadmin'
    )
    expect(
      quickActions.getByRole('link', { name: /dependencies/i })
    ).toHaveAttribute('href', '/dependencies?service=%40serviceadmin')
    expect(
      quickActions.getByRole('link', { name: /variables/i })
    ).toHaveAttribute('href', '/variables?service=%40serviceadmin')
    expect(
      quickActions.getByRole('link', { name: /network/i })
    ).toHaveAttribute('href', '/network')
    expect(
      quickActions.getByRole('link', { name: /runtime/i })
    ).toHaveAttribute('href', '/runtime?service=%40serviceadmin')

    await user.click(screen.getByRole('tab', { name: /logs/i }))

    expect(screen.queryByRole('link', { name: /open live logs/i })).toBeNull()
    expect(
      screen.queryByRole('link', { name: /open dependencies/i })
    ).toBeNull()
    expect(
      screen.queryByRole('link', { name: /open network view/i })
    ).toBeNull()
    expect(
      screen.queryByRole('link', { name: /open runtime view/i })
    ).toBeNull()
    expect(screen.getByText('Diagnostics + recent logs')).toBeVisible()
  })
})
