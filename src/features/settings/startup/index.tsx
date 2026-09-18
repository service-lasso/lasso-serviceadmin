import { useEffect, useState } from 'react'
import {
  fetchRuntimeJson,
  serviceLassoStubDataEnabled,
} from '@/lib/service-lasso-dashboard/stub'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { ContentSection } from '../components/content-section'

type StartupResponse = { startup: { autostart: boolean } }

let stubAutostart = true

async function loadStartupSettings(): Promise<StartupResponse> {
  if (serviceLassoStubDataEnabled) {
    return { startup: { autostart: stubAutostart } }
  }
  return fetchRuntimeJson<StartupResponse>('/api/runtime/settings/startup')
}

async function saveStartupSettings(
  autostart: boolean
): Promise<StartupResponse> {
  if (serviceLassoStubDataEnabled) {
    stubAutostart = autostart
    return { startup: { autostart } }
  }
  return fetchRuntimeJson<StartupResponse>('/api/runtime/settings/startup', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ autostart }),
  })
}

export function SettingsStartup() {
  const [autostart, setAutostart] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void loadStartupSettings()
      .then(({ startup }) => setAutostart(startup.autostart))
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error
            ? cause.message
            : 'Could not load startup settings.'
        )
      )
  }, [])

  async function save(next: boolean) {
    setSaving(true)
    setError(null)
    try {
      setAutostart((await saveStartupSettings(next)).startup.autostart)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not update startup settings.'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <ContentSection
      title='Startup'
      desc='Control what Service Lasso starts when its runtime launches.'
    >
      <div className='space-y-5 rounded-lg border p-5'>
        <div className='flex items-center justify-between gap-6'>
          <div>
            <h3 className='font-medium'>
              Start enabled services automatically
            </h3>
            <p className='text-sm text-muted-foreground'>
              Applies on the next runtime launch. It never stops services that
              are already running.
            </p>
          </div>
          <Switch
            checked={autostart ?? false}
            disabled={autostart === null || saving}
            onCheckedChange={(next) => void save(next)}
            aria-label='Start enabled services automatically'
          />
        </div>
        {error ? <p className='text-sm text-destructive'>{error}</p> : null}
        {autostart === null ? (
          <Button variant='outline' disabled>
            Loading startup preference…
          </Button>
        ) : null}
      </div>
    </ContentSection>
  )
}
