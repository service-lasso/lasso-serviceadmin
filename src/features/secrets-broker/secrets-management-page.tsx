import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
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

const route = getRouteApi('/_authenticated/secrets-broker/secrets')

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
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const { data: liveOverview } = useQuery({
    queryKey: ['secrets-broker', 'management-secrets', 'overview'],
    queryFn: fetchSecretsBrokerOverview,
  })
  const pathFilter = search.secret ?? ''

  /**
   * Keep the KV Path filter in the existing `secret` search param.
   */
  const handlePathFilterChange = (secret: string) => {
    const nextSecret = secret.trim()
    void navigate({
      replace: true,
      search: (previous) => ({
        ...previous,
        secret: nextSecret.length > 0 ? nextSecret : undefined,
      }),
    })
  }

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
        <KvSecretsEditor
          overview={liveOverview}
          pathFilter={pathFilter}
          onPathFilterChange={handlePathFilterChange}
        />
      </Main>
    </>
  )
}
