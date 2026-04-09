/* eslint-disable react-refresh/only-export-components */
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/_authenticated/errors/$error')({
  component: RouteComponent,
})

function RouteComponent() {
  const { error } = Route.useParams()
  const navigate = useNavigate()

  return (
    <div className='flex min-h-[70svh] items-center justify-center p-6'>
      <Card className='w-full max-w-xl'>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <AlertTriangle className='size-5' />
            Service Lasso UI error surface
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <p className='text-sm text-muted-foreground'>
            The requested error route is <code>{error}</code>. This cleaned repo
            keeps a minimal operator-facing error surface instead of the starter
            demo shell.
          </p>
          <div className='flex gap-2'>
            <Button onClick={() => navigate({ to: '/' })}>
              Back to dashboard
            </Button>
            <Button
              variant='outline'
              onClick={() => navigate({ to: '/services' })}
            >
              Open services
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
