import { Link, useSearch } from '@tanstack/react-router'
import { Loader2, ShieldCheck, ShieldX } from 'lucide-react'
import {
  identityUnlocksUi,
  useRuntimeIdentity,
} from '@/lib/service-lasso-dashboard/runtime-auth'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { LocalOperatorLoginForm } from '@/features/auth/local-operator-login-form'
import { AuthLayout } from '../auth-layout'

export function SignIn() {
  const { redirect } = useSearch({ from: '/(auth)/sign-in' })
  const identity = useRuntimeIdentity()
  const hostname = window.location.hostname
  const unlocked = identity.data
    ? identityUnlocksUi(identity.data, hostname)
    : false

  return (
    <AuthLayout>
      <Card className='gap-4'>
        <CardHeader>
          <CardTitle className='flex items-center gap-2 text-lg tracking-tight'>
            {unlocked ? <ShieldCheck /> : <ShieldX />}
            Trusted Service Lasso access
          </CardTitle>
          <CardDescription>
            Loopback 127.0.0.1 stays local-root without a password. Remote
            browsers prove a Lasso-local credential, vault token, or SSO.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4 text-sm'>
          {identity.isLoading ? (
            <div className='flex items-center gap-2 text-muted-foreground'>
              <Loader2 className='size-4 animate-spin' /> Verifying identity
            </div>
          ) : unlocked ? (
            <>
              <p>
                Authenticated as <strong>{identity.data?.actorId}</strong>{' '}
                through {identity.data?.actorKind}.
              </p>
              <Button asChild className='w-full'>
                <Link to={redirect || '/'}>Continue to Service Admin</Link>
              </Button>
            </>
          ) : identity.data ? (
            <LocalOperatorLoginForm
              identity={identity.data}
              hostname={hostname}
              onAuthenticated={() => {
                void identity.refetch()
              }}
            />
          ) : (
            <Button
              type='button'
              variant='outline'
              className='w-full'
              onClick={() => void identity.refetch()}
            >
              Retry trusted identity check
            </Button>
          )}
        </CardContent>
        <CardFooter>
          <p className='px-4 text-center text-sm text-muted-foreground'>
            OS passwords are never collected. operator.json is the Broker daemon
            token, not this login.
          </p>
        </CardFooter>
      </Card>
    </AuthLayout>
  )
}
