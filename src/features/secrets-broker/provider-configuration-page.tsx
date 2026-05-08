import { useMemo, useState } from 'react'
import {
  DatabaseZap,
  GitBranch,
  KeyRound,
  ShieldCheck,
  Wrench,
} from 'lucide-react'
import { usePageMetadata } from '@/lib/page-metadata'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import {
  configurationSafetyBoundaries,
  migrationPlans,
  providerConfigurations,
  type MigrationState,
  type ProviderState,
} from './provider-configuration'

const providerStateLabels: Record<ProviderState, string> = {
  'local-default': 'No provider configured / local default',
  healthy: 'Provider configured and healthy',
  'auth-required': 'Provider auth required',
  unsupported: 'Provider capability unsupported',
  'validation-failed': 'Validation failed',
}

const migrationStateLabels: Record<MigrationState, string> = {
  'dry-run-ready': 'Migration dry-run ready',
  'dry-run-partial': 'Migration dry-run denied/partial',
  'apply-ready': 'Migration apply ready after confirmation',
  'apply-success': 'Migration success',
  'apply-partial': 'Migration partial failure',
}

export function ProviderConfigurationPage() {
  const [providerState, setProviderState] =
    useState<ProviderState>('local-default')
  const [migrationState, setMigrationState] =
    useState<MigrationState>('dry-run-ready')
  const [auditReason, setAuditReason] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  usePageMetadata({
    title: 'Service Admin - Secrets Broker Configuration',
    description:
      'Safe provider configuration and migration workflow for Secrets Broker using refs, handles, dry-run previews, and audit-gated apply.',
  })

  const provider = providerConfigurations[providerState]
  const migration = migrationPlans[migrationState]
  const applyAllowed = useMemo(
    () => migration.applyEnabled && confirmed && auditReason.trim().length > 0,
    [auditReason, confirmed, migration.applyEnabled]
  )

  return (
    <>
      <Header fixed>
        <Search />
        <div className='ms-auto flex items-center space-x-4'>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main id='content' className='space-y-6'>
        <div className='flex flex-wrap items-start justify-between gap-4'>
          <div>
            <h1 className='flex items-center gap-2 text-2xl font-bold tracking-tight'>
              <Wrench className='size-5' /> Configuration
            </h1>
            <p className='mt-1 text-muted-foreground'>
              Configure a Secrets Broker provider and migrate existing refs with
              safe handles, metadata-only dry-runs, and explicit audit-gated
              apply. Provider credentials and raw secret values are never
              rendered.
            </p>
          </div>
          <Badge variant='secondary'>Handles only · dry-run first</Badge>
        </div>

        <Alert>
          <ShieldCheck className='size-4' />
          <AlertTitle>Provider setup stays secret-safe</AlertTitle>
          <AlertDescription>
            This screen models the #36 backend contract: provider capabilities,
            config status, validation, migration dry-run, and apply responses
            use safe metadata only. Apply remains disabled until confirmation,
            operation id, and audit reason are present.
          </AlertDescription>
        </Alert>

        <div className='grid gap-4 md:grid-cols-4'>
          <Card>
            <CardHeader className='pb-2'>
              <CardDescription>Current provider</CardDescription>
              <CardTitle className='text-xl'>{provider.name}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className='pb-2'>
              <CardDescription>Credential values shown</CardDescription>
              <CardTitle className='text-3xl'>0</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className='pb-2'>
              <CardDescription>Migration items</CardDescription>
              <CardTitle className='text-3xl'>
                {migration.items.length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className='pb-2'>
              <CardDescription>Apply gate</CardDescription>
              <CardTitle className='text-xl'>
                {applyAllowed ? 'ready' : 'locked'}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <KeyRound className='size-4' /> Provider configuration
            </CardTitle>
            <CardDescription>
              Select safe provider states and validate configuration without
              showing or persisting provider credential values.
            </CardDescription>
          </CardHeader>
          <CardContent className='grid gap-4 lg:grid-cols-3'>
            <div className='space-y-2'>
              <label
                htmlFor='provider-state'
                className='text-sm font-medium text-muted-foreground'
              >
                Provider state scenario
              </label>
              <select
                id='provider-state'
                className='h-9 w-full rounded-md border bg-background px-3 text-sm'
                value={providerState}
                onChange={(event) =>
                  setProviderState(event.target.value as ProviderState)
                }
              >
                {Object.entries(providerStateLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <div className='rounded-md border p-3 text-sm'>
                <div className='font-medium'>{provider.status}</div>
                <div className='mt-2 text-muted-foreground'>
                  Next action: {provider.nextAction}
                </div>
              </div>
            </div>

            <div className='space-y-2 text-sm'>
              <div className='font-medium'>
                Current provider/backend summary
              </div>
              <div className='rounded-md border p-3'>
                <div>Provider id: {provider.id}</div>
                <div>Kind: {provider.kind}</div>
                <div>Address/status handle: {provider.address}</div>
                <div>Credential handle: {provider.credentialHandle}</div>
                <div>Namespaces: {provider.namespaces.join(', ')}</div>
                <div>Audit: {provider.auditStatus}</div>
              </div>
            </div>

            <div className='space-y-2 text-sm'>
              <div className='font-medium'>Validation/test connection</div>
              <div className='rounded-md border p-3'>
                <Badge
                  variant={
                    provider.state === 'healthy' ||
                    provider.state === 'local-default'
                      ? 'default'
                      : 'outline'
                  }
                >
                  {provider.state}
                </Badge>
                <p className='mt-3 text-muted-foreground'>
                  Validation sends provider id, kind, address, namespaces, and a
                  credential handle/ref. Plaintext provider credentials are not
                  accepted by this UI.
                </p>
                <Button type='button' className='mt-3' disabled>
                  Test connection preview only
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <DatabaseZap className='size-4' /> Capability summary
            </CardTitle>
            <CardDescription>
              Safe capability metadata from the provider configuration contract.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='flex flex-wrap gap-2'>
              {provider.capabilities.map((capability) => (
                <Badge
                  key={capability.id}
                  variant={capability.supported ? 'default' : 'secondary'}
                >
                  {capability.label}: {capability.supported ? 'yes' : 'no'}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <GitBranch className='size-4' /> Migration dry-run / apply
            </CardTitle>
            <CardDescription>
              Migration plans show refs, source/target provider ids, policy,
              risk, expected action, audit requirement, and recovery guidance —
              never raw secret values.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='grid gap-4 lg:grid-cols-3'>
              <div className='space-y-2'>
                <label
                  htmlFor='migration-state'
                  className='text-sm font-medium text-muted-foreground'
                >
                  Migration state scenario
                </label>
                <select
                  id='migration-state'
                  className='h-9 w-full rounded-md border bg-background px-3 text-sm'
                  value={migrationState}
                  onChange={(event) =>
                    setMigrationState(event.target.value as MigrationState)
                  }
                >
                  {Object.entries(migrationStateLabels).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    )
                  )}
                </select>
              </div>
              <div className='space-y-2'>
                <label
                  htmlFor='audit-reason'
                  className='text-sm font-medium text-muted-foreground'
                >
                  Audit reason
                </label>
                <Input
                  id='audit-reason'
                  value={auditReason}
                  onChange={(event) => setAuditReason(event.target.value)}
                  placeholder='Required before migration apply'
                />
              </div>
              <div className='space-y-2 text-sm'>
                <div className='font-medium text-muted-foreground'>
                  Explicit confirmation
                </div>
                <Button
                  type='button'
                  variant={confirmed ? 'default' : 'outline'}
                  onClick={() => setConfirmed((value) => !value)}
                >
                  {confirmed ? 'Confirmation recorded' : 'Record confirmation'}
                </Button>
              </div>
            </div>

            <div className='rounded-md border p-3 text-sm'>
              <div className='font-medium'>{migration.title}</div>
              <div className='text-muted-foreground'>
                Outcome: {migration.outcome} · Operation id:{' '}
                {migration.operationId} · Source: {migration.sourceProvider} ·
                Target: {migration.targetProvider}
              </div>
              <div className='mt-2'>Next action: {migration.nextAction}</div>
              <div>Rollback/recovery: {migration.rollback}</div>
            </div>

            <div className='overflow-x-auto rounded-md border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Secret ref</TableHead>
                    <TableHead>Source → target</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Policy / risk</TableHead>
                    <TableHead>Recovery</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {migration.items.map((item) => (
                    <TableRow key={`${migration.state}-${item.ref}`}>
                      <TableCell className='min-w-80 align-top'>
                        <div className='font-medium'>{item.owner}</div>
                        <div className='break-all text-muted-foreground'>
                          {item.ref}
                        </div>
                      </TableCell>
                      <TableCell className='align-top'>
                        {item.source} → {item.target}
                      </TableCell>
                      <TableCell className='align-top'>
                        <Badge variant='outline'>{item.state}</Badge>
                        <div className='mt-2 text-sm text-muted-foreground'>
                          {item.expectedAction}
                        </div>
                      </TableCell>
                      <TableCell className='align-top'>
                        <div>Policy: {item.policyResult}</div>
                        <div>Risk: {item.risk}</div>
                        <div>Audit: {item.auditRequirement}</div>
                      </TableCell>
                      <TableCell className='min-w-64 align-top text-sm text-muted-foreground'>
                        {item.recovery}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className='flex flex-wrap gap-2'>
              <Button type='button' disabled={!applyAllowed}>
                {applyAllowed
                  ? 'Migration apply ready'
                  : 'Migration apply disabled until confirmation and audit reason'}
              </Button>
              <Badge variant='secondary'>Raw values hidden</Badge>
              <Badge variant='outline'>Provider credentials hidden</Badge>
              <Badge variant='outline'>No spreadsheet plaintext editing</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Safety boundaries</CardTitle>
            <CardDescription>
              Guardrails for provider configuration and migration.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className='list-disc space-y-2 ps-5 text-sm text-muted-foreground'>
              {configurationSafetyBoundaries.map((boundary) => (
                <li key={boundary}>{boundary}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
