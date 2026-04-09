import { useNetworkBindings } from '@/lib/service-lasso-api/hooks'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export function NetworkPage() {
  const { data } = useNetworkBindings()

  if (!data) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Network</CardTitle>
        <CardDescription>
          Direct ports, URLs, and routed hostnames remain visible so operators
          can quickly confirm exposure.
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-3'>
        {data.map((binding) => (
          <div key={binding.serviceId} className='rounded-lg border p-4'>
            <div className='font-medium'>{binding.serviceId}</div>
            <div className='mt-2 text-sm text-muted-foreground'>
              Ports: {binding.ports.length ? binding.ports.join(', ') : '—'}
            </div>
            <div className='text-sm text-muted-foreground'>
              URLs: {binding.urls.length ? binding.urls.join(', ') : '—'}
            </div>
            <div className='text-sm text-muted-foreground'>
              Hostnames:{' '}
              {binding.hostnames.length ? binding.hostnames.join(', ') : '—'}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
