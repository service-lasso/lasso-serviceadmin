import { useEffect } from 'react'
import { AlertTriangle, Loader2, ShieldCheck } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import {
  identityUnlocksUi,
  useRuntimeIdentity,
} from '@/lib/service-lasso-dashboard/runtime-auth'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { LocalOperatorLoginForm } from '@/features/auth/local-operator-login-form'

function IdentityBoundary({
  title,
  description,
  retry,
}: {
  title: string
  description: string
  retry: () => void
}) {
  return (
    <main className='mx-auto flex min-h-svh w-full max-w-2xl items-center px-4 py-8'>
      <Alert variant='destructive'>
        <AlertTriangle className='size-4' />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription className='space-y-4'>
          <p>{description}</p>
          <Button type='button' variant='outline' onClick={retry}>
            Retry trusted identity check
          </Button>
        </AlertDescription>
      </Alert>
    </main>
  )
}

function browserHostname(): string {
  return window.location.hostname
}

export function RuntimeIdentityGate({
  children,
}: {
  children: React.ReactNode
}) {
  const identityQuery = useRuntimeIdentity()
  const setUser = useAuthStore((state) => state.auth.setUser)
  const hostname = browserHostname()
  const identity = identityQuery.data
  const unlocked = identity ? identityUnlocksUi(identity, hostname) : false

  useEffect(() => {
    if (!identity || !unlocked || !identity.actorKind || !identity.actorId) {
      setUser(null)
      return
    }

    setUser({
      actorId: identity.actorId,
      actorKind: identity.actorKind,
      workspaceId: identity.workspaceId,
      roles: identity.roles,
      permissions: identity.permissions,
    })
  }, [identity, unlocked, setUser])

  if (identityQuery.isLoading) {
    return (
      <main className='flex min-h-svh items-center justify-center gap-3 text-sm text-muted-foreground'>
        <Loader2 className='size-4 animate-spin' />
        Verifying trusted Service Lasso identity
      </main>
    )
  }

  if (identityQuery.isError) {
    return (
      <IdentityBoundary
        title='Trusted identity unavailable'
        description='Service Admin could not verify the Service Lasso runtime identity contract. Protected UI and mutations remain blocked.'
        retry={() => void identityQuery.refetch()}
      />
    )
  }

  if (!unlocked && identity) {
    return (
      <main className='mx-auto flex min-h-svh w-full max-w-lg items-center px-4 py-8'>
        <LocalOperatorLoginForm
          identity={identity}
          hostname={hostname}
          onAuthenticated={() => {
            void identityQuery.refetch()
          }}
        />
      </main>
    )
  }

  if (!unlocked) {
    return (
      <IdentityBoundary
        title='Authentication required'
        description='Open Service Admin on 127.0.0.1 as break-glass, or complete local/token/SSO login.'
        retry={() => void identityQuery.refetch()}
      />
    )
  }

  return (
    <div data-runtime-identity={identity?.actorKind}>
      <span className='sr-only'>
        <ShieldCheck /> Trusted identity verified
      </span>
      {children}
    </div>
  )
}
