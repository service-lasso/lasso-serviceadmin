import { useQuery } from '@tanstack/react-query'
import { usePageMetadata } from '@/lib/page-metadata'
import { fetchSecretsBrokerOverview } from '@/lib/secrets-broker/client'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { HeaderActions } from '@/components/page-toolbar'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { KvSecretsEditor } from '@/features/secrets-broker/kv-secrets-editor'

/**
 * Secrets is the KV editor only. The old management catalog lived on this
 * route beside KV and is removed as redundant. `Main fixed` makes the KV
 * card fill remaining height under the header instead of leaving empty page
 * space below a short card.
 */
export function SecretsManagementPage() {
  usePageMetadata({
    title: 'Service Admin - Secrets Broker Secrets',
    description:
      'Browse and edit Secrets Broker KV paths without listing secret values until an audited per-field reveal.',
  })
  const { data: liveOverview } = useQuery({
    queryKey: ['secrets-broker', 'management-secrets', 'overview'],
    queryFn: fetchSecretsBrokerOverview,
  })

  return (
    <>
      <Header fixed>
        <Search />
        <HeaderActions>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </HeaderActions>
      </Header>

      <Main id='content' fixed className='min-h-0 gap-4'>
        <KvSecretsEditor overview={liveOverview} />
      </Main>
    </>
  )
}
