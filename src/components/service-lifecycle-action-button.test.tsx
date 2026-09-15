import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  DashboardService,
  ServiceAction,
} from '@/lib/service-lasso-dashboard/types'
import { ServiceLifecycleControls } from '@/features/services/components/services-columns'
import { ServiceLifecycleActionButton } from './service-lifecycle-action-button'

const { errorToast, lifecycleMutation, lifecycleState, successToast } =
  vi.hoisted(() => ({
    errorToast: vi.fn(),
    lifecycleMutation: vi.fn(),
    lifecycleState: { isPending: false },
    successToast: vi.fn(),
  }))

vi.mock('@/lib/service-lasso-dashboard/hooks', () => ({
  useServiceLifecycleAction: () => ({
    isPending: lifecycleState.isPending,
    mutate: lifecycleMutation,
  }),
}))

vi.mock('sonner', () => ({
  toast: { error: errorToast, success: successToast },
}))

const service = {
  id: 'echo-service',
  name: 'Echo Service',
  status: 'running',
} as DashboardService

const tableService = {
  ...service,
  actions: [
    { id: 'start', kind: 'start', label: 'Start service' },
    { id: 'stop', kind: 'stop', label: 'Stop service' },
    { id: 'restart', kind: 'restart', label: 'Restart service' },
  ],
  metadata: { serviceType: 'app' },
} as DashboardService

function stopAction(overrides: Partial<ServiceAction> = {}): ServiceAction {
  return {
    id: 'stop',
    kind: 'stop',
    label: 'Stop service',
    permission: {
      actor: 'local-root',
      allowed: true,
      confirmationLabel: 'Stop service',
      key: 'service:stop',
      mode: 'local-root',
      reason: 'The runtime requires explicit confirmation.',
      requiresConfirmation: true,
    },
    ...overrides,
  }
}

describe('service lifecycle action button', () => {
  beforeEach(() => {
    lifecycleState.isPending = false
    lifecycleMutation.mockReset()
    successToast.mockReset()
    errorToast.mockReset()
  })

  it('submits a table stop only after the runtime-projected confirmation', async () => {
    const user = userEvent.setup()
    lifecycleMutation.mockImplementation((_request, callbacks) => {
      callbacks.onSuccess()
    })

    render(
      <ServiceLifecycleActionButton
        action={stopAction()}
        service={service}
        ariaLabel='Stop Echo Service'
      />
    )

    await user.click(screen.getByRole('button', { name: 'Stop Echo Service' }))
    const dialog = await screen.findByRole('alertdialog', {
      name: 'Confirm elevated action',
    })
    expect(lifecycleMutation).not.toHaveBeenCalled()

    await user.click(
      within(dialog).getByRole('button', { name: 'Stop service' })
    )
    expect(lifecycleMutation).toHaveBeenCalledWith(
      { action: 'stop', confirm: true, serviceId: 'echo-service' },
      expect.any(Object)
    )
    expect(successToast).toHaveBeenCalledWith('Stop service completed.')
  })

  it('cancels an elevated table stop without submitting a mutation', async () => {
    const user = userEvent.setup()
    render(
      <ServiceLifecycleActionButton
        action={stopAction()}
        service={service}
        ariaLabel='Stop Echo Service'
      />
    )

    await user.click(screen.getByRole('button', { name: 'Stop Echo Service' }))
    const dialog = await screen.findByRole('alertdialog', {
      name: 'Confirm elevated action',
    })
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    expect(lifecycleMutation).not.toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('leaves a Core-denied table stop disabled and does not open confirmation', async () => {
    const user = userEvent.setup()
    render(
      <ServiceLifecycleActionButton
        action={stopAction({
          permission: {
            allowed: false,
            key: 'service:stop',
            reason: 'Core denied this action for the current actor.',
            requiresConfirmation: true,
          },
        })}
        service={service}
        ariaLabel='Stop Echo Service'
      />
    )

    const stop = screen.getByRole('button', { name: 'Stop Echo Service' })
    expect(stop).toBeDisabled()
    await user.click(stop)

    expect(lifecycleMutation).not.toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('keeps a table lifecycle click from selecting its row', async () => {
    const user = userEvent.setup()
    const selectRow = vi.fn()
    render(
      <div onClick={selectRow}>
        <ServiceLifecycleActionButton
          action={stopAction()}
          service={service}
          ariaLabel='Stop Echo Service'
          stopPropagation
        />
      </div>
    )

    await user.click(screen.getByRole('button', { name: 'Stop Echo Service' }))

    expect(selectRow).not.toHaveBeenCalled()
    expect(
      await screen.findByRole('alertdialog', {
        name: 'Confirm elevated action',
      })
    ).toBeVisible()
  })

  it('uses one pending guard for every table lifecycle control', () => {
    lifecycleState.isPending = true
    render(<ServiceLifecycleControls service={tableService} />)

    expect(
      screen.getByRole('button', { name: 'Stop Echo Service' })
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Restart Echo Service' })
    ).toBeDisabled()
  })
})
