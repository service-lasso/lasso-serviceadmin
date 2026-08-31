import { Fragment, useState } from 'react'
import {
  Ban,
  MoreHorizontal,
  RefreshCw,
  Settings,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import {
  evaluateProviderRowAction,
  pendingProviderActionResult,
} from '@/lib/service-lasso-dashboard/broker-provider-actions'
import {
  useBrokerProviderRowAction,
  useBrokerProviderStatus,
  useBrokerProviderValidation,
  useRuntimeIdentity,
} from '@/lib/service-lasso-dashboard/hooks'
import {
  providerSupportsMigrationApply,
  serviceLassoStubDataEnabled,
} from '@/lib/service-lasso-dashboard/stub'
import type {
  BrokerProviderActionResult,
  BrokerProviderRowActionName,
  BrokerProviderStatus,
  BrokerProviderValidationResult,
} from '@/lib/service-lasso-dashboard/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'

const ROW_ACTIONS: Array<{
  action: BrokerProviderRowActionName
  label: string
}> = [
  { action: 'status', label: 'Refresh status' },
  { action: 'capabilities', label: 'Config / capabilities' },
  { action: 'validate', label: 'Test connection' },
  { action: 'reconnect', label: 'Reconnect / reauth' },
  { action: 'configure-dry-run', label: 'Configuration dry-run' },
  { action: 'configure-apply', label: 'Configuration apply' },
  { action: 'disable', label: 'Disable provider' },
  { action: 'remove', label: 'Remove provider' },
]

function ProviderOutcomeBadge({ outcome }: { outcome: string }) {
  if (outcome === 'ready') {
    return <Badge className='bg-emerald-600 hover:bg-emerald-600'>ready</Badge>
  }
  if (
    outcome === 'policy_denied' ||
    outcome === 'source_auth_required' ||
    outcome === 'locked' ||
    outcome === 'audit_unavailable'
  ) {
    return <Badge variant='destructive'>{outcome}</Badge>
  }
  return <Badge variant='secondary'>{outcome}</Badge>
}

function phaseBadgeVariant(
  phase: BrokerProviderActionResult['phase']
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (phase === 'success') return 'default'
  if (phase === 'pending') return 'secondary'
  if (phase === 'blocked') return 'outline'
  return 'destructive'
}

/**
 * Secrets Broker > Providers table with live, row-scoped actions.
 */
export function SecretsBrokerProvidersPanel() {
  const identity = useRuntimeIdentity()
  const canManageSecrets = Boolean(
    identity.data?.permissions.includes('*') ||
    identity.data?.permissions.includes('security:manage')
  )
  const providerQuery = useBrokerProviderStatus()
  const validateProvider = useBrokerProviderValidation()
  const rowAction = useBrokerProviderRowAction()
  const [providerValidationTarget, setProviderValidationTarget] =
    useState<BrokerProviderStatus | null>(null)
  const [providerAddress, setProviderAddress] = useState('')
  const [providerCredentialRef, setProviderCredentialRef] = useState('')
  const [providerNamespaces, setProviderNamespaces] = useState('')
  const [providerValidationReason, setProviderValidationReason] = useState('')
  const [providerValidationResult, setProviderValidationResult] =
    useState<BrokerProviderValidationResult | null>(null)
  const [providerValidationError, setProviderValidationError] = useState<
    string | null
  >(null)
  const [activeProviderId, setActiveProviderId] = useState<string | null>(null)
  const [rowResult, setRowResult] = useState<BrokerProviderActionResult | null>(
    null
  )
  const [applyConfirmProviderId, setApplyConfirmProviderId] = useState<
    string | null
  >(null)
  const [applyConfirmed, setApplyConfirmed] = useState(false)

  const openProviderValidation = (provider: BrokerProviderStatus) => {
    setProviderValidationTarget(provider)
    setProviderAddress(provider.address ?? '')
    setProviderCredentialRef(provider.credentialHandle ?? '')
    setProviderNamespaces(provider.namespaces.join(', '))
    setProviderValidationReason('')
    setProviderValidationResult(null)
    setProviderValidationError(null)
    validateProvider.reset()
  }

  const closeProviderValidation = (open: boolean) => {
    if (open) return
    setProviderValidationTarget(null)
    setProviderAddress('')
    setProviderCredentialRef('')
    setProviderNamespaces('')
    setProviderValidationReason('')
    setProviderValidationResult(null)
    setProviderValidationError(null)
    validateProvider.reset()
  }

  const runProviderValidation = async () => {
    if (!providerValidationTarget) return
    if (!providerValidationReason.trim()) {
      setProviderValidationError(
        'Audit reason is required before provider validation.'
      )
      return
    }
    setProviderValidationError(null)
    setProviderValidationResult(null)
    try {
      const result = await validateProvider.mutateAsync({
        providerId: providerValidationTarget.providerId,
        providerKind: providerValidationTarget.providerKind,
        displayName: providerValidationTarget.displayName,
        address: providerAddress.trim() || undefined,
        credentialRef: providerCredentialRef.trim() || undefined,
        namespaces: providerNamespaces
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
        reason: providerValidationReason.trim(),
      })
      if (
        !['ready', 'degraded', 'source_auth_required', 'unsupported'].includes(
          result.outcome
        ) ||
        result.applied ||
        result.auditStatus !== 'audit_recorded'
      ) {
        throw new Error('Provider validation returned an invalid contract.')
      }
      setProviderValidationResult(result)
    } catch {
      setProviderValidationError(
        'Provider validation failed closed. Verify the safe origin, credential reference, Broker readiness, and audit sink.'
      )
    }
  }

  const runRowAction = async (
    provider: BrokerProviderStatus,
    action: BrokerProviderRowActionName,
    confirm = false
  ) => {
    if (action === 'configure-apply' && !confirm) {
      setActiveProviderId(provider.providerId)
      setApplyConfirmProviderId(provider.providerId)
      setApplyConfirmed(false)
      setRowResult(null)
      return
    }
    setActiveProviderId(provider.providerId)
    setApplyConfirmProviderId(null)
    setRowResult(
      pendingProviderActionResult(
        { action, provider },
        serviceLassoStubDataEnabled
      )
    )
    const result = await rowAction.mutateAsync({
      action,
      provider,
      confirm,
      address: provider.address,
      credentialRef: provider.credentialHandle,
      namespaces: provider.namespaces,
    })
    setRowResult(result)
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Secret providers</CardTitle>
          <CardDescription>
            Live Broker connection and executable-operation metadata. Browser
            code never receives provider credentials.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {providerQuery.isLoading ? (
            <Skeleton className='h-24 w-full' />
          ) : null}
          {providerQuery.isError ? (
            <div className='rounded-md border border-destructive/40 p-3 text-sm text-destructive'>
              Provider status is unavailable; migration remains disabled.
            </div>
          ) : null}
          {providerQuery.data ? (
            <div className='overflow-x-auto rounded-md border'>
              <Table data-testid='secret-providers-table'>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Credential</TableHead>
                    <TableHead>Migration apply</TableHead>
                    <TableHead>Audit</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {providerQuery.data.providers.map((provider) => (
                    <Fragment key={provider.providerId}>
                      <TableRow
                        data-testid={`provider-row-${provider.providerId}`}
                      >
                        <TableCell>
                          <div className='font-medium'>
                            {provider.displayName}
                          </div>
                          <div className='font-mono text-xs text-muted-foreground'>
                            {provider.providerId} · {provider.providerKind}
                          </div>
                        </TableCell>
                        <TableCell>
                          <ProviderOutcomeBadge outcome={provider.outcome} />
                        </TableCell>
                        <TableCell>
                          {provider.credentialHandle ?? 'not configured'}
                        </TableCell>
                        <TableCell>
                          {providerSupportsMigrationApply(provider)
                            ? 'validated'
                            : 'unavailable'}
                        </TableCell>
                        <TableCell>{provider.auditStatus}</TableCell>
                        <TableCell>
                          <div className='flex flex-wrap gap-2'>
                            <Button
                              type='button'
                              size='sm'
                              variant='outline'
                              disabled={!canManageSecrets}
                              onClick={() => openProviderValidation(provider)}
                            >
                              Validate configuration
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  type='button'
                                  size='sm'
                                  variant='outline'
                                  disabled={!canManageSecrets}
                                  title={`Provider actions for ${provider.displayName}`}
                                >
                                  <MoreHorizontal className='size-4' /> Actions
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align='end' className='w-72'>
                                {ROW_ACTIONS.map((item) => {
                                  const gate = evaluateProviderRowAction({
                                    action: item.action,
                                    provider,
                                  })
                                  const destructive =
                                    item.action === 'disable' ||
                                    item.action === 'remove'
                                  return (
                                    <DropdownMenuItem
                                      key={item.action}
                                      variant={
                                        destructive ? 'destructive' : 'default'
                                      }
                                      onSelect={() =>
                                        void runRowAction(provider, item.action)
                                      }
                                    >
                                      {item.action === 'validate' ? (
                                        <ShieldCheck className='size-4' />
                                      ) : null}
                                      {item.action === 'reconnect' ? (
                                        <RefreshCw className='size-4' />
                                      ) : null}
                                      {item.action === 'configure-dry-run' ||
                                      item.action === 'configure-apply' ? (
                                        <Settings className='size-4' />
                                      ) : null}
                                      {item.action === 'disable' ? (
                                        <Ban className='size-4' />
                                      ) : null}
                                      {item.action === 'remove' ? (
                                        <Trash2 className='size-4' />
                                      ) : null}
                                      <span className='flex min-w-0 flex-col'>
                                        <span>{item.label}</span>
                                        {!gate.enabled ? (
                                          <span className='text-xs whitespace-normal text-muted-foreground'>
                                            {gate.summary}
                                          </span>
                                        ) : null}
                                      </span>
                                    </DropdownMenuItem>
                                  )
                                })}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                      {activeProviderId === provider.providerId &&
                      (rowResult ||
                        applyConfirmProviderId === provider.providerId) ? (
                        <TableRow>
                          <TableCell colSpan={6}>
                            <section
                              aria-label='Provider action detail'
                              data-testid={`provider-action-result-${provider.providerId}`}
                              className='rounded-md border bg-muted/20 p-4'
                            >
                              {applyConfirmProviderId ===
                              provider.providerId ? (
                                <div className='space-y-3'>
                                  <div className='font-medium'>
                                    Configuration apply metadata
                                  </div>
                                  <p className='text-sm text-muted-foreground'>
                                    Apply uses the current handle-only provider
                                    metadata. Secret values are never sent.
                                  </p>
                                  <label className='flex items-center gap-2 text-sm'>
                                    <Checkbox
                                      checked={applyConfirmed}
                                      onCheckedChange={(checked) =>
                                        setApplyConfirmed(checked === true)
                                      }
                                    />
                                    I confirm metadata-only configuration apply
                                  </label>
                                  <Button
                                    type='button'
                                    size='sm'
                                    disabled={!applyConfirmed}
                                    onClick={() =>
                                      void runRowAction(
                                        provider,
                                        'configure-apply',
                                        true
                                      )
                                    }
                                  >
                                    Apply configuration metadata
                                  </Button>
                                </div>
                              ) : null}
                              {rowResult &&
                              rowResult.providerId === provider.providerId ? (
                                <div className='space-y-2'>
                                  <div className='flex flex-wrap items-center gap-2'>
                                    <Badge
                                      variant={phaseBadgeVariant(
                                        rowResult.phase
                                      )}
                                    >
                                      {rowResult.phase}
                                    </Badge>
                                    <Badge variant='outline'>
                                      {rowResult.state}
                                    </Badge>
                                    {rowResult.fixtureDemo ? (
                                      <Badge variant='outline'>
                                        fixture/demo
                                      </Badge>
                                    ) : null}
                                  </div>
                                  <div className='text-sm'>
                                    {rowResult.operation} · {rowResult.summary}
                                  </div>
                                  <div className='text-xs text-muted-foreground'>
                                    next action: {rowResult.nextAction}
                                    {rowResult.correlationId
                                      ? ` · ${rowResult.correlationId}`
                                      : ''}
                                    {` · ${rowResult.checkedAt}`}
                                  </div>
                                </div>
                              ) : null}
                            </section>
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog
        open={providerValidationTarget !== null}
        onOpenChange={closeProviderValidation}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Validate provider configuration</DialogTitle>
            <DialogDescription>
              Test Broker connectivity and capabilities using reference handles
              only. Credentials never enter this form.
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='provider-validation-address'>Safe origin</Label>
              <Input
                id='provider-validation-address'
                value={providerAddress}
                placeholder='https://vault.example.com'
                onChange={(event) => setProviderAddress(event.target.value)}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='provider-validation-credential-ref'>
                Credential reference
              </Label>
              <Input
                id='provider-validation-credential-ref'
                value={providerCredentialRef}
                placeholder='providers/vault/credential'
                autoComplete='off'
                onChange={(event) =>
                  setProviderCredentialRef(event.target.value)
                }
              />
              <p className='text-xs text-muted-foreground'>
                Enter a Broker-managed reference or environment-handle name,
                never a token or password.
              </p>
            </div>
            <div className='space-y-2'>
              <Label htmlFor='provider-validation-namespaces'>Namespaces</Label>
              <Input
                id='provider-validation-namespaces'
                value={providerNamespaces}
                placeholder='services, providers'
                onChange={(event) => setProviderNamespaces(event.target.value)}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='provider-validation-reason'>Audit reason</Label>
              <Textarea
                id='provider-validation-reason'
                value={providerValidationReason}
                placeholder='Approved provider connectivity check'
                onChange={(event) =>
                  setProviderValidationReason(event.target.value)
                }
              />
            </div>
            {providerValidationResult ? (
              <div className='rounded-md border p-3 text-sm'>
                <div className='flex items-center justify-between gap-2'>
                  <span className='font-medium'>
                    Validation outcome: {providerValidationResult.outcome}
                  </span>
                  <Badge variant='outline'>
                    {providerValidationResult.provider.state}
                  </Badge>
                </div>
                <p className='mt-2 text-xs text-muted-foreground'>
                  {providerValidationResult.nextAction ??
                    providerValidationResult.provider.nextAction ??
                    'Review provider capability metadata.'}
                </p>
                <p className='mt-2 text-xs text-muted-foreground'>
                  This validates configuration only. Provider persistence
                  remains unavailable until the Broker advertises it as
                  executable.
                </p>
              </div>
            ) : null}
            {providerValidationError ? (
              <div className='rounded-md border border-destructive/40 p-3 text-sm text-destructive'>
                {providerValidationError}
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => closeProviderValidation(false)}
            >
              Close
            </Button>
            <Button
              type='button'
              disabled={
                validateProvider.isPending || !providerValidationReason.trim()
              }
              onClick={() => void runProviderValidation()}
            >
              Validate through Broker
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
