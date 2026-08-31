import { renderRoute } from '@/test/render-route'
import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

describe('Dependencies page composition', () => {
  it('keeps the route focused on the dependency graph', async () => {
    await renderRoute('/dependencies')

    await waitFor(() => {
      expect(screen.getByText(/^Dependency graph$/i)).toBeVisible()
    })

    expect(screen.getByText(/Filter graph nodes/i)).toBeVisible()
    expect(screen.getByText(/^Selected service details$/i)).toBeVisible()

    expect(screen.queryByText(/^Services in graph$/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^Relationship edges$/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^API usage edges$/i)).not.toBeInTheDocument()
    expect(
      screen.queryByText(/^Secrets Broker reference usage$/i)
    ).not.toBeInTheDocument()
  })

  it('fills remaining viewport height with the graph and details panes', async () => {
    await renderRoute('/dependencies')

    await waitFor(() => {
      expect(screen.getByText(/^Dependency graph$/i)).toBeVisible()
    })

    const main = screen.getByRole('main')
    expect(main).toHaveAttribute('data-layout', 'fixed')
    expect(main).toHaveClass('min-h-0')

    const graphCard = screen.getByTestId('dependency-graph-card')
    expect(graphCard).toHaveClass('flex-1')
    expect(graphCard).toHaveClass('min-h-0')
    expect(graphCard).toHaveClass('overflow-hidden')

    expect(screen.getByTestId('dependency-graph-pane')).toHaveClass('flex-1')
    expect(screen.getByTestId('dependency-graph-fill')).toBeInTheDocument()

    const detailsCard = screen.getByTestId('selected-service-details')
    expect(detailsCard).toHaveClass('min-h-0')
    expect(detailsCard).toHaveClass('overflow-hidden')

    const detailsScroll = screen.getByTestId('selected-service-details-scroll')
    expect(detailsScroll).toHaveClass('flex-1')
    expect(detailsScroll).toHaveClass('min-h-0')
    expect(detailsScroll).toHaveClass('overflow-auto')
  })
})
