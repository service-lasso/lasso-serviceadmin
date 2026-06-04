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
})
