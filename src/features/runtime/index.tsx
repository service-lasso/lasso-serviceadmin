import {
  useRunRuntimeAction,
  useRuntimeSummary,
} from '@/lib/service-lasso-api/hooks'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export function RuntimePage() {
  const { data } = useRuntimeSummary()
  const runtimeAction = useRunRuntimeAction()

  if (!data) {
    return null
  }

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle>Runtime overview</CardTitle>
          <CardDescription>
            Runtime health, bootstrap posture, and top-level controls should
            remain visible even in debug or partial-start states.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
            <InfoCard label='Host' value={data.host} />
            <InfoCard label='Profile' value={data.profile} />
            <InfoCard label='Uptime' value={data.uptime} />
            <InfoCard label='Version' value={data.version} />
          </div>
          <div className='flex flex-wrap gap-2'>
            {data.quickActions.map((action) => (
              <Button
                key={action}
                variant='outline'
                onClick={() => runtimeAction.mutate(action)}
              >
                {action}
              </Button>
            ))}
          </div>
          <div className='space-y-2'>
            {data.warnings.map((warning) => (
              <div
                key={warning}
                className='rounded-lg border p-3 text-sm text-muted-foreground'
              >
                {warning}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className='rounded-lg border p-4'>
      <div className='text-xs tracking-wide text-muted-foreground uppercase'>
        {label}
      </div>
      <div className='mt-1 text-lg font-medium'>{value}</div>
    </div>
  )
}
