import { renderRoute } from '@/test/render-route'
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  countFleetInstancesByKind,
  fleetInstanceSummaries,
  fleetOverviewHasSecretMaterial,
} from './fleet-overview'

describe('fleet overview planning surface', () => {
  it('renders the current local-only instance and future placeholders', async () => {
    await renderRoute('/fleet-overview')

    expect(
      await screen.findByRole('heading', { name: /Fleet overview planning/i })
    ).toBeVisible()
    expect(screen.getByText(/Local-only current state/i)).toBeVisible()
    expect(screen.getByText(/No cross-instance control/i)).toBeVisible()
    expect(screen.getByText(/Local development instance/i)).toBeVisible()
    expect(screen.getAllByText(/Future remote/i)[0]).toBeVisible()
    expect(screen.getByText(/Future LAN lab instance/i)).toBeVisible()
    expect(screen.getByText(/Future production read-only view/i)).toBeVisible()
    expect(
      screen.getByText(/instance:\/\/local\/serviceadmin\/default/i)
    ).toBeVisible()
  })

  it('shows metadata fields and blocks privileged cross-instance actions', async () => {
    await renderRoute('/fleet-overview')

    expect(
      screen.queryByText(/service-lasso-local-dev/i)
    ).not.toBeInTheDocument()
    expect(screen.getAllByText(/local workstation/i)[0]).toBeVisible()
    expect(screen.getByText(/self-registered local instance/i)).toBeVisible()
    expect(screen.getByText(/remote restart/i)).toBeVisible()
    expect(screen.getByText(/cross-instance secret read/i)).toBeVisible()
    expect(screen.getByText(/fleet-wide rotation/i)).toBeVisible()
    expect(screen.getByText(/No remote control is implemented/i)).toBeVisible()
    expect(
      screen.getByText(/No cross-instance Secrets Broker reads/i)
    ).toBeVisible()
  })

  it('keeps fleet metadata fixtures free of secret material', () => {
    expect(fleetInstanceSummaries).toHaveLength(3)
    expect(countFleetInstancesByKind()).toEqual({
      local: 1,
      'future-remote': 2,
    })
    expect(fleetOverviewHasSecretMaterial()).toBe(false)
  })
})
