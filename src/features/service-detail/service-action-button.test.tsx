import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  DashboardService,
  ServiceAction,
} from '@/lib/service-lasso-dashboard/types'
import { ServiceActionButton } from './index'

const { errorToast, lifecycleMutation, lifecycleState, successToast } =
  vi.hoisted(() => ({
    errorToast: vi.fn(),
    lifecycleMutation: vi.fn(),
    lifecycleState: { isPending: false },
    successToast: vi.fn(),
  }))

vi.mock('@/lib/service-lasso-dashboard/hooks', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('@/lib/service-lasso-dashboard/hooks')
  >()),
  useServiceLifecycleAction: () => ({
    isPending: lifecycleState.isPending,
    mutate: lifecycleMutation,
  }),
}))

vi.mock('sonner', () => ({
  toast: { error: errorToast, success: successToast },
}))

const service = { id: '@secretsbroker' } as DashboardService

function lifecycleAction(
  kind: ServiceAction['kind'],
  label: string,
  requiresConfirmation = false
): ServiceAction {
  return {
    id: kind,
    kind,
    label,
    permission: {
      actor: 'local-root',
      allowed: true,
      confirmationLabel: requiresConfirmation ? label : undefined,
      key: `service:${kind}`,
      mode: 'local-root',
      reason: requiresConfirmation
        ? 'The runtime requires explicit confirmation.'
        : undefined,
      requiresConfirmation,
    },
  }
}

describe('service lifecycle action button', () => {
  beforeEach(() => {
    lifecycleState.isPending = false
    lifecycleMutation.mockReset()
    successToast.mockReset()
    errorToast.mockReset()
  })

  it('shows the configure mutation as loading and disables replay', () => {
    lifecycleState.isPending = true

    render(
      <ServiceActionButton
        action={lifecycleAction('config', 'Configure service')}
        service={service}
      />
    )

    expect(
      screen.getByRole('button', { name: /Configure service/i })
    ).toBeDisabled()
  })

  it('runs configure once and shows success feedback', async () => {
    const user = userEvent.setup()
    lifecycleMutation.mockImplementation((_request, callbacks) => {
      callbacks.onSuccess()
    })

    render(
      <ServiceActionButton
        action={lifecycleAction('config', 'Configure service')}
        service={service}
      />
    )
    await user.click(screen.getByRole('button', { name: 'Configure service' }))

    expect(lifecycleMutation).toHaveBeenCalledTimes(1)
    expect(lifecycleMutation).toHaveBeenCalledWith(
      {
        action: 'config',
        confirm: false,
        serviceId: '@secretsbroker',
      },
      expect.any(Object)
    )
    expect(successToast).toHaveBeenCalledWith('Configure service completed.')
  })

  it('shows failure feedback without replaying the mutation', async () => {
    const user = userEvent.setup()
    lifecycleMutation.mockImplementation((_request, callbacks) => {
      callbacks.onError()
    })

    render(
      <ServiceActionButton
        action={lifecycleAction('start', 'Start service')}
        service={service}
      />
    )
    await user.click(screen.getByRole('button', { name: 'Start service' }))

    expect(lifecycleMutation).toHaveBeenCalledTimes(1)
    expect(errorToast).toHaveBeenCalledWith(
      'Start service failed. The runtime made no UI-side assumptions.'
    )
  })

  it('requires the runtime-projected confirmation before reload', async () => {
    const user = userEvent.setup()
    render(
      <ServiceActionButton
        action={lifecycleAction('reload', 'Reload service', true)}
        service={service}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Reload service' }))
    const dialog = await screen.findByRole('alertdialog', {
      name: 'Confirm elevated action',
    })
    expect(lifecycleMutation).not.toHaveBeenCalled()

    await user.click(
      within(dialog).getByRole('button', { name: 'Reload service' })
    )
    expect(lifecycleMutation).toHaveBeenCalledTimes(1)
    expect(lifecycleMutation).toHaveBeenCalledWith(
      {
        action: 'reload',
        confirm: true,
        serviceId: '@secretsbroker',
      },
      expect.any(Object)
    )
  })

  it('disables elevated confirmation replay while a mutation is pending', async () => {
    const user = userEvent.setup()
    const action = lifecycleAction('reload', 'Reload service', true)
    const { rerender } = render(
      <ServiceActionButton action={action} service={service} />
    )

    await user.click(screen.getByRole('button', { name: 'Reload service' }))
    lifecycleState.isPending = true
    rerender(<ServiceActionButton action={action} service={service} />)

    const dialog = await screen.findByRole('alertdialog', {
      name: 'Confirm elevated action',
    })
    const confirm = within(dialog).getByRole('button', {
      name: 'Reload service',
    })
    expect(confirm).toBeDisabled()
    await user.click(confirm)
    expect(lifecycleMutation).not.toHaveBeenCalled()
  })
})
