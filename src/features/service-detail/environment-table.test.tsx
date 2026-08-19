import { renderRoute } from '@/test/render-route'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  __resetStubServicesForTest,
  __setStubServicesForTest,
} from '@/lib/service-lasso-dashboard/stub'
import type {
  DashboardService,
  ServiceEnvironmentVariable,
} from '@/lib/service-lasso-dashboard/types'
import {
  buildServiceDetailVariableRows,
  buildServiceDetailVariableSearchText,
} from './environment-table'

vi.mock('@/lib/service-lasso-dashboard/client', async () => {
  const stub = await vi.importActual<
    typeof import('@/lib/service-lasso-dashboard/stub')
  >('@/lib/service-lasso-dashboard/stub')

  return {
    buildServiceLogUrl: stub.buildStubServiceLogUrl,
    fetchDashboardService: stub.fetchDashboardService,
    fetchDashboardSummary: stub.fetchDashboardSummary,
    fetchServiceConfigDocument: stub.fetchServiceConfigDocument,
    fetchServices: stub.fetchServices,
    runDashboardAction: stub.runDashboardAction,
    saveServiceConfigDocument: stub.saveServiceConfigDocument,
    serviceLassoApiBaseUrl: stub.serviceLassoApiBaseUrl,
  }
})

vi.mock('@monaco-editor/react', () => ({
  DiffEditor: () => <div aria-label='server.json backup diff editor' />,
  default: () => <textarea aria-label='server.json editor' />,
}))

afterEach(() => {
  __resetStubServicesForTest()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function selectCommandOption(
  user: ReturnType<typeof userEvent.setup>,
  label: string
) {
  const matches = await screen.findAllByText(label)
  const commandMatch = matches.find((node) =>
    node.closest('[data-slot="command-item"]')
  )
  if (!commandMatch) {
    throw new Error(`Expected a command option labelled ${label}`)
  }
  await user.click(commandMatch)
}

const secretLiveValue = 'live-secret-value-should-not-be-indexed'

function buildPlainVariable(
  key: string,
  overrides: Partial<ServiceEnvironmentVariable> = {}
): ServiceEnvironmentVariable {
  return {
    key,
    value: `${key}-value`,
    scope: 'service',
    source: 'service.json',
    ...overrides,
  }
}

function buildVariableService(
  variables: ServiceEnvironmentVariable[]
): DashboardService {
  return {
    id: 'node-sample-service',
    name: 'Node Sample Service',
    status: 'stopped',
    favorite: false,
    role: 'Canonical terminal and logs validation target',
    note: 'Managed process is stopped.',
    installed: true,
    links: [],
    runtimeHealth: {
      state: 'stopped',
      health: 'critical',
      uptime: '0m',
      lastCheckAt: '2026-08-19T08:00:00Z',
      summary: 'Runtime process is stopped.',
    },
    endpoints: [],
    metadata: {
      serviceType: 'sample',
      runtime: 'node',
      version: 'demo',
      build: 'local',
    },
    dependencies: [],
    dependents: [],
    environmentVariables: variables,
    recentLogs: [],
    actions: [],
  }
}

describe('service-detail variable search text', () => {
  it('indexes key, scope, source, and visible values only', () => {
    const plain = buildServiceDetailVariableSearchText({
      key: 'NODE_SAMPLE_PORT',
      value: '4020',
      scope: 'service',
      source: 'service.json',
    })
    const secret = buildServiceDetailVariableSearchText({
      key: 'SAMPLE_TOKEN',
      value: secretLiveValue,
      scope: 'global',
      secret: true,
      source: 'globalenv',
    })

    expect(plain).toContain('node_sample_port')
    expect(plain).toContain('4020')
    expect(plain).toContain('service.json')
    expect(secret).toContain('sample_token')
    expect(secret).toContain('globalenv')
    expect(secret).not.toContain(secretLiveValue.toLowerCase())
  })

  it('keeps masked secret values out of row search text', () => {
    const rows = buildServiceDetailVariableRows([
      {
        key: 'SAMPLE_TOKEN',
        value: secretLiveValue,
        scope: 'service',
        secret: true,
        source: 'globalenv',
      },
    ])

    expect(rows[0]?.searchText).not.toContain(secretLiveValue.toLowerCase())
    expect(rows[0]?.secret).toBe(true)
  })
})

describe('service detail variables operator table', () => {
  it('searches visible values and keeps masked secrets out of the table and search index', async () => {
    const user = userEvent.setup()
    __setStubServicesForTest([
      buildVariableService([
        buildPlainVariable('NODE_SAMPLE_PORT', { value: '4020' }),
        buildPlainVariable('ARCHIVE_HOME', {
          value:
            'D:\\projects\\service-lasso\\workspace\\demo-instance\\archive',
        }),
        {
          key: 'SAMPLE_TOKEN',
          value: secretLiveValue,
          scope: 'service',
          secret: true,
          source: 'globalenv',
        },
      ]),
    ])

    await renderRoute('/services/node-sample-service?tab=variables')

    await waitFor(() => {
      expect(screen.getByText('NODE_SAMPLE_PORT')).toBeVisible()
    })

    expect(screen.getByText('4020')).toBeVisible()
    expect(screen.getAllByText('••••••••').length).toBeGreaterThan(0)
    expect(screen.queryByText(secretLiveValue)).not.toBeInTheDocument()

    const search = screen.getByPlaceholderText(
      /Search keys, visible values, scope, or sources/i
    )
    await user.type(search, '4020')

    await waitFor(() => {
      expect(screen.getByText('NODE_SAMPLE_PORT')).toBeVisible()
    })
    expect(screen.queryByText('ARCHIVE_HOME')).not.toBeInTheDocument()
    expect(screen.queryByText('SAMPLE_TOKEN')).not.toBeInTheDocument()

    await user.clear(search)
    await user.type(search, secretLiveValue)

    await waitFor(() => {
      expect(
        screen.getByText('No variables match the current filters.')
      ).toBeVisible()
    })
    expect(screen.queryByText(secretLiveValue)).not.toBeInTheDocument()
    expect(screen.queryByText('SAMPLE_TOKEN')).not.toBeInTheDocument()
  })

  it('filters by scope and source and paginates the matching rows', async () => {
    const user = userEvent.setup()
    const variables: ServiceEnvironmentVariable[] = [
      ...Array.from({ length: 11 }, (_, index) =>
        buildPlainVariable(`SERVICE_VAR_${String(index + 1).padStart(2, '0')}`)
      ),
      buildPlainVariable('JAVA_HOME', {
        value:
          'D:\\projects\\service-lasso\\workspace\\canonical-services-root\\java',
        scope: 'global',
        source: 'globalenv',
      }),
    ]
    __setStubServicesForTest([buildVariableService(variables)])

    await renderRoute('/services/node-sample-service?tab=variables')

    await waitFor(() => {
      expect(screen.getByText('JAVA_HOME')).toBeVisible()
    })

    const table = screen.getByTestId('service-detail-variables-table')
    expect(table).toHaveClass('flex-1')
    expect(table).toHaveClass('overflow-auto')
    expect(screen.getByRole('button', { name: /next page/i })).toBeVisible()
    expect(screen.getAllByText(/Page 1 of 2/i)[0]).toBeVisible()
    expect(screen.queryByText('SERVICE_VAR_11')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /next page/i }))
    await waitFor(() => {
      expect(screen.getByText('SERVICE_VAR_11')).toBeVisible()
    })
    expect(screen.queryByText('JAVA_HOME')).not.toBeInTheDocument()

    await user.click(screen.getAllByRole('button', { name: /^Scope$/i })[0])
    await selectCommandOption(user, 'Global')

    await waitFor(() => {
      expect(screen.getByText('JAVA_HOME')).toBeVisible()
    })
    expect(screen.queryByText('SERVICE_VAR_01')).not.toBeInTheDocument()
    expect(screen.queryByText('SERVICE_VAR_11')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /reset/i }))
    await user.click(screen.getAllByRole('button', { name: /^Source$/i })[0])
    await selectCommandOption(user, 'globalenv')

    await waitFor(() => {
      expect(screen.getByText('JAVA_HOME')).toBeVisible()
    })
    expect(screen.queryByText('SERVICE_VAR_01')).not.toBeInTheDocument()

    const row = screen.getByText('JAVA_HOME').closest('tr')
    if (!row) {
      throw new Error('Expected a table row for JAVA_HOME')
    }
    expect(
      within(row).getByRole('link', { name: 'View variable' })
    ).toHaveAttribute(
      'href',
      '/variables?service=node-sample-service&key=JAVA_HOME'
    )
    expect(
      within(row).getByRole('button', { name: 'Copy value' })
    ).toBeVisible()
  })
})
