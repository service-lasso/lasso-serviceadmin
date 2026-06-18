import { useMemo, useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { DatabaseZap, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react'
import { usePageMetadata } from '@/lib/page-metadata'
import { isServiceAdminStubModeEnabled } from '@/lib/service-lasso-dashboard/stub'
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
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import {
  buildSecretInventoryOperationPreview,
  countSecretInventoryByState,
  secretInventoryBoundaries,
  secretInventoryRows,
  type SecretInventoryOperation,
  type SecretInventoryOperationState,
} from './secret-inventory'
import { SecretInventoryTable } from './secret-inventory-table'

const route = getRouteApi('/_authenticated/secrets-broker/secret-inventory')

export function SecretInventoryPage() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const stubModeEnabled = isServiceAdminStubModeEnabled()
  const counts = countSecretInventoryByState()
  const [selectedRowId, setSelectedRowId] = useState(secretInventoryRows[0].id)
  const [selectedOperation, setSelectedOperation] =
    useState<SecretInventoryOperation>('rotate')
  const [operationState, setOperationState] =
    useState<SecretInventoryOperationState>('preview-ready')
  const [auditReason, setAuditReason] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const selectedRow =
    secretInventoryRows.find((row) => row.id === selectedRowId) ??
    secretInventoryRows[0]
  const operationPreview = useMemo(
    () =>
      buildSecretInventoryOperationPreview(
        selectedRow,
        selectedOperation,
        auditReason,
        confirmation,
        operationState
      ),
    [auditReason, confirmation, operationState, selectedOperation, selectedRow]
  )

  function selectOperation(rowId: string, operation: SecretInventoryOperation) {
    setSelectedRowId(rowId)
    setSelectedOperation(operation)
    setOperationState('preview-ready')
    setAuditReason('')
    setConfirmation('')
  }

  usePageMetadata({
    title: 'Service Admin - Secret Inventory',
    description:
      'Metadata-only Secrets Broker inventory for refs, ownership, state, and rotation planning.',
  })

  if (!stubModeEnabled) {
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
                <DatabaseZap className='size-5' /> Secret inventory
              </h1>
              <p className='mt-1 text-muted-foreground'>
                Advanced Secrets Broker planning view for ref metadata,
                ownership, state, expiry, and rotation readiness.
              </p>
            </div>
            <Badge variant='outline'>Live API required</Badge>
          </div>

          <Alert>
            <ShieldCheck className='size-4' />
            <AlertTitle>Secret inventory unavailable</AlertTitle>
            <AlertDescription>
              No local sample metadata is rendered because Service Admin stub
              mode is disabled. Connect a live inventory API or enable the
              explicit local developer stub flag for fixture previews.
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle>Metadata table unavailable</CardTitle>
              <CardDescription>
                The live inventory API is not connected in this UI build, so
                local fixture rows and planning-only sample metadata stay hidden
                by default.
              </CardDescription>
            </CardHeader>
            <CardContent className='flex flex-wrap gap-2 text-sm text-muted-foreground'>
              <Badge variant='outline'>No fixture rows</Badge>
              <Badge variant='outline'>No sample metadata</Badge>
              <Badge variant='outline'>No privileged actions</Badge>
            </CardContent>
          </Card>
        </Main>
      </>
    )
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
              <DatabaseZap className='size-5' /> Secret inventory
            </h1>
            <p className='mt-1 text-muted-foreground'>
              Advanced Secrets Broker planning view for ref metadata, ownership,
              state, expiry, and rotation readiness. This local fixture table is
              metadata-first and never resolves, displays, copies, exports,
              logs, or mutates secret values.
            </p>
          </div>
          <Badge variant='secondary'>Broker preview fixture</Badge>
        </div>

        <Alert>
          <ShieldCheck className='size-4' />
          <AlertTitle>No plaintext values</AlertTitle>
          <AlertDescription>
            This is not a password vault and it does not include raw reveal,
            clipboard, edit, bulk rotation, or spreadsheet controls. Single-row
            rotate/delete actions stay behind broker preview, audit reason, and
            exact ref confirmation gates.
          </AlertDescription>
        </Alert>

        <div className='grid gap-4 md:grid-cols-5'>
          <Card>
            <CardHeader className='pb-2'>
              <CardDescription>Total refs</CardDescription>
              <CardTitle className='text-3xl'>
                {secretInventoryRows.length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className='pb-2'>
              <CardDescription>Present</CardDescription>
              <CardTitle className='text-3xl'>{counts.present}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className='pb-2'>
              <CardDescription>Rotation due</CardDescription>
              <CardTitle className='text-3xl'>
                {counts['rotation-due']}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className='pb-2'>
              <CardDescription>Stale</CardDescription>
              <CardTitle className='text-3xl'>{counts.stale}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className='pb-2'>
              <CardDescription>Missing</CardDescription>
              <CardTitle className='text-3xl'>{counts.missing}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Metadata-first ref table</CardTitle>
            <CardDescription>
              Rows are deterministic sample data for planning large inventory
              behavior. Secret payloads are deliberately absent; row actions
              only model broker-backed preview metadata.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SecretInventoryTable
              data={secretInventoryRows}
              search={search}
              navigate={navigate}
              onSelectOperation={(row, operation) =>
                selectOperation(row.id, operation)
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              {selectedOperation === 'rotate' ? (
                <RotateCcw className='size-4' />
              ) : (
                <Trash2 className='size-4' />
              )}
              {operationPreview.title}
            </CardTitle>
            <CardDescription>
              Single-row broker operation preview. The selected ref must be
              confirmed exactly, and the UI still never receives raw secret
              material.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4 text-sm'>
            <div className='grid gap-4 lg:grid-cols-3'>
              <div className='rounded-md border p-3'>
                <div className='text-xs font-medium text-muted-foreground uppercase'>
                  Selected ref
                </div>
                <div className='mt-1 font-medium break-all'>
                  {selectedRow.refId}
                </div>
                <div className='mt-1 text-muted-foreground'>
                  {selectedRow.owningService} · {selectedRow.source}
                </div>
              </div>
              <div className='rounded-md border p-3'>
                <label
                  htmlFor='inventory-operation'
                  className='text-xs font-medium text-muted-foreground uppercase'
                >
                  Operation
                </label>
                <select
                  id='inventory-operation'
                  className='mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm'
                  value={selectedOperation}
                  onChange={(event) =>
                    setSelectedOperation(
                      event.target.value as SecretInventoryOperation
                    )
                  }
                >
                  <option value='rotate'>Rotate without reveal</option>
                  <option value='delete'>Delete without reveal</option>
                </select>
              </div>
              <div className='rounded-md border p-3'>
                <label
                  htmlFor='inventory-operation-state'
                  className='text-xs font-medium text-muted-foreground uppercase'
                >
                  Broker preview state
                </label>
                <select
                  id='inventory-operation-state'
                  className='mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm'
                  value={operationState}
                  onChange={(event) =>
                    setOperationState(
                      event.target.value as SecretInventoryOperationState
                    )
                  }
                >
                  <option value='preview-ready'>
                    Derived from selected ref
                  </option>
                  <option value='unsupported'>Unsupported capability</option>
                  <option value='policy-denied'>Policy denied</option>
                  <option value='auth-required'>Provider auth required</option>
                  <option value='missing'>Missing ref</option>
                  <option value='success'>Preview success</option>
                  <option value='failure'>Preview failure</option>
                </select>
              </div>
            </div>

            <div className='grid gap-4 lg:grid-cols-2'>
              <div className='space-y-3'>
                <div className='space-y-2'>
                  <label
                    htmlFor='inventory-audit-reason'
                    className='text-sm font-medium text-muted-foreground'
                  >
                    Audit reason
                  </label>
                  <Input
                    id='inventory-audit-reason'
                    value={auditReason}
                    onChange={(event) => setAuditReason(event.target.value)}
                    placeholder='Required before preview is recorded'
                  />
                </div>
                <div className='space-y-2'>
                  <label
                    htmlFor='inventory-confirm-ref'
                    className='text-sm font-medium text-muted-foreground'
                  >
                    Confirm exact ref id
                  </label>
                  <Input
                    id='inventory-confirm-ref'
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    placeholder={selectedRow.refId}
                  />
                </div>
              </div>

              <div className='rounded-md border p-3'>
                <div className='mb-2 flex flex-wrap items-center gap-2'>
                  <Badge variant='outline'>{operationPreview.badge}</Badge>
                  <Badge variant='secondary'>No raw values</Badge>
                </div>
                <dl className='grid gap-2'>
                  <div>
                    <dt className='text-muted-foreground'>Capability</dt>
                    <dd>{operationPreview.capabilityResult}</dd>
                  </div>
                  <div>
                    <dt className='text-muted-foreground'>Policy</dt>
                    <dd>{operationPreview.policyResult}</dd>
                  </div>
                  <div>
                    <dt className='text-muted-foreground'>Audit</dt>
                    <dd>{operationPreview.auditRequirement}</dd>
                  </div>
                  <div>
                    <dt className='text-muted-foreground'>Apply status</dt>
                    <dd>{operationPreview.applyStatus}</dd>
                  </div>
                </dl>
              </div>
            </div>

            <div className='rounded-md border bg-muted/40 p-3'>
              <div className='text-xs font-medium text-muted-foreground uppercase'>
                Metadata-only preview diff
              </div>
              <ul className='mt-2 list-disc space-y-1 ps-5 text-muted-foreground'>
                {operationPreview.safeDiff.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <div className='mt-3 rounded-md border bg-background p-3'>
                {operationPreview.nextStep}
              </div>
            </div>

            <div className='flex flex-wrap gap-2'>
              <Button
                type='button'
                disabled={!operationPreview.canRecordPreview}
              >
                Record broker operation preview
              </Button>
              <Button
                type='button'
                variant='outline'
                onClick={() => {
                  setAuditReason('')
                  setConfirmation('')
                  setOperationState('preview-ready')
                }}
              >
                Clear preview
              </Button>
              <Badge variant='outline'>No reveal</Badge>
              <Badge variant='outline'>No copy/export</Badge>
              <Badge variant='outline'>Single ref only</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Safety boundaries</CardTitle>
            <CardDescription>
              Guardrails for keeping this inventory metadata-only and separate
              from privileged reveal or mutation workflows.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className='list-disc space-y-2 ps-5 text-sm text-muted-foreground'>
              {secretInventoryBoundaries.map((boundary) => (
                <li key={boundary}>{boundary}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
