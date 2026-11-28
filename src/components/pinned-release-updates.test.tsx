import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { PinnedReleaseUpdates } from './pinned-release-updates'

const request = vi.fn()
const response = (value: unknown) =>
  new Response(JSON.stringify(value), {
    headers: { 'content-type': 'application/json' },
  })
const available = {
  serviceId: '@tui',
  currentTag: 'old-release',
  status: 'update_available',
  candidateTag: 'new-release',
}
beforeEach(() => {
  request.mockReset()
  vi.stubGlobal('fetch', request)
})

it('checks with the session client and installs only the confirmed exact candidate', async () => {
  const user = userEvent.setup()
  request.mockResolvedValueOnce(response(available))
  render(<PinnedReleaseUpdates serviceId='@tui' />)
  await user.click(screen.getByRole('button', { name: 'Check new releases' }))
  expect(await screen.findByText('Available release new-release')).toBeVisible()
  expect(request.mock.calls[0][0]).toContain(
    '/api/services/%40tui/pinned-release/check'
  )
  expect(request.mock.calls[0][1]).toMatchObject({ method: 'POST', body: '{}' })
  await user.click(screen.getByRole('button', { name: 'Install release' }))
  const dialog = screen.getByRole('alertdialog')
  expect(
    within(dialog).getByText(/Replace old-release with new-release/)
  ).toBeVisible()
  await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
  expect(request).toHaveBeenCalledTimes(1)
  request.mockResolvedValueOnce(
    response({ serviceId: '@tui', installedTag: 'new-release' })
  )
  await user.click(screen.getByRole('button', { name: 'Install release' }))
  await user.click(
    within(screen.getByRole('alertdialog')).getByRole('button', {
      name: 'Install release',
    })
  )
  expect(await screen.findByRole('status')).toHaveTextContent(
    'Installed new-release'
  )
  expect(request.mock.calls[1][0]).toContain(
    '/api/services/%40tui/pinned-release/install'
  )
  expect(JSON.parse(request.mock.calls[1][1].body)).toEqual({
    tag: 'new-release',
    confirm: true,
  })
})

it('clears a candidate when selection changes and scopes controls to operator clients', async () => {
  const user = userEvent.setup()
  request.mockResolvedValueOnce(response(available))
  const view = render(<PinnedReleaseUpdates serviceId='@tui' />)
  await user.click(screen.getByRole('button', { name: 'Check new releases' }))
  await screen.findByText('Available release new-release')
  view.rerender(<PinnedReleaseUpdates serviceId='@cli' />)
  expect(
    screen.queryByRole('button', { name: 'Install release' })
  ).not.toBeInTheDocument()
  view.rerender(<PinnedReleaseUpdates serviceId='echo-service' />)
  expect(screen.queryByText('Client releases')).not.toBeInTheDocument()
})

it('reports an older Core or denied request safely and permits a recheck', async () => {
  const user = userEvent.setup()
  request.mockResolvedValueOnce(
    new Response('PRIVATE_RESPONSE', { status: 404 })
  )
  render(<PinnedReleaseUpdates serviceId='@cli' />)
  await user.click(screen.getByRole('button', { name: 'Check new releases' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Release check unavailable'
  )
  expect(screen.queryByText(/PRIVATE_RESPONSE/)).not.toBeInTheDocument()
  request.mockResolvedValueOnce(
    response({
      serviceId: '@cli',
      currentTag: 'current-release',
      status: 'current',
      candidateTag: null,
    })
  )
  await user.click(screen.getByRole('button', { name: 'Check new releases' }))
  expect(await screen.findByRole('status')).toHaveTextContent(
    'The installed release is current'
  )
})

it('holds pending installation and clears the candidate after failure', async () => {
  const user = userEvent.setup()
  request.mockResolvedValueOnce(response(available))
  render(<PinnedReleaseUpdates serviceId='@tui' />)
  await user.click(screen.getByRole('button', { name: 'Check new releases' }))
  await screen.findByText('Available release new-release')
  let finish: (response: Response) => void = () => {}
  request.mockImplementationOnce(
    () =>
      new Promise<Response>((resolve) => {
        finish = resolve
      })
  )
  await user.click(screen.getByRole('button', { name: 'Install release' }))
  await user.click(
    within(screen.getByRole('alertdialog')).getByRole('button', {
      name: 'Install release',
    })
  )
  expect(
    screen.getByText('Check new releases').closest('button')
  ).toBeDisabled()
  expect(
    within(screen.getByRole('alertdialog')).getByRole('button', {
      name: 'Install release',
    })
  ).toBeDisabled()
  finish(new Response('PRIVATE_INSTALL_FAILURE', { status: 409 }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Release installation failed'
  )
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  expect(
    screen.queryByText('Available release new-release')
  ).not.toBeInTheDocument()
  expect(screen.queryByText(/PRIVATE_INSTALL_FAILURE/)).not.toBeInTheDocument()
})
