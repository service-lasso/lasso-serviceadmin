import { useState } from 'react'
import {
  checkPinnedServiceRelease,
  installPinnedServiceRelease,
  type PinnedReleaseCheck,
} from '@/lib/service-lasso-dashboard/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/confirm-dialog'

export function PinnedReleaseUpdates({ serviceId }: { serviceId: string }) {
  if (serviceId !== '@tui' && serviceId !== '@cli') return null
  return <PinnedReleaseControls key={serviceId} serviceId={serviceId} />
}

function PinnedReleaseControls({ serviceId }: { serviceId: string }) {
  const [release, setRelease] = useState<PinnedReleaseCheck | null>(null)
  const [pending, setPending] = useState<'check' | 'install' | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function check() {
    setPending('check')
    setRelease(null)
    setMessage('')
    setError('')
    try {
      const result = await checkPinnedServiceRelease(serviceId)
      setRelease(result)
      if (result.status === 'current')
        setMessage('The installed release is current.')
    } catch {
      setError(
        'Release check unavailable. Verify your connection and access, and that Core supports pinned release updates.'
      )
    } finally {
      setPending(null)
    }
  }

  async function install() {
    if (pending || !release?.candidateTag) return
    setPending('install')
    setError('')
    try {
      const result = await installPinnedServiceRelease(
        serviceId,
        release.candidateTag
      )
      setRelease({
        serviceId,
        currentTag: result.installedTag,
        status: 'current',
        candidateTag: null,
      })
      setMessage(
        `Installed ${result.installedTag}. The new version is used the next time you launch this client.`
      )
    } catch {
      setRelease(null)
      setError(
        'Release installation failed. Check the service status and check releases again before retrying.'
      )
    } finally {
      setPending(null)
      setConfirmOpen(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Client releases</CardTitle>
      </CardHeader>
      <CardContent className='space-y-3'>
        {release && (
          <p className='text-sm break-all'>
            Current release {release.currentTag}
          </p>
        )}
        {release?.candidateTag && (
          <p className='text-sm break-all'>
            Available release {release.candidateTag}
          </p>
        )}
        <div className='flex flex-wrap gap-2'>
          <Button
            variant='outline'
            size='sm'
            disabled={pending !== null}
            onClick={() => void check()}
          >
            {pending === 'check' ? 'Checking releases…' : 'Check new releases'}
          </Button>
          {release?.status === 'update_available' && release.candidateTag && (
            <Button
              size='sm'
              disabled={pending !== null}
              onClick={() => setConfirmOpen(true)}
            >
              {pending === 'install'
                ? 'Installing release…'
                : 'Install release'}
            </Button>
          )}
        </div>
        {message && (
          <p role='status' className='text-sm'>
            {message}
          </p>
        )}
        {error && (
          <p role='alert' className='text-sm text-destructive'>
            {error}
          </p>
        )}
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={`Install ${serviceId} release?`}
          desc={
            <p className='break-all'>
              Replace {release?.currentTag} with {release?.candidateTag}. The
              new version is used on the next client launch.
            </p>
          }
          confirmText='Install release'
          isLoading={pending === 'install'}
          handleConfirm={() => void install()}
        />
      </CardContent>
    </Card>
  )
}
