import { useInstalledRecords } from '@/lib/service-lasso-api/hooks'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export function InstalledPage() {
  const { data } = useInstalledRecords()

  if (!data) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Installed</CardTitle>
        <CardDescription>
          Installed, selected, and acquisition state are exposed here as the
          first install-surface stub.
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-3'>
        {data.map((record) => (
          <div key={record.serviceId} className='rounded-lg border p-4 text-sm'>
            <div className='font-medium'>{record.serviceId}</div>
            <div className='text-muted-foreground'>
              Selected: {record.selectedVersion}
            </div>
            <div className='text-muted-foreground'>
              Installed: {record.installedVersion}
            </div>
            <div className='text-muted-foreground'>
              Acquisition: {record.acquisition}
            </div>
            <div className='text-muted-foreground'>
              State path: {record.statePath}
            </div>
            <div className='text-muted-foreground'>
              Payload path: {record.payloadPath}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
