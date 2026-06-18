import { renderRoute } from '@/test/render-route'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import {
  buildSecretInventoryOperationPreview,
  buildLargeSecretInventoryFixture,
  countSecretInventoryByState,
  secretInventoryOperationHasPlaintextMaterial,
  secretInventoryHasPlaintextMaterial,
  secretInventoryRows,
} from './secret-inventory'

describe('secret inventory metadata view', () => {
  it('hides deterministic fixture metadata when stub mode is disabled', async () => {
    await renderRoute('/secrets-broker/secret-inventory', { stubData: false })

    expect(
      await screen.findByRole('heading', { name: /^Secret inventory$/i })
    ).toBeVisible()
    expect(screen.getByText(/Secret inventory unavailable/i)).toBeVisible()
    expect(screen.getByText(/No fixture rows/i)).toBeVisible()
    expect(
      screen.queryByText(/Deterministic local fixture/i)
    ).not.toBeInTheDocument()
    expect(screen.queryByText('local/serviceadmin')).not.toBeInTheDocument()
    expect(
      screen.queryByText('secret://local/serviceadmin/session-signing')
    ).not.toBeInTheDocument()
  })

  it('renders deterministic local fixture metadata without plaintext controls', async () => {
    await renderRoute('/secrets-broker/secret-inventory')

    expect(
      await screen.findByRole('heading', { name: /^Secret inventory$/i })
    ).toBeVisible()
    expect(screen.getAllByText(/Deterministic local fixture/i)[0]).toBeVisible()
    expect(screen.getByText(/No plaintext values/i)).toBeVisible()
    expect(screen.getByText(/not a password vault/i)).toBeVisible()
    expect(screen.getByText(/metadata-first ref table/i)).toBeVisible()
    expect(screen.getByText('local/serviceadmin')).toBeVisible()
    expect(
      screen.getAllByText('secret://local/serviceadmin/session-signing')[0]
    ).toBeVisible()
    expect(screen.getAllByText('@serviceadmin')[0]).toBeVisible()
    expect(screen.getAllByText(/provider metadata/i)[0]).toBeVisible()
    expect(screen.getAllByText(/ref usage/i)[0]).toBeVisible()
    expect(screen.getAllByText(/audit events/i)[0]).toBeVisible()
  })

  it('shows unavailable plaintext actions as blocked text, not controls', async () => {
    await renderRoute('/secrets-broker/secret-inventory')

    expect(screen.getAllByText(/show plaintext/i)[0]).toBeVisible()
    expect(screen.getAllByText(/copy value/i)[0]).toBeVisible()
    expect(screen.getAllByText(/bulk edit/i)[0]).toBeVisible()
    expect(screen.getAllByRole('button', { name: /Rotate/i })[0]).toBeVisible()
    expect(screen.getAllByRole('button', { name: /Delete/i })[0]).toBeVisible()
    expect(
      screen.queryByRole('button', {
        name: /show plaintext|copy value|export/i,
      })
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/unredacted value/i)).not.toBeInTheDocument()
  })

  it('previews per-row rotate and delete actions behind audit and typed confirmation gates', async () => {
    const user = userEvent.setup()
    await renderRoute('/secrets-broker/secret-inventory')

    expect(
      screen.getByText(/Rotate preview for secret:\/\/local\/serviceadmin/i)
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: /Record broker operation preview/i })
    ).toBeDisabled()
    expect(
      screen.getByText(/enter at least 8 characters of audit reason/i)
    ).toBeVisible()

    await user.type(
      screen.getByLabelText(/Audit reason/i),
      'operator requested safe rotate'
    )
    await user.type(
      screen.getByLabelText(/Confirm exact ref id/i),
      'secret://local/serviceadmin/session-signing'
    )

    expect(
      screen.getByText(/ready to record metadata-only broker preview/i)
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: /Record broker operation preview/i })
    ).toBeEnabled()

    await user.selectOptions(screen.getByLabelText(/Operation/i), 'delete')
    expect(
      screen.getByText(/Delete preview for secret:\/\/local\/serviceadmin/i)
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: /Record broker operation preview/i })
    ).toBeEnabled()
  })

  it('renders unsupported denied auth missing success and failure states safely', async () => {
    const user = userEvent.setup()
    await renderRoute('/secrets-broker/secret-inventory')

    await user.selectOptions(
      screen.getByLabelText(/Broker preview state/i),
      'auth-required'
    )
    expect(screen.getAllByText(/Provider auth required/i)[1]).toBeVisible()
    expect(screen.getByText(/Complete the provider challenge/i)).toBeVisible()

    await user.selectOptions(
      screen.getByLabelText(/Broker preview state/i),
      'unsupported'
    )
    expect(screen.getAllByText(/Unsupported/i)[1]).toBeVisible()
    expect(
      screen.getByText(/unsupported capability rendered safely/i)
    ).toBeVisible()

    await user.selectOptions(
      screen.getByLabelText(/Broker preview state/i),
      'policy-denied'
    )
    expect(screen.getAllByText(/Policy denied/i)[1]).toBeVisible()
    expect(screen.getByText(/outside operator mutation scope/i)).toBeVisible()

    await user.selectOptions(
      screen.getByLabelText(/Broker preview state/i),
      'missing'
    )
    expect(screen.getByText(/Ref missing/i)).toBeVisible()

    await user.selectOptions(
      screen.getByLabelText(/Broker preview state/i),
      'success'
    )
    expect(screen.getAllByText(/Preview recorded/i)[0]).toBeVisible()

    await user.selectOptions(
      screen.getByLabelText(/Broker preview state/i),
      'failure'
    )
    expect(screen.getByText(/Preview failed/i)).toBeVisible()
    expect(screen.queryByText(/DEMO_REVEAL_VALUE_42/i)).not.toBeInTheDocument()
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
    expect(
      secretInventoryOperationHasPlaintextMaterial(
        buildSecretInventoryOperationPreview(
          secretInventoryRows[0],
          'delete',
          'operator requested safe delete',
          'secret://local/serviceadmin/session-signing'
        )
      )
    ).toBe(false)
  })

  it('builds large deterministic fixture sets for table behavior tests', () => {
    const largeRows = buildLargeSecretInventoryFixture(125)

    expect(largeRows).toHaveLength(125)
    expect(largeRows[0].id).toBe('fixture-secret-ref-1')
    expect(largeRows[124].refId).toBe('secret://fixture/workspace-5/ref-125')
    expect(new Set(largeRows.map((row) => row.id)).size).toBe(125)
    expect(secretInventoryHasPlaintextMaterial(largeRows)).toBe(false)
  })

  it('supports shared data-table search and pagination for inventory refs', async () => {
    const user = userEvent.setup()
    const { router } = await renderRoute(
      '/secrets-broker/secret-inventory?pageSize=2'
    )

    expect(screen.getByPlaceholderText(/Search secret refs/i)).toBeVisible()
    expect(screen.getByText('local/serviceadmin')).toBeVisible()
    expect(screen.queryByText('file/runtime')).not.toBeInTheDocument()
    expect(screen.getAllByText(/Page 1 of 3/i)[0]).toBeVisible()

    await user.click(screen.getByRole('button', { name: /Go to next page/i }))
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ page: 2 })
    })

    await user.type(
      screen.getByPlaceholderText(/Search secret refs/i),
      'payments'
    )
    expect(screen.getByText('provider/payments')).toBeVisible()
    expect(screen.queryByText('file/runtime')).not.toBeInTheDocument()
    expect(router.state.location.search).toMatchObject({ ref: 'payments' })
  })
})
