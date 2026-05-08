import { renderRoute } from '@/test/render-route'
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  buildLargeSecretInventoryFixture,
  countSecretInventoryByState,
  secretInventoryHasPlaintextMaterial,
  secretInventoryRows,
} from './secret-inventory'

describe('secret inventory metadata view', () => {
  it('renders deterministic local fixture metadata without plaintext controls', async () => {
    await renderRoute('/secret-inventory')

    expect(
      await screen.findByRole('heading', { name: /^Secret inventory$/i })
    ).toBeVisible()
    expect(screen.getAllByText(/Deterministic local fixture/i)[0]).toBeVisible()
    expect(
      screen.getByText(/No plaintext or privileged actions/i)
    ).toBeVisible()
    expect(screen.getByText(/not a password vault/i)).toBeVisible()
    expect(screen.getByText(/metadata-first ref table/i)).toBeVisible()
    expect(screen.getByText('local/serviceadmin')).toBeVisible()
    expect(
      screen.getByText('secret://local/serviceadmin/session-signing')
    ).toBeVisible()
    expect(screen.getAllByText('@serviceadmin')[0]).toBeVisible()
    expect(screen.getAllByText(/provider metadata/i)[0]).toBeVisible()
    expect(screen.getAllByText(/ref usage/i)[0]).toBeVisible()
    expect(screen.getAllByText(/audit events/i)[0]).toBeVisible()
  })

  it('shows unavailable privileged actions as blocked text, not controls', async () => {
    await renderRoute('/secret-inventory')

    expect(screen.getAllByText(/show plaintext/i)[0]).toBeVisible()
    expect(screen.getAllByText(/copy value/i)[0]).toBeVisible()
    expect(screen.getAllByText(/bulk edit/i)[0]).toBeVisible()
    expect(screen.getByText(/rotate from table/i)).toBeVisible()
    expect(
      screen.queryByRole('button', {
        name: /show plaintext|copy value|rotate/i,
      })
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/unredacted value/i)).not.toBeInTheDocument()
  })

  it('counts states and keeps fixtures free of plaintext-like material', () => {
    expect(countSecretInventoryByState()).toEqual({
      present: 2,
      missing: 1,
      stale: 1,
      'rotation-due': 1,
    })
    expect(secretInventoryRows).toHaveLength(5)
    expect(secretInventoryHasPlaintextMaterial()).toBe(false)
  })

  it('builds large deterministic fixture sets for table behavior tests', () => {
    const largeRows = buildLargeSecretInventoryFixture(125)

    expect(largeRows).toHaveLength(125)
    expect(largeRows[0].id).toBe('fixture-secret-ref-1')
    expect(largeRows[124].refId).toBe('secret://fixture/workspace-5/ref-125')
    expect(new Set(largeRows.map((row) => row.id)).size).toBe(125)
    expect(secretInventoryHasPlaintextMaterial(largeRows)).toBe(false)
  })
})
