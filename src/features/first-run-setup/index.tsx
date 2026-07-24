import { useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  Download,
  KeyRound,
  Loader2,
  Printer,
  Server,
  ShieldAlert,
  UserRound,
} from 'lucide-react'
import { toast } from 'sonner'
import { copyText } from '@/lib/copy-text'
import {
  useFirstRunSetupKeyAcknowledgement,
  useFirstRunSetupState,
} from '@/lib/service-lasso-dashboard/hooks'
import type { FirstRunSetupState } from '@/lib/service-lasso-dashboard/types'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'

function StatusBadge({ setup }: { setup: FirstRunSetupState }) {
  if (setup.status === 'failed') {
    return <Badge variant='destructive'>Setup failed</Badge>
  }

  if (setup.status === 'generated_key_pending_ack') {
    return <Badge className='bg-amber-600 hover:bg-amber-600'>Key reveal</Badge>
  }

  if (setup.status === 'in_progress') {
    return <Badge variant='secondary'>In progress</Badge>
  }

  return <Badge>Setup required</Badge>
}

function MetadataItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: string | null
}) {
  return (
    <div className='min-w-0 rounded-md border bg-background p-3'>
      <div className='flex items-center gap-2 text-xs text-muted-foreground'>
        <Icon className='size-3.5' />
        <span>{label}</span>
      </div>
      <div className='mt-1 break-words text-sm font-medium'>
        {value ?? 'Pending'}
      </div>
    </div>
  )
}

function downloadKey(value: string) {
  const blob = new Blob([value], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'service-lasso-vault-key.txt'
  anchor.click()
  URL.revokeObjectURL(url)
}

function GeneratedKeyReveal({ setup }: { setup: FirstRunSetupState }) {
  const [saved, setSaved] = useState(false)
  const acknowledge = useFirstRunSetupKeyAcknowledgement()
  const reveal = setup.vault.keyReveal

  if (!reveal) return null

  return (
    <section className='space-y-4 border-t pt-5'>
      <Alert className='border-amber-500/40 bg-amber-500/5'>
        <ShieldAlert className='size-4 text-amber-600' />
        <AlertTitle>Generated vault key</AlertTitle>
        <AlertDescription>
          This key is shown once. If it is lost without managed recovery, the
          vault must be recreated and existing encrypted secrets cannot be
          recovered.
        </AlertDescription>
      </Alert>

      <div>
        <div className='mb-2 text-sm font-medium'>Recovery key</div>
        <pre className='max-h-40 overflow-auto rounded-md border bg-muted p-3 text-sm whitespace-pre-wrap break-all'>
          {reveal.value}
        </pre>
      </div>

      <div className='flex flex-wrap gap-2'>
        <Button
          type='button'
          variant='outline'
          onClick={async () => {
            const copied = await copyText(reveal.value)
            toast[copied ? 'success' : 'error'](
              copied ? 'Vault key copied.' : 'Vault key copy failed.'
            )
          }}
        >
          <Clipboard className='size-4' />
          Copy
        </Button>
        <Button
          type='button'
          variant='outline'
          onClick={() => downloadKey(reveal.value)}
        >
          <Download className='size-4' />
          Download
        </Button>
        <Button type='button' variant='outline' onClick={() => window.print()}>
          <Printer className='size-4' />
          Print
        </Button>
      </div>

      <label className='flex items-start gap-3 rounded-md border bg-background p-3 text-sm'>
        <Checkbox
          checked={saved}
          onCheckedChange={(checked) => setSaved(checked === true)}
          aria-label='Confirm vault key saved'
        />
        <span>
          I saved the generated vault key and understand it will not be shown
          again.
        </span>
      </label>

      <Button
        type='button'
        disabled={!saved || acknowledge.isPending}
        onClick={() => acknowledge.mutate()}
      >
        {acknowledge.isPending ? (
          <Loader2 className='size-4 animate-spin' />
        ) : (
          <CheckCircle2 className='size-4' />
        )}
        Confirm saved
      </Button>
    </section>
  )
}

function SuppliedKeySummary({ setup }: { setup: FirstRunSetupState }) {
  if (setup.vault.keySource === 'generated') return null

  return (
    <section className='space-y-3 border-t pt-5'>
      <Alert className='border-emerald-500/40 bg-emerald-500/5'>
        <KeyRound className='size-4 text-emerald-600' />
        <AlertTitle>Externally supplied key</AlertTitle>
        <AlertDescription>
          The raw vault key is not displayed. Confirm the source with the safe
          fingerprint shown here.
        </AlertDescription>
      </Alert>
      <MetadataItem
        icon={KeyRound}
        label='Key source'
        value={setup.vault.keySource.replace(/_/g, ' ')}
      />
      <MetadataItem
        icon={ShieldAlert}
        label='Fingerprint'
        value={setup.vault.keyFingerprint}
      />
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
              Bootstrap the local vault and root owner before the Service Admin
              shell opens.
            </p>
          </div>
        </div>

        {setup.status === 'failed' && setup.failure ? (
          <Alert variant='destructive'>
            <AlertTriangle className='size-4' />
            <AlertTitle>Setup failed</AlertTitle>
            <AlertDescription>{setup.failure.message}</AlertDescription>
          </Alert>
        ) : null}

        {!setup.localOnly || setup.remoteAllowed ? null : (
          <Alert>
            <ShieldAlert className='size-4' />
            <AlertTitle>Local setup boundary</AlertTitle>
            <AlertDescription>
              Localhost can claim the root owner. Remote access needs Zitadel or
              an explicit setup token before root access is granted.
            </AlertDescription>
          </Alert>
        )}

        <section className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
          <MetadataItem icon={KeyRound} label='Vault' value={setup.vault.name} />
          <MetadataItem
            icon={UserRound}
            label='Root owner'
            value={setup.rootOwner.displayName}
          />
          <MetadataItem
            icon={Server}
            label='Machine'
            value={
              [setup.machine.hostname, setup.machine.osUser]
                .filter(Boolean)
                .join(' / ') || null
            }
          />
        </section>

        <div className='rounded-md border bg-background p-4'>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <div>
              <div className='text-sm font-medium'>Setup mode</div>
              <div className='text-sm text-muted-foreground'>
                {setup.localOnly ? 'Local-only' : 'Remote-enabled'}
              </div>
            </div>
            <StatusBadge setup={setup} />
          </div>

          {setup.nextActions.length > 0 ? (
            <div className='mt-4 grid gap-2 text-sm sm:grid-cols-2'>
              {setup.nextActions.map((action) => (
                <div key={action} className='rounded-md border p-3'>
                  {action}
                </div>
              ))}
            </div>
          ) : null}

          <GeneratedKeyReveal setup={setup} />
          <SuppliedKeySummary setup={setup} />
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

function FirstRunSetupUnavailable({ error }: { error: unknown }) {
  return (
    <div className='mx-auto flex min-h-svh w-full max-w-5xl flex-col justify-center px-4 py-6 sm:px-6 lg:px-8'>
      <Alert variant='destructive'>
        <AlertTriangle className='size-4' />
        <AlertTitle>First-run setup status unavailable</AlertTitle>
        <AlertDescription>
          {error instanceof Error
            ? error.message
            : 'Service Admin could not read the setup status.'}
        </AlertDescription>
      </Alert>
    </div>
  )
}

export function FirstRunSetupGate({
  children,
}: {
  children: React.ReactNode
}) {
  const setupQuery = useFirstRunSetupState()

  if (setupQuery.isLoading || !setupQuery.data) {
    return <FirstRunSetupLoading />
  }

  if (setupQuery.isError) {
    return <FirstRunSetupUnavailable error={setupQuery.error} />
  }

  const setup = setupQuery.data
  const setupBlocksShell =
    setup.required &&
    setup.status !== 'not_required' &&
    setup.status !== 'complete'

  if (setupBlocksShell) {
    return <FirstRunSetupContent setup={setup} />
  }

  return <>{children}</>
}
