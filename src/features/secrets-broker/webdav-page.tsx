import { usePageMetadata } from '@/lib/page-metadata'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { HeaderActions } from '@/components/page-toolbar'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { SecretsWebDAVPanel } from '@/features/service-detail/secrets-webdav-panel'

export function SecretsBrokerWebDAVPage() {
  usePageMetadata({
    title: 'Service Admin - Broker RAM files',
    description: 'Inspect RAM WebDAV file metadata and service usage.',
  })
  return (
    <>
      <Header>
        <HeaderActions>
          <ThemeSwitch />
          <ProfileDropdown />
        </HeaderActions>
      </Header>
      <Main>
        <div className='mb-6'>
          <h1 className='text-2xl font-bold'>RAM files</h1>
          <p className='text-muted-foreground'>
            Broker WebDAV state and service file usage.
          </p>
        </div>
        <SecretsWebDAVPanel />
      </Main>
    </>
  )
}
