import { useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  Loader2,
  Server,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import {
  useFirstRunSetupBootstrap,
  useFirstRunSetupState,
} from '@/lib/service-lasso-dashboard/hooks'
import type { FirstRunSetupState } from '@/lib/service-lasso-dashboard/types'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'

function StatusBadge({ setup }: { setup: FirstRunSetupState }) {
  if (setup.state === 'setup_failed') {
    return <Badge variant='destructive'>Setup failed</Badge>
  }
  if (setup.state === 'lost_key' || setup.state === 'recreate_required') {
    return <Badge variant='destructive'>Recreate required</Badge>
  }
  if (setup.state === 'setup_in_progress') {
    return <Badge variant='secondary'>In progress</Badge>
  }
  if (setup.vault.ready) {
    return <Badge>Broker ready</Badge>
  }
  return (
    <Badge className='bg-amber-600 hover:bg-amber-600'>Setup required</Badge>
  )
}

function isLostKeyRecreate(setup: FirstRunSetupState) {
  return setup.state === 'lost_key' || setup.state === 'recreate_required'
}

function MetadataItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: string
}) {
  return (
    <div className='min-w-0 rounded-md border bg-background p-3'>
      <div className='flex items-center gap-2 text-xs text-muted-foreground'>
        <Icon className='size-3.5' />
        <span>{label}</span>
      </div>
      <div className='mt-1 text-sm font-medium break-words'>{value}</div>
    </div>
  )
}

function blockerCopy(blocker: string) {
  if (blocker === 'setup_token_required_for_remote_bind') {
    return 'Remote setup requires an operator-configured one-time setup token.'
  }
  return 'The runtime trust policy is not ready for setup.'
}

function BootstrapControl({ setup }: { setup: FirstRunSetupState }) {
  const [setupToken, setSetupToken] = useState('')
  const bootstrap = useFirstRunSetupBootstrap()
  const remoteTokenRequired = !setup.trustBoundary.localOnly
  const allowed =
    setup.trustBoundary.localhostBootstrapAllowed ||
    setup.trustBoundary.remoteBootstrapAllowed
  const tokenMissing = remoteTokenRequired && setupToken.trim().length === 0

  async function runBootstrap() {
    try {
      await bootstrap.mutateAsync(
        remoteTokenRequired ? setupToken.trim() : undefined
      )
    } catch {
      // The mutation owns the safe, retryable error state rendered below.
    } finally {
      setSetupToken('')
    }
  }

  return (
    <section className='space-y-4 border-t pt-5'>
      <Alert>
        <ShieldCheck className='size-4' />
        <AlertTitle>Protected broker bootstrap</AlertTitle>
        <AlertDescription>
          {isLostKeyRecreate(setup)
            ? 'Service Lasso will recreate the encrypted broker store, protect new credentials with the operating system, and start authenticated IPC. The previous master key is never entered, pasted, or shown here.'
            : 'Service Lasso will create the encrypted broker store, protect its credentials with the operating system, start authenticated IPC, and provision declared generated secrets. No master key is shown to the browser.'}
        </AlertDescription>
      </Alert>

      {remoteTokenRequired && setup.trustBoundary.setupTokenConfigured ? (
        <div className='space-y-2'>
          <Label htmlFor='service-lasso-setup-token'>
            One-time setup token
          </Label>
          <Input
            id='service-lasso-setup-token'
            type='password'
            value={setupToken}
            autoComplete='off'
            spellCheck={false}
            onChange={(event) => setSetupToken(event.target.value)}
          />
          <p className='text-xs text-muted-foreground'>
            The token is sent only for this request and is cleared after every
            attempt.
          </p>
        </div>
      ) : null}

      {!allowed ? (
        <Alert variant='destructive'>
          <AlertTriangle className='size-4' />
          <AlertTitle>Bootstrap blocked</AlertTitle>
          <AlertDescription>
            {setup.trustBoundary.blockers.length > 0
              ? setup.trustBoundary.blockers.map(blockerCopy).join(' ')
              : 'The runtime has not authorized this setup boundary.'}
          </AlertDescription>
        </Alert>
      ) : null}

      {bootstrap.isError ? (
        <Alert variant='destructive'>
          <AlertTriangle className='size-4' />
          <AlertTitle>Bootstrap did not complete</AlertTitle>
          <AlertDescription>
            Service Lasso rejected or could not complete the protected setup.
            Check the runtime audit log and retry after resolving the reported
            broker state.
          </AlertDescription>
        </Alert>
      ) : null}

      {bootstrap.data ? (
        <Alert className='border-emerald-500/40 bg-emerald-500/5'>
          <CheckCircle2 className='size-4 text-emerald-600' />
          <AlertTitle>Bootstrap complete</AlertTitle>
          <AlertDescription>
            {bootstrap.data.bootstrap.provisionedSecretCount} declared secrets
            were provisioned without exposing their values.
          </AlertDescription>
        </Alert>
      ) : null}

      <Button
        type='button'
        disabled={!allowed || tokenMissing || bootstrap.isPending}
        onClick={() => void runBootstrap()}
      >
        {bootstrap.isPending ? (
          <Loader2 className='size-4 animate-spin' />
        ) : (
          <KeyRound className='size-4' />
        )}
        Initialize Secrets Broker
        {isLostKeyRecreate(setup) ? ' from a new store' : ''}
      </Button>
    </section>
  )
}

function FirstRunSetupContent({ setup }: { setup: FirstRunSetupState }) {
  return (
    <div className='mx-auto flex min-h-svh w-full max-w-5xl flex-col px-4 py-6 sm:px-6 lg:px-8'>
      <main className='flex flex-1 flex-col justify-center gap-6'>
        <div className='space-y-3'>
          <StatusBadge setup={setup} />
          <div className='space-y-2'>
            <h1 className='text-3xl font-bold tracking-normal'>
              Service Lasso first-run setup
            </h1>
            <p className='max-w-3xl text-muted-foreground'>
              Initialize the protected Secrets Broker before Service Admin
              opens. Secret keys and broker credentials never enter this UI.
            </p>
          </div>
        </div>

        {setup.state === 'setup_failed' ? (
          <Alert variant='destructive'>
            <AlertTriangle className='size-4' />
            <AlertTitle>Setup requires recovery</AlertTitle>
            <AlertDescription>
              The runtime reported a failed setup state. Review the runtime
              audit trail and broker health before retrying.
            </AlertDescription>
          </Alert>
        ) : null}

        {isLostKeyRecreate(setup) ? (
          <Alert variant='destructive'>
            <AlertTriangle className='size-4' />
            <AlertTitle>Lost key requires store recreate</AlertTitle>
            <AlertDescription>
              Recreate the protected store from this first-run screen. Do not
              enter the previous master key, recovery shares, or backup
              passphrases here.
            </AlertDescription>
          </Alert>
        ) : null}

        <section className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
          <MetadataItem
            icon={KeyRound}
            label='Secrets Broker'
            value={setup.vault.ready ? 'Ready' : 'Not initialized'}
          />
          <MetadataItem
            icon={UserRound}
            label='Local operator'
            value={setup.operator.osUsername}
          />
          <MetadataItem
            icon={Server}
            label='Setup boundary'
            value={
              setup.trustBoundary.localOnly ? 'Local only' : 'Remote token'
            }
          />
        </section>

        <div className='rounded-md border bg-background p-4'>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <div>
              <div className='text-sm font-medium'>Runtime setup state</div>
              <div className='text-sm text-muted-foreground'>
                {setup.state.replace(/_/g, ' ')}
              </div>
            </div>
            <StatusBadge setup={setup} />
          </div>
          <BootstrapControl setup={setup} />
        </div>
      </main>
    </div>
  )
}

function FirstRunSetupLoading() {
  return (
    <div className='mx-auto flex min-h-svh w-full max-w-5xl flex-col justify-center gap-6 px-4 py-6 sm:px-6 lg:px-8'>
      <Skeleton className='h-6 w-36' />
      <Skeleton className='h-10 w-80 max-w-full' />
      <div className='grid gap-3 sm:grid-cols-3'>
        <Skeleton className='h-20 w-full' />
        <Skeleton className='h-20 w-full' />
        <Skeleton className='h-20 w-full' />
      </div>
    </div>
  )
}

function FirstRunSetupUnavailable() {
  return (
    <div className='mx-auto flex min-h-svh w-full max-w-5xl flex-col justify-center px-4 py-6 sm:px-6 lg:px-8'>
      <Alert variant='destructive'>
        <AlertTriangle className='size-4' />
        <AlertTitle>First-run setup status unavailable</AlertTitle>
        <AlertDescription>
          Service Admin could not verify the setup contract. The application
          remains locked until the Service Lasso runtime is reachable.
        </AlertDescription>
      </Alert>
    </div>
  )
}

export function FirstRunSetupGate({ children }: { children: React.ReactNode }) {
  const setupQuery = useFirstRunSetupState()

  if (setupQuery.isLoading || !setupQuery.data) {
    return <FirstRunSetupLoading />
  }

  if (setupQuery.isError) {
    return <FirstRunSetupUnavailable />
  }

  const setup = setupQuery.data
  const setupComplete =
    setup.vault.ready &&
    !setup.setupMode &&
    (setup.state === 'not_required' || setup.state === 'setup_complete')

  if (!setupComplete) {
    return <FirstRunSetupContent setup={setup} />
  }

  return <>{children}</>
}
