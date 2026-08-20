import { Link, useSearch } from '@tanstack/react-router'
import { Loader2, ShieldCheck, ShieldX } from 'lucide-react'
import { isLoopbackLoginOrigin } from '@/lib/service-lasso-dashboard/local-operator-session'
import {
  allowLocalRootBreakGlass,
  resolveIdentityGateSurface,
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
import { FirstRunCredentialsPanel } from '@/features/auth/first-run-credentials-panel'
import { LocalOperatorLoginForm } from '@/features/auth/local-operator-login-form'
import { AuthLayout } from '../auth-layout'

/**
 * Loopback `/sign-in` forces first-run copy/save, then token/password login.
 * Continue as local-root is explicit break-glass. FORCE_SSO hides Local/Token
 * only on remote origins.
 */
export function SignIn() {
  const { redirect } = useSearch({ from: '/(auth)/sign-in' })
  const identity = useRuntimeIdentity()
  const hostname = window.location.hostname
  const surface = identity.data
    ? resolveIdentityGateSurface(identity.data, hostname, {
        allowLocalRootBreakGlass: allowLocalRootBreakGlass(),
      })
    : null
  const unlocked = surface === 'unlocked'
  const loopbackOrigin = identity.data
    ? isLoopbackLoginOrigin(identity.data, hostname)
    : isLoopbackLoginOrigin({ local: false }, hostname)
  const showLoginMethods = surface === 'login' || (unlocked && loopbackOrigin)

  return (
    <AuthLayout>
      <Card className='gap-4'>
        <CardHeader>
          <CardTitle className='flex items-center gap-2 text-lg tracking-tight'>
            {unlocked ? <ShieldCheck /> : <ShieldX />}
            Trusted Service Lasso access
          </CardTitle>
          <CardDescription>
            First start requires copying the local-admin token. Later visits use
            that token or the local-operator password. Loopback keeps an
            explicit Continue as local-root control. FORCE_SSO hides Local and
            Token only on remote origins.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4 text-sm'>
          {identity.isLoading ? (
            <div className='flex items-center gap-2 text-muted-foreground'>
              <Loader2 className='size-4 animate-spin' /> Verifying identity
            </div>
          ) : identity.data ? (
            <>
              {surface === 'first-run' ? (
                <FirstRunCredentialsPanel
                  onAcknowledged={() => {
                    void identity.refetch()
                  }}
                />
              ) : null}
              {unlocked ? (
                <>
                  <p>
                    Authenticated as <strong>{identity.data.actorId}</strong>{' '}
                    through {identity.data.actorKind}.
                  </p>
                  <Button asChild className='w-full'>
                    <Link to={redirect || '/'}>Continue to Service Admin</Link>
                  </Button>
                </>
              ) : null}
              {showLoginMethods ? (
                <LocalOperatorLoginForm
                  identity={identity.data}
                  hostname={hostname}
                  onAuthenticated={() => {
                    void identity.refetch()
                  }}
                />
              ) : null}
            </>
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
