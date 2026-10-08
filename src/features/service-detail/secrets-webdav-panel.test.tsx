import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { SecretsWebDAVPanel } from './secrets-webdav-panel'

const controls = vi.hoisted(() => ({
  permissions: ['*'],
  data: undefined as unknown,
  isError: false,
  refetch: vi.fn(),
  query: vi.fn(),
}))
vi.mock('@/lib/service-lasso-dashboard/hooks', () => ({
  useRuntimeIdentity: () => ({ data: { permissions: controls.permissions } }),
  useBrokerWebDAV: (cursor: string, enabled: boolean) => {
    controls.query(cursor, enabled)
    return {
      data: controls.data,
      isError: controls.isError,
      isFetching: false,
      refetch: controls.refetch,
    }
  },
}))
const fixture = {
  state: 'listening',
  generatedAt: '2026-10-08T00:00:00Z',
  capacityBytes: 67108864,
  usedBytes: 32,
  activeGrants: 2,
  fileCount: 2,
  downloads: 3,
  servedBytes: 48,
  files: [
    {
      grantId: 'a'.repeat(32),
      workspaceId: 'local',
      serviceId: 'echo-webdav',
      path: 'demo-config.json',
      sizeBytes: 16,
      downloads: 3,
      servedBytes: 48,
      createdAt: '2026-10-08T00:00:00Z',
    },
    {
      grantId: 'b'.repeat(32),
      workspaceId: 'local',
      serviceId: 'other-app',
      path: 'nested/key',
      sizeBytes: 16,
      downloads: 0,
      servedBytes: 0,
      createdAt: '2026-10-08T00:00:00Z',
    },
  ],
}
beforeEach(() => {
  vi.clearAllMocks()
  controls.permissions = ['*']
  controls.data = structuredClone(fixture)
  controls.isError = false
})
it('shows RAM state, owners, file sizes and download metrics', () => {
  render(<SecretsWebDAVPanel />)
  expect(screen.getByText('Listening · loopback only')).toBeInTheDocument()
  expect(screen.getByText('32 B / 64.0 MiB')).toBeInTheDocument()
  expect(screen.getByText('demo-config.json')).toBeInTheDocument()
  expect(screen.getAllByText('Never')).toHaveLength(2)
  expect(
    screen.queryByRole('button', { name: /upload|download/i })
  ).not.toBeInTheDocument()
})
it('filters by service and search, and refreshes inventory', async () => {
  const user = userEvent.setup()
  render(<SecretsWebDAVPanel />)
  await user.click(screen.getByRole('button', { name: 'echo-webdav' }))
  expect(screen.queryByText('nested/key')).not.toBeInTheDocument()
  await user.type(
    screen.getByRole('textbox', { name: 'Search WebDAV files' }),
    'missing'
  )
  expect(
    screen.getByText('No matching files on this page.')
  ).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Refresh files' }))
  expect(controls.refetch).toHaveBeenCalledTimes(1)
})
it('navigates bounded pages and refresh returns to first page', async () => {
  controls.data = { ...fixture, nextCursor: '100' }
  const user = userEvent.setup()
  render(<SecretsWebDAVPanel />)
  await user.click(screen.getByRole('button', { name: 'Next page' }))
  expect(controls.query).toHaveBeenLastCalledWith('100', true)
  await user.click(screen.getByRole('button', { name: 'Refresh files' }))
  expect(controls.query).toHaveBeenLastCalledWith('0', true)
})
it('blocks unauthorized inventory loads', () => {
  controls.permissions = []
  render(<SecretsWebDAVPanel />)
  expect(controls.query).toHaveBeenCalledWith('0', false)
  expect(
    screen.getByText(/Workspace read permission is required/)
  ).toBeInTheDocument()
  expect(screen.queryByText('demo-config.json')).not.toBeInTheDocument()
})
it('shows errors without displaying stale rows', () => {
  controls.isError = true
  render(<SecretsWebDAVPanel />)
  expect(screen.getByRole('alert')).toHaveTextContent('unavailable')
  expect(screen.queryByText('demo-config.json')).not.toBeInTheDocument()
})
it('distinguishes loading from stopped empty storage', () => {
  controls.data = undefined
  const view = render(<SecretsWebDAVPanel />)
  expect(screen.getByRole('status')).toHaveTextContent('Loading')
  controls.data = {
    ...fixture,
    state: 'stopped',
    files: [],
    fileCount: 0,
    activeGrants: 0,
    usedBytes: 0,
  }
  view.rerender(<SecretsWebDAVPanel />)
  expect(screen.getByText('Stopped')).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('No active secret files')
})
