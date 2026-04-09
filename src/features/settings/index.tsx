import { useOperatorSettings } from '@/lib/service-lasso-api/hooks'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export function SettingsPage() {
  const { data } = useOperatorSettings()

  if (!data) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Operator settings</CardTitle>
        <CardDescription>
          Stubbed UI-level preferences, separate from runtime truth, for the
          first serviceadmin slice.
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-3'>
        {data.map((setting) => (
          <div key={setting.id} className='rounded-lg border p-4'>
            <div className='font-medium'>{setting.label}</div>
            <div className='text-sm text-muted-foreground'>
              {setting.description}
            </div>
            <div className='mt-2 text-sm'>Current value: {setting.value}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export const Settings = SettingsPage
