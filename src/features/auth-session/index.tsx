import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  LockKeyhole,
  ShieldCheck,
  UserCheck,
} from 'lucide-react'
import { usePageMetadata } from '@/lib/page-metadata'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
  zitadelSessionScenarios,
  type ZitadelPermissionDecision,
  type ZitadelSessionState,
} from './zitadel-session'

const stateCopy: Record<ZitadelSessionState, string> = {
  'signed-in': 'Signed in',
  'signed-out': 'Login required',
  'setup-needed': 'Setup needed',
  'permission-denied': 'Permission denied',
}

const stateVariant: Record<
  ZitadelSessionState,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  'signed-in': 'default',
  'signed-out': 'secondary',
  'setup-needed': 'outline',
  'permission-denied': 'destructive',
}

const permissionVariant: Record<
  ZitadelPermissionDecision,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  allowed: 'default',
  denied: 'destructive',
  review: 'secondary',
}

function StateIcon({ state }: { state: ZitadelSessionState }) {
  if (state === 'signed-in') return <UserCheck className='size-4' />
  if (state === 'permission-denied') return <LockKeyhole className='size-4' />
  return <AlertTriangle className='size-4' />
}

export function AuthSessionPage() {
  const [selectedScenarioId, setSelectedScenarioId] = useState(
    zitadelSessionScenarios[0].id
  )
  const selectedScenario = useMemo(
    () =>
      zitadelSessionScenarios.find(
        (scenario) => scenario.id === selectedScenarioId
      ) ?? zitadelSessionScenarios[0],
    [selectedScenarioId]
  )

  const deniedPermissionCount = selectedScenario.permissions.filter(
    (permission) => permission.decision === 'denied'
  ).length

  usePageMetadata({
    title: 'Service Admin - ZITADEL Session',
    description:
      'Metadata-only ZITADEL login, session, role, and permission integration surface.',
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
              <ShieldCheck className='size-5' /> ZITADEL session and roles
            </h1>
            <p className='mt-1 text-muted-foreground'>
              Service Admin auth integration preview for consumer apps that opt
              into ZITADEL-backed sessions. This page renders facade metadata,
              roles, and permission decisions only; provider credentials and
              session secrets are never displayed.
            </p>
          </div>
          <Badge variant='secondary'>Metadata only</Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Session state preview</CardTitle>
            <CardDescription>
              Choose the facade-reported state to inspect signed-in,
              login-required, setup-needed, and permission-denied behaviour.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div>
              <label
                htmlFor='zitadel-session-scenario'
                className='mb-1 block text-xs text-muted-foreground'
              >
                Auth scenario
              </label>
              <select
                id='zitadel-session-scenario'
                className='h-9 w-full rounded-md border bg-background px-3 text-sm md:w-[24rem]'
                value={selectedScenarioId}
                onChange={(event) => setSelectedScenarioId(event.target.value)}
              >
                {zitadelSessionScenarios.map((scenario) => (
                  <option key={scenario.id} value={scenario.id}>
                    {scenario.label}
                  </option>
                ))}
              </select>
            </div>

            <div className='grid gap-3 md:grid-cols-4'>
              <div className='rounded-lg border p-3'>
                <div className='text-xs text-muted-foreground'>State</div>
                <Badge variant={stateVariant[selectedScenario.state]}>
                  <StateIcon state={selectedScenario.state} />
                  {stateCopy[selectedScenario.state]}
                </Badge>
              </div>
              <div className='rounded-lg border p-3'>
                <div className='text-xs text-muted-foreground'>Provider</div>
                <div className='font-medium'>
                  {selectedScenario.facade.authProvider}
                </div>
              </div>
              <div className='rounded-lg border p-3'>
                <div className='text-xs text-muted-foreground'>Roles</div>
                <div className='font-medium'>
                  {selectedScenario.roles.length}
                </div>
              </div>
              <div className='rounded-lg border p-3'>
                <div className='text-xs text-muted-foreground'>Denied</div>
                <div className='font-medium'>{deniedPermissionCount}</div>
              </div>
            </div>

            <div className='rounded-lg border p-4'>
              <div className='font-medium'>{selectedScenario.label}</div>
              <p className='mt-1 text-sm text-muted-foreground'>
                {selectedScenario.summary}
              </p>
              <div className='mt-3 rounded-md border p-3 text-sm'>
                <div className='text-muted-foreground'>Required action</div>
                <div className='font-medium'>
                  {selectedScenario.requiredAction}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className='grid gap-4 lg:grid-cols-2'>
          <Card>
            <CardHeader>
              <CardTitle>Facade session metadata</CardTitle>
              <CardDescription>
                Consumer app/facade integration fields. These are identifiers
                and status metadata, not credential material.
              </CardDescription>
            </CardHeader>
            <CardContent className='grid gap-3 text-sm md:grid-cols-2'>
              <div className='rounded-lg border p-3'>
                <div className='text-muted-foreground'>Workspace</div>
                <div className='font-medium break-all'>
                  {selectedScenario.facade.workspaceId}
                </div>
              </div>
              <div className='rounded-lg border p-3'>
                <div className='text-muted-foreground'>App</div>
                <div className='font-medium'>
                  {selectedScenario.facade.appId}
                </div>
              </div>
              <div className='rounded-lg border p-3'>
                <div className='text-muted-foreground'>Session mode</div>
                <div className='font-medium'>
                  {selectedScenario.facade.sessionMode}
                </div>
              </div>
              <div className='rounded-lg border p-3'>
                <div className='text-muted-foreground'>Metadata updated</div>
                <div className='font-medium'>
                  {selectedScenario.facade.metadataUpdatedAt}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>User and role summary</CardTitle>
              <CardDescription>
                Stable user refs and role names only. No auth cookies, bearer
                values, or session secrets are rendered.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4 text-sm'>
              {selectedScenario.user ? (
                <div className='grid gap-3 md:grid-cols-2'>
                  <div className='rounded-lg border p-3'>
                    <div className='text-muted-foreground'>Display name</div>
                    <div className='font-medium'>
                      {selectedScenario.user.displayName}
                    </div>
                  </div>
                  <div className='rounded-lg border p-3'>
                    <div className='text-muted-foreground'>Email</div>
                    <div className='font-medium'>
                      {selectedScenario.user.email}
                    </div>
                  </div>
                  <div className='rounded-lg border p-3 md:col-span-2'>
                    <div className='text-muted-foreground'>Subject ref</div>
                    <div className='font-medium break-all'>
                      {selectedScenario.user.subjectRef}
                    </div>
                  </div>
                  <div className='rounded-lg border p-3'>
                    <div className='text-muted-foreground'>
                      Organization ref
                    </div>
                    <div className='font-medium break-all'>
                      {selectedScenario.user.organizationRef}
                    </div>
                  </div>
                  <div className='rounded-lg border p-3'>
                    <div className='text-muted-foreground'>Workspace role</div>
                    <div className='font-medium'>
                      {selectedScenario.user.workspaceRole}
                    </div>
                  </div>
                </div>
              ) : (
                <div className='rounded-lg border border-dashed p-4 text-muted-foreground'>
                  No signed-in user metadata is available for this scenario.
                </div>
              )}

              <div>
                <div className='mb-2 text-xs font-medium text-muted-foreground uppercase'>
                  Roles
                </div>
                <div className='flex flex-wrap gap-2'>
                  {selectedScenario.roles.length === 0 ? (
                    <Badge variant='outline'>none until login</Badge>
                  ) : (
                    selectedScenario.roles.map((role) => (
                      <Badge key={role} variant='outline'>
                        {role}
                      </Badge>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Permission decisions</CardTitle>
            <CardDescription>
              Protected Service Admin surfaces can explain grants, denials, and
              review states without exposing provider/session material.
            </CardDescription>
          </CardHeader>
          <CardContent className='overflow-x-auto rounded-lg border p-0'>
            <table className='w-full text-sm'>
              <thead className='bg-muted/50 text-left'>
                <tr>
                  <th className='p-3 font-medium'>Scope</th>
                  <th className='p-3 font-medium'>Decision</th>
                  <th className='p-3 font-medium'>Reason</th>
                </tr>
              </thead>
              <tbody>
                {selectedScenario.permissions.map((permission) => (
                  <tr key={permission.scope} className='border-t align-top'>
                    <td className='p-3 font-mono text-xs'>
                      {permission.scope}
                    </td>
                    <td className='p-3'>
                      <Badge variant={permissionVariant[permission.decision]}>
                        {permission.decision}
                      </Badge>
                    </td>
                    <td className='p-3 text-muted-foreground'>
                      {permission.reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Optional ZITADEL integration guardrails</CardTitle>
            <CardDescription>
              This UI depends on consumer app/facade integration. It should not
              force authentication onto core local development by default.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-3'>
            <ul className='list-disc space-y-2 ps-5 text-sm text-muted-foreground'>
              {selectedScenario.guardrails.map((guardrail) => (
                <li key={guardrail}>{guardrail}</li>
              ))}
            </ul>
            <Button asChild variant='secondary'>
              <a href='/docs/zitadel-session-surface.md'>
                Read integration note
              </a>
            </Button>
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
