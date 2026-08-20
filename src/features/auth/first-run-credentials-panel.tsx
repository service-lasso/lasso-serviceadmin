import { useEffect, useState } from 'react'
import { Check, Copy, Loader2 } from 'lucide-react'
import {
  acknowledgeFirstRunCredentials,
  fetchFirstRunCredentials,
  type FirstRunCredentials,
} from '@/lib/service-lasso-dashboard/first-run-credentials'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type CopiedField = 'token' | 'password'

async function copySecret(value: string): Promise<void> {
  if (!navigator.clipboard?.writeText) {
    throw new Error('clipboard_unavailable')
  }
  await navigator.clipboard.writeText(value)
}

export function FirstRunCredentialsPanel({
  onAcknowledged,
}: {
  onAcknowledged: () => void
}) {
  const [credentials, setCredentials] = useState<FirstRunCredentials | null>(
    null
  )
  const [loadError, setLoadError] = useState<string | null>(null)
  const [ackError, setAckError] = useState<string | null>(null)
  const [copiedToken, setCopiedToken] = useState(false)
  const [copiedPassword, setCopiedPassword] = useState(false)
  const [savedConfirmed, setSavedConfirmed] = useState(false)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    let cancelled = false
    void fetchFirstRunCredentials()
      .then((result) => {
        if (cancelled) {
          return
        }
        if (!result) {
          onAcknowledged()
          return
        }
        setCredentials(result)
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(
            'Could not load first-run credentials. Open Service Admin on 127.0.0.1 and retry.'
          )
        }
      })
    return () => {
      cancelled = true
    }
  }, [onAcknowledged])

  async function onCopy(field: CopiedField) {
    if (!credentials) {
      return
    }
    setAckError(null)
    try {
      await copySecret(
        field === 'token' ? credentials.token : credentials.password
      )
      if (field === 'token') {
        setCopiedToken(true)
      } else {
        setCopiedPassword(true)
      }
    } catch {
      setAckError('Copy failed. Select the value and copy it manually.')
    }
  }

  async function onAcknowledge() {
    if (!copiedToken || !copiedPassword || !savedConfirmed) {
      return
    }
    setAckError(null)
    setPending(true)
    try {
      await acknowledgeFirstRunCredentials()
      onAcknowledged()
    } catch {
      setAckError(
        'Could not confirm that the token was saved. Stay on this screen and retry.'
      )
    } finally {
      setPending(false)
    }
  }

  const canAcknowledge =
    copiedToken && copiedPassword && savedConfirmed && !pending

  if (loadError) {
    return <p className='text-sm text-destructive'>{loadError}</p>
  }

  if (!credentials) {
    return (
      <div className='flex items-center gap-2 text-sm text-muted-foreground'>
        <Loader2 className='size-4 animate-spin' />
        Loading first-run credentials
      </div>
    )
  }

  return (
    <div className='space-y-4'>
      <div className='space-y-1'>
        <p className='text-sm font-medium'>Save your local-operator token</p>
        <p className='text-sm text-muted-foreground'>
          Copy both values now. Later visits require this token or the
          local-operator password. This screen will not dismiss itself.
        </p>
      </div>
      <div className='space-y-2'>
        <Label htmlFor='first-run-username'>Username</Label>
        <Input
          id='first-run-username'
          readOnly
          value={credentials.username}
          autoComplete='off'
        />
      </div>
      <div className='space-y-2'>
        <Label htmlFor='first-run-token'>Local-admin token</Label>
        <div className='flex gap-2'>
          <Input
            id='first-run-token'
            readOnly
            value={credentials.token}
            autoComplete='off'
          />
          <Button
            type='button'
            variant='outline'
            onClick={() => void onCopy('token')}
            aria-label='Copy local-admin token'
          >
            {copiedToken ? (
              <Check className='size-4' />
            ) : (
              <Copy className='size-4' />
            )}
          </Button>
        </div>
      </div>
      <div className='space-y-2'>
        <Label htmlFor='first-run-password'>Lasso-local password</Label>
        <div className='flex gap-2'>
          <Input
            id='first-run-password'
            readOnly
            value={credentials.password}
            autoComplete='off'
          />
          <Button
            type='button'
            variant='outline'
            onClick={() => void onCopy('password')}
            aria-label='Copy local-operator password'
          >
            {copiedPassword ? (
              <Check className='size-4' />
            ) : (
              <Copy className='size-4' />
            )}
          </Button>
        </div>
      </div>
      <div className='flex items-center gap-2'>
        <Checkbox
          id='saved-first-run-token'
          checked={savedConfirmed}
          onCheckedChange={(value) => {
            setSavedConfirmed(value === true)
          }}
        />
        <Label htmlFor='saved-first-run-token'>I saved this token</Label>
      </div>
      <Button
        type='button'
        className='w-full'
        disabled={!canAcknowledge}
        onClick={() => void onAcknowledge()}
      >
        Continue after saving
      </Button>
      {ackError ? <p className='text-sm text-destructive'>{ackError}</p> : null}
    </div>
  )
}
