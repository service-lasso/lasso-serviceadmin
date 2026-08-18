import { Link, useSearch } from '@tanstack/react-router'
import { Loader2, ShieldCheck, ShieldX } from 'lucide-react'
import { useRuntimeIdentity } from '@/lib/service-lasso-dashboard/runtime-auth'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { AuthLayout } from '../auth-layout'

export function SignIn() {
  const { redirect } = useSearch({ from: '/(auth)/sign-in' })
  const identity = useRuntimeIdentity()
  const authenticated = identity.data?.authenticated === true

  return (
    <AuthLayout>
      <Card className='gap-4'>
        <CardHeader>
          <CardTitle className='flex items-center gap-2 text-lg tracking-tight'>
            {authenticated ? <ShieldCheck /> : <ShieldX />}
            Trusted Service Lasso access
          </CardTitle>
          <CardDescription>
            Service Admin does not collect identity-provider passwords or store
            access tokens. Authentication is enforced by the Service Lasso
            runtime and protected ingress.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4 text-sm'>
          {identity.isLoading ? (
            <div className='flex items-center gap-2 text-muted-foreground'>
              <Loader2 className='size-4 animate-spin' /> Verifying identity
            </div>
          ) : authenticated ? (
            <>
              <p>
                Authenticated as <strong>{identity.data?.actorId}</strong>{' '}
                through {identity.data?.actorKind}.
              </p>
              <Button asChild className='w-full'>
                <Link to={redirect || '/'}>Continue to Service Admin</Link>
              </Button>
            </>
          ) : (
            <>
              <p>
                Open the protected Service Admin URL and complete the configured
                identity-provider login. Direct or untrusted access remains
                blocked.
              </p>
              <Button
                type='button'
                variant='outline'
                className='w-full'
                onClick={() => void identity.refetch()}
              >
                Retry trusted identity check
              </Button>
            </>
          )}
        </CardContent>
        <CardFooter>
          <p className='px-4 text-center text-sm text-muted-foreground'>
            Browser-supplied identity headers are never trusted by this UI.
          </p>
        </CardFooter>
      </Card>
    </AuthLayout>
  )
}
