import { useMemo, useState } from 'react'
import {
  DatabaseZap,
  Eye,
  RotateCcw,
  SearchIcon,
  ShieldCheck,
  SlidersHorizontal,
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
  buildManagedSecretActionPreview,
  buildStubSecretMutationPreview,
  filterManagedSecrets,
  managedSecretRows,
  managedSecretSafetyBoundaries,
  stubSecretMutationStates,
  valueSearchManagedSecrets,
  type ManagedSecretAction,
  type ManagedSecretState,
  type StubSecretMutationState,
} from './secrets-management'

const stateVariant: Record<
  ManagedSecretState,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  present: 'default',
  missing: 'destructive',
  stale: 'secondary',
  'rotation-due': 'outline',
}

export function SecretsManagementPage() {
  const [metadataQuery, setMetadataQuery] = useState('')
  const [stateFilter, setStateFilter] = useState<ManagedSecretState | 'all'>(
    'all'
  )
  const [valueQuery, setValueQuery] = useState('')
  const [valueSearchSupported, setValueSearchSupported] = useState(false)
  const [selectedRowId, setSelectedRowId] = useState(managedSecretRows[0].id)
  const [selectedAction, setSelectedAction] =
    useState<ManagedSecretAction>('metadata')
  const [stubState, setStubState] = useState<StubSecretMutationState>('ready')
  const [auditReason, setAuditReason] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  usePageMetadata({
    title: 'Service Admin - Secrets Broker Secrets',
    description:
      'Searchable metadata-first Secrets Broker management table for controlled reveal, dry-run edit/reset, and policy preview actions.',
  })

  const filteredRows = useMemo(
    () => filterManagedSecrets(managedSecretRows, metadataQuery, stateFilter),
    [metadataQuery, stateFilter]
  )
  const valueSearchRows = useMemo(
    () =>
      valueSearchManagedSecrets(
        managedSecretRows,
        valueQuery,
        valueSearchSupported
      ),
    [valueQuery, valueSearchSupported]
  )
  const selectedRow =
    managedSecretRows.find((row) => row.id === selectedRowId) ??
    managedSecretRows[0]
  const actionPreview = buildManagedSecretActionPreview(
    selectedRow,
    selectedAction
  )
  const stubMutationPreview = buildStubSecretMutationPreview(
    selectedRow,
    selectedAction === 'metadata' || selectedAction === 'policy'
      ? 'edit'
      : selectedAction,
    stubState,
    auditReason,
    confirmed
  )

  function chooseAction(rowId: string, action: ManagedSecretAction) {
    setSelectedRowId(rowId)
    setSelectedAction(action)
  }

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
              <DatabaseZap className='size-5' /> Secrets
            </h1>
            <p className='mt-1 text-muted-foreground'>
              Secrets Broker management table for safe metadata search,
              controlled reveal entry, and dry-run edit/reset/policy actions.
              Rows never render raw secret values.
            </p>
          </div>
          <Badge variant='secondary'>Stub preview · values hidden</Badge>
        </div>

        <Alert>
          <ShieldCheck className='size-4' />
          <AlertTitle>Controlled management surface</AlertTitle>
          <AlertDescription>
            Metadata search is local over safe refs and labels only.
            Broker-backed value search, when supported, returns matching
            refs/metadata only. Reveal delegates to the audited #38 pattern;
            edit, reset, and policy changes require dry-run/preview before
            apply. The mutation API on this page is stubbed preview behavior
            until the production Secrets Broker contract lands.
          </AlertDescription>
        </Alert>

        <div className='grid gap-4 md:grid-cols-4'>
          <Card>
            <CardHeader className='pb-2'>
              <CardDescription>Total refs</CardDescription>
              <CardTitle className='text-3xl'>
                {managedSecretRows.length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className='pb-2'>
              <CardDescription>Visible values</CardDescription>
              <CardTitle className='text-3xl'>0</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className='pb-2'>
              <CardDescription>Dry-run actions</CardDescription>
              <CardTitle className='text-3xl'>3</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className='pb-2'>
              <CardDescription>Bulk mutations</CardDescription>
              <CardTitle className='text-3xl'>0</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <SearchIcon className='size-4' /> Search and value-search posture
            </CardTitle>
            <CardDescription>
              Metadata search never reads plaintext. Value search is explicitly
              broker-backed and returns refs/metadata only when supported.
            </CardDescription>
          </CardHeader>
          <CardContent className='grid gap-4 lg:grid-cols-2'>
            <div className='space-y-2'>
              <label
                htmlFor='metadata-search'
                className='text-sm font-medium text-muted-foreground'
              >
                Metadata search
              </label>
              <Input
                id='metadata-search'
                value={metadataQuery}
                onChange={(event) => setMetadataQuery(event.target.value)}
                placeholder='Search ref, owner, provider, tag, workspace'
              />
              <div className='max-w-xs'>
                <label
                  htmlFor='state-filter'
                  className='mb-1 block text-xs text-muted-foreground'
                >
                  State filter
                </label>
                <select
                  id='state-filter'
                  className='h-9 w-full rounded-md border bg-background px-3 text-sm'
                  value={stateFilter}
                  onChange={(event) =>
                    setStateFilter(
                      event.target.value as ManagedSecretState | 'all'
                    )
                  }
                >
                  <option value='all'>All states</option>
                  <option value='present'>Present</option>
                  <option value='rotation-due'>Rotation due</option>
                  <option value='stale'>Stale</option>
                  <option value='missing'>Missing</option>
                </select>
              </div>
              <div className='text-sm text-muted-foreground'>
                Metadata matches: {filteredRows.length}
              </div>
            </div>

            <div className='space-y-2'>
              <label
                htmlFor='value-search'
                className='text-sm font-medium text-muted-foreground'
              >
                Broker-backed value search
              </label>
              <Input
                id='value-search'
                value={valueQuery}
                onChange={(event) => setValueQuery(event.target.value)}
                placeholder='Broker receives search request; UI receives refs only'
              />
              <div className='flex flex-wrap gap-2'>
                <Button
                  type='button'
                  variant={valueSearchSupported ? 'default' : 'outline'}
                  onClick={() => setValueSearchSupported(true)}
                >
                  Simulate supported value search
                </Button>
                <Button
                  type='button'
                  variant={!valueSearchSupported ? 'default' : 'outline'}
                  onClick={() => setValueSearchSupported(false)}
                >
                  Simulate unsupported value search
                </Button>
              </div>
              <div className='rounded-md border p-3 text-sm'>
                {valueSearchSupported ? (
                  <div>
                    Value search supported: {valueSearchRows.length} safe ref
                    metadata match
                    {valueSearchRows.length === 1 ? '' : 'es'} returned; raw
                    values are never returned to the table.
                  </div>
                ) : (
                  <div>
                    Value search unsupported by this broker/source; the table
                    fails closed and keeps raw values hidden.
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Secrets management table</CardTitle>
            <CardDescription>
              Searchable safe metadata rows with controlled row actions. Apply
              controls are represented as dry-run/preview states, not direct
              mutation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='overflow-x-auto rounded-md border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Secret ref</TableHead>
                    <TableHead>Owner / provider</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Policy / audit</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className='min-w-80 align-top'>
                        <div className='font-medium'>{row.name}</div>
                        <div className='text-sm break-all text-muted-foreground'>
                          {row.ref}
                        </div>
                        <div className='mt-2 flex flex-wrap gap-1'>
                          {row.safeTags.map((tag) => (
                            <Badge key={tag} variant='outline'>
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className='min-w-56 align-top'>
                        <div className='font-medium'>{row.owningService}</div>
                        <div className='text-sm text-muted-foreground'>
                          {row.provider} · {row.source}
                        </div>
                        <div className='text-xs text-muted-foreground'>
                          {row.workspace}
                        </div>
                      </TableCell>
                      <TableCell className='min-w-48 align-top'>
                        <Badge variant={stateVariant[row.state]}>
                          {row.state}
                        </Badge>
                        <div className='mt-2 text-sm'>{row.rotationStatus}</div>
                        <div className='text-xs text-muted-foreground'>
                          Updated: {row.lastUpdatedAt}
                        </div>
                      </TableCell>
                      <TableCell className='min-w-64 align-top text-sm'>
                        <div className='break-all'>{row.policy}</div>
                        <div className='mt-2 text-muted-foreground'>
                          {row.auditStatus}
                        </div>
                        <div className='text-xs text-muted-foreground'>
                          Capability: {row.backendCapability}
                        </div>
                      </TableCell>
                      <TableCell className='min-w-72 align-top'>
                        <div className='flex flex-wrap gap-2'>
                          <Button
                            type='button'
                            size='sm'
                            variant='outline'
                            onClick={() => chooseAction(row.id, 'metadata')}
                          >
                            View metadata
                          </Button>
                          <Button
                            type='button'
                            size='sm'
                            variant='outline'
                            onClick={() => chooseAction(row.id, 'reveal')}
                          >
                            Controlled reveal
                          </Button>
                          <Button
                            type='button'
                            size='sm'
                            variant='outline'
                            onClick={() => chooseAction(row.id, 'edit')}
                          >
                            Edit/update dry-run
                          </Button>
                          <Button
                            type='button'
                            size='sm'
                            variant='outline'
                            onClick={() => chooseAction(row.id, 'reset')}
                          >
                            Reset/rotate dry-run
                          </Button>
                          <Button
                            type='button'
                            size='sm'
                            variant='outline'
                            onClick={() => chooseAction(row.id, 'policy')}
                          >
                            Apply policy preview
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              {actionPreview.action === 'reveal' ? (
                <Eye className='size-4' />
              ) : actionPreview.action === 'reset' ? (
                <RotateCcw className='size-4' />
              ) : (
                <SlidersHorizontal className='size-4' />
              )}
              {actionPreview.title}
            </CardTitle>
            <CardDescription>
              Selected row action preview. No apply occurs from this table
              without dry-run, audit reason, and explicit confirmation.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-3 text-sm'>
            <Badge
              variant={
                actionPreview.requiresConfirmation ? 'outline' : 'secondary'
              }
            >
              {actionPreview.status}
            </Badge>
            <p>{actionPreview.preview}</p>
            <div className='rounded-md border bg-muted/40 p-3'>
              <div className='text-xs font-medium text-muted-foreground uppercase'>
                Next step
              </div>
              <div>{actionPreview.nextStep}</div>
            </div>
            <div className='flex flex-wrap gap-2'>
              <Button type='button' disabled>
                Apply disabled until dry-run preview is accepted
              </Button>
              <Badge variant='secondary'>Raw values hidden</Badge>
              <Badge variant='outline'>No copy/export</Badge>
              <Badge variant='outline'>No bulk mutation</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Stub update/reset/reveal API preview</CardTitle>
            <CardDescription>
              Deterministic non-production status model for a single selected
              secret. This previews the operator flow only; no secret material
              is read, written, copied, exported, logged, or displayed.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4 text-sm'>
            <div className='grid gap-4 lg:grid-cols-3'>
              <div className='rounded-lg border p-3'>
                <div className='text-xs font-medium text-muted-foreground uppercase'>
                  Selected ref
                </div>
                <div className='mt-1 font-medium break-all'>
                  {selectedRow.ref}
                </div>
              </div>
              <div className='rounded-lg border p-3'>
                <label
                  htmlFor='stub-state'
                  className='text-xs font-medium text-muted-foreground uppercase'
                >
                  Stub API state
                </label>
                <select
                  id='stub-state'
                  className='mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm'
                  value={stubState}
                  onChange={(event) =>
                    setStubState(event.target.value as StubSecretMutationState)
                  }
                >
                  {stubSecretMutationStates.map((state) => (
                    <option key={state.id} value={state.id}>
                      {state.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className='rounded-lg border p-3'>
                <div className='text-xs font-medium text-muted-foreground uppercase'>
                  Apply readiness
                </div>
                <Badge
                  className='mt-2'
                  variant={
                    stubMutationPreview.canApply ? 'default' : 'secondary'
                  }
                >
                  {stubMutationPreview.canApply
                    ? 'Stub apply can be simulated'
                    : 'Stub apply blocked'}
                </Badge>
              </div>
            </div>

            <div className='grid gap-4 lg:grid-cols-2'>
              <div className='space-y-2'>
                <label
                  htmlFor='audit-reason'
                  className='text-sm font-medium text-muted-foreground'
                >
                  Audit reason for stub preview
                </label>
                <Input
                  id='audit-reason'
                  value={auditReason}
                  onChange={(event) => setAuditReason(event.target.value)}
                  placeholder='Required before simulated apply; no secret values'
                />
                <label className='flex items-center gap-2 text-sm'>
                  <input
                    type='checkbox'
                    checked={confirmed}
                    onChange={(event) => setConfirmed(event.target.checked)}
                  />
                  I confirm this is a stub preview and no production mutation
                  will be performed.
                </label>
              </div>
              <div className='rounded-lg border p-3'>
                <div className='mb-2 flex flex-wrap items-center gap-2'>
                  <Badge variant='outline'>{stubMutationPreview.badge}</Badge>
                  <Badge variant='secondary'>Stub API · preview only</Badge>
                </div>
                <div className='font-medium'>{stubMutationPreview.title}</div>
                <dl className='mt-3 grid gap-2 text-sm'>
                  <div>
                    <dt className='text-muted-foreground'>Dry-run status</dt>
                    <dd>{stubMutationPreview.dryRunStatus}</dd>
                  </div>
                  <div>
                    <dt className='text-muted-foreground'>Apply status</dt>
                    <dd>{stubMutationPreview.applyStatus}</dd>
                  </div>
                  <div>
                    <dt className='text-muted-foreground'>Policy decision</dt>
                    <dd>{stubMutationPreview.policyDecision}</dd>
                  </div>
                  <div>
                    <dt className='text-muted-foreground'>Audit requirement</dt>
                    <dd>{stubMutationPreview.auditRequirement}</dd>
                  </div>
                </dl>
              </div>
            </div>

            <div className='rounded-lg border p-3'>
              <div className='text-xs font-medium text-muted-foreground uppercase'>
                Metadata-only dry-run diff
              </div>
              <ul className='mt-2 list-disc space-y-1 ps-5 text-muted-foreground'>
                {stubMutationPreview.safeDiff.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <div className='mt-3 rounded-md border bg-muted/40 p-3'>
                {stubMutationPreview.nextStep}
              </div>
            </div>

            <div className='flex flex-wrap gap-2'>
              <Button type='button' disabled={!stubMutationPreview.canApply}>
                Simulate stub apply
              </Button>
              <Button
                type='button'
                variant='outline'
                onClick={() => {
                  setAuditReason('')
                  setConfirmed(false)
                  setStubState('cancelled')
                }}
              >
                Cancel stub preview
              </Button>
              <Badge variant='outline'>No plaintext editing</Badge>
              <Badge variant='outline'>Single-secret only</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Safety boundaries</CardTitle>
            <CardDescription>
              Guardrails for this Secrets sub-page while the backend API
              contract and single-connection workflows mature.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className='list-disc space-y-2 ps-5 text-sm text-muted-foreground'>
              {managedSecretSafetyBoundaries.map((boundary) => (
                <li key={boundary}>{boundary}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
