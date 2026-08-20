import { useState, type FormEvent } from 'react'
import {
  LOCAL_OPERATOR_USERNAME,
  writeLocalOperatorSession,
} from '@/lib/service-lasso-dashboard/local-operator-session'
import type { RuntimeIdentity } from '@/lib/service-lasso-dashboard/runtime-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type LoginMethod = 'token' | 'password'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readSessionToken(payload: unknown): string | null {
  if (!isRecord(payload) || !isRecord(payload.session)) {
    return null
  }
  if (typeof payload.session.token !== 'string') {
    return null
  }
  const token = payload.session.token.trim()
  return token.length > 0 ? token : null
}

async function submitLocalOperatorLogin(body: {
  method: LoginMethod
  token?: string
  username?: string
  password?: string
}): Promise<void> {
  const response = await fetch('/api/runtime/auth/local', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const error =
      isRecord(payload) && typeof payload.error === 'string'
        ? payload.error
        : 'local_auth_rejected'
    throw new Error(error)
  }
  const sessionToken = readSessionToken(payload)
  if (!sessionToken) {
    throw new Error('local_auth_session_missing')
  }
  writeLocalOperatorSession(sessionToken)
}

function loginErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : 'local_auth_rejected'
  if (code === 'force_sso_required') {
    return 'Remote local login is disabled because FORCE_SSO is on. Use SSO, or open 127.0.0.1 as break-glass.'
  }
  if (code === 'local_auth_rate_limited') {
    return 'Too many remote attempts. Wait, or open loopback Admin as break-glass.'
  }
  return 'Local operator authentication was rejected.'
}

export function LocalOperatorLoginForm({
  identity,
  hostname,
  onAuthenticated,
}: {
  identity: RuntimeIdentity
  hostname: string
  onAuthenticated: () => void
}) {
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const forceSsoRemote = identity.forceSso && !identity.local
  const showLocalForms = !forceSsoRemote

  async function onSubmit(
    method: LoginMethod,
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()
    setError(null)
    setPending(true)
    try {
      if (method === 'token') {
        await submitLocalOperatorLogin({ method: 'token', token })
      } else {
        await submitLocalOperatorLogin({
          method: 'password',
          username: LOCAL_OPERATOR_USERNAME,
          password,
        })
      }
      setToken('')
      setPassword('')
      onAuthenticated()
    } catch (caught) {
      setError(loginErrorMessage(caught))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className='space-y-4'>
      {identity.identityProviders.length > 0 ? (
        <div className='space-y-2'>
          <p className='text-sm font-medium'>Login with provider</p>
          {identity.identityProviders.map((provider) =>
            provider.startUrl ? (
              <Button key={provider.id} asChild className='w-full'>
                <a href={provider.startUrl}>Login with {provider.label}</a>
              </Button>
            ) : (
              <Button
                key={provider.id}
                type='button'
                className='w-full'
                disabled
              >
                Login with {provider.label} (protected hostname)
              </Button>
            )
          )}
        </div>
      ) : null}

      {forceSsoRemote ? (
        <p className='text-sm text-muted-foreground'>
          FORCE_SSO is on for remote browsers. Local and token login are
          disabled here. Loopback 127.0.0.1 / localhost remains break-glass.
        </p>
      ) : null}

      {showLocalForms ? (
        <>
          <form
            className='space-y-2'
            onSubmit={(event) => void onSubmit('password', event)}
          >
            <p className='text-sm font-medium'>Local operator</p>
            <Label htmlFor='local-operator-password'>
              Lasso-local password (not an OS account)
            </Label>
            <Input
              id='local-operator-password'
              type='password'
              autoComplete='off'
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
              }}
              disabled={pending}
            />
            <Button type='submit' className='w-full' disabled={pending}>
              Sign in as local operator
            </Button>
          </form>
          <form
            className='space-y-2'
            onSubmit={(event) => void onSubmit('token', event)}
          >
            <p className='text-sm font-medium'>Token</p>
            <Label htmlFor='local-admin-token'>
              Local-admin token from vault path runtime/local-operator
            </Label>
            <Input
              id='local-admin-token'
              type='password'
              autoComplete='off'
              value={token}
              onChange={(event) => {
                setToken(event.target.value)
              }}
              disabled={pending}
            />
            <Button
              type='submit'
              variant='outline'
              className='w-full'
              disabled={pending}
            >
              Continue with token
            </Button>
          </form>
        </>
      ) : null}

      {error ? <p className='text-sm text-destructive'>{error}</p> : null}
      <p className='text-xs text-muted-foreground'>
        This browser origin is {hostname}. Retrieve the token on loopback KV
        first if you have not already.
      </p>
    </div>
  )
}
