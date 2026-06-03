import { getRouteApi } from '@tanstack/react-router'
import { DatabaseZap, ShieldCheck } from 'lucide-react'
import { usePageMetadata } from '@/lib/page-metadata'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import {
  countSecretInventoryByState,
  secretInventoryBoundaries,
  secretInventoryRows,
} from './secret-inventory'
import { SecretInventoryTable } from './secret-inventory-table'

const route = getRouteApi('/_authenticated/secrets-broker/secret-inventory')

export function SecretInventoryPage() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const counts = countSecretInventoryByState()

  usePageMetadata({
    title: 'Service Admin - Secret Inventory',
    description:
      'Metadata-only Secrets Broker inventory for refs, ownership, state, and rotation planning.',
  })

  return (
    <>
      <Header fixed>
        <Search />
        <div className='ms-auto flex items-center space-x-4'>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main id='content' className='space-y-6'>
        <div className='flex flex-wrap items-start justify-between gap-4'>
          <div>
            <h1 className='flex items-center gap-2 text-2xl font-bold tracking-tight'>
              <DatabaseZap className='size-5' /> Secret inventory
            </h1>
            <p className='mt-1 text-muted-foreground'>
              Advanced Secrets Broker planning view for ref metadata, ownership,
              state, expiry, and rotation readiness. This local fixture table is
              metadata-first and never resolves, displays, copies, exports, or
              mutates secret values.
            </p>
          </div>
          <Badge variant='secondary'>Deterministic local fixture</Badge>
        </div>

        <Alert>
          <ShieldCheck className='size-4' />
          <AlertTitle>No plaintext or privileged actions</AlertTitle>
          <AlertDescription>
            This is not a password vault and it does not include raw reveal,
            clipboard, edit, bulk rotation, or backend write controls. Adjacent
            links point to metadata-only provider, dependency, and audit views.
          </AlertDescription>
        </Alert>

        <div className='grid gap-4 md:grid-cols-5'>
          <Card>
            <CardHeader className='pb-2'>
              <CardDescription>Total refs</CardDescription>
              <CardTitle className='text-3xl'>
                {secretInventoryRows.length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className='pb-2'>
              <CardDescription>Present</CardDescription>
              <CardTitle className='text-3xl'>{counts.present}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className='pb-2'>
              <CardDescription>Rotation due</CardDescription>
              <CardTitle className='text-3xl'>
                {counts['rotation-due']}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className='pb-2'>
              <CardDescription>Stale</CardDescription>
              <CardTitle className='text-3xl'>{counts.stale}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className='pb-2'>
              <CardDescription>Missing</CardDescription>
              <CardTitle className='text-3xl'>{counts.missing}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Metadata-first ref table</CardTitle>
            <CardDescription>
              Rows are deterministic sample data for planning large inventory
              behavior. Secret payloads and privileged actions are deliberately
              absent.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SecretInventoryTable
              data={secretInventoryRows}
              search={search}
              navigate={navigate}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Safety boundaries</CardTitle>
            <CardDescription>
              Guardrails for keeping this inventory metadata-only and separate
              from privileged reveal or mutation workflows.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className='list-disc space-y-2 ps-5 text-sm text-muted-foreground'>
              {secretInventoryBoundaries.map((boundary) => (
                <li key={boundary}>{boundary}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
