import { useMemo, useState } from 'react'
import { ClipboardCheck, ShieldCheck } from 'lucide-react'
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
  policyOutcomeCopy,
  policySimulationScenarios,
  type PolicySimulationOutcome,
} from './policy-simulation'

const outcomeVariant: Record<
  PolicySimulationOutcome,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  allowed: 'default',
  denied: 'destructive',
  unknown: 'secondary',
  locked: 'outline',
  'source-auth-required': 'outline',
}

export function SecretsPolicySimulationPage() {
  const [selectedScenarioId, setSelectedScenarioId] = useState(
    policySimulationScenarios[0].id
  )
  const selectedScenario = useMemo(
    () =>
      policySimulationScenarios.find(
        (scenario) => scenario.id === selectedScenarioId
      ) ?? policySimulationScenarios[0],
    [selectedScenarioId]
  )
  const outcomeCounts = useMemo(
    () =>
      policySimulationScenarios.reduce<Record<PolicySimulationOutcome, number>>(
        (counts, scenario) => ({
          ...counts,
          [scenario.outcome]: counts[scenario.outcome] + 1,
        }),
        {
          allowed: 0,
          denied: 0,
          unknown: 0,
          locked: 0,
          'source-auth-required': 0,
        }
      ),
    []
  )

  usePageMetadata({
    title: 'Service Admin - Secrets Policy Simulation',
    description:
      'Metadata-only Secrets Broker policy simulation and dry-run decisions.',
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
              <ShieldCheck className='size-5' /> Secrets Broker policy
              simulation
            </h1>
            <p className='mt-1 text-muted-foreground'>
              Dry-run whether a service, workflow, or run identity would be
              allowed to read or write a broker ref. This surface shows policy
              metadata, source state, lifecycle refs, and audit context only; it
              never resolves, mutates, or renders raw secret values.
            </p>
          </div>
          <Badge variant='secondary'>Read-only dry run</Badge>
        </div>

        <Alert>
          <ClipboardCheck className='size-4' />
          <AlertTitle>Simulation only — no broker mutation</AlertTitle>
          <AlertDescription>
            Results explain the expected policy decision before a risky
            operation starts. Use the linked policy/source/lifecycle/audit refs
            to investigate; rerun against the live broker before executing a
            real workflow.
          </AlertDescription>
        </Alert>

        <div className='grid gap-4 md:grid-cols-5'>
          {Object.entries(outcomeCounts).map(([outcome, count]) => (
            <Card key={outcome}>
              <CardHeader className='pb-2'>
                <CardDescription>
                  {policyOutcomeCopy[outcome as PolicySimulationOutcome]}
                </CardDescription>
                <CardTitle className='text-3xl'>{count}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Policy request</CardTitle>
            <CardDescription>
              Select a representative dry-run outcome. Inputs are ref metadata
              and identity refs only, not secret payloads.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div>
              <label
                htmlFor='policy-simulation-scenario'
                className='mb-1 block text-xs text-muted-foreground'
              >
                Simulation scenario
              </label>
              <select
                id='policy-simulation-scenario'
                className='h-9 w-full rounded-md border bg-background px-3 text-sm md:w-[28rem]'
                value={selectedScenarioId}
                onChange={(event) => setSelectedScenarioId(event.target.value)}
              >
                {policySimulationScenarios.map((scenario) => (
                  <option key={scenario.id} value={scenario.id}>
                    {scenario.label}
                  </option>
                ))}
              </select>
            </div>

            <div className='grid gap-3 md:grid-cols-3'>
              <div className='rounded-lg border p-3'>
                <div className='text-xs text-muted-foreground'>Service</div>
                <div className='font-medium break-all'>
                  {selectedScenario.identity.service}
                </div>
              </div>
              <div className='rounded-lg border p-3'>
                <div className='text-xs text-muted-foreground'>Workflow</div>
                <div className='font-medium break-all'>
                  {selectedScenario.identity.workflow}
                </div>
              </div>
              <div className='rounded-lg border p-3'>
                <div className='text-xs text-muted-foreground'>Run ref</div>
                <div className='font-medium break-all'>
                  {selectedScenario.identity.runRef}
                </div>
              </div>
              <div className='rounded-lg border p-3'>
                <div className='text-xs text-muted-foreground'>Namespace</div>
                <div className='font-medium break-all'>
                  {selectedScenario.request.namespace}
                </div>
              </div>
              <div className='rounded-lg border p-3'>
                <div className='text-xs text-muted-foreground'>Broker ref</div>
                <div className='font-medium break-all'>
                  {selectedScenario.request.ref}
                </div>
              </div>
              <div className='rounded-lg border p-3'>
                <div className='text-xs text-muted-foreground'>Action</div>
                <div className='font-medium'>
                  {selectedScenario.request.action}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className='grid gap-4 lg:grid-cols-2'>
          <Card>
            <CardHeader>
              <CardTitle>Simulation result</CardTitle>
              <CardDescription>
                Decision metadata and the reason operators can review before
                executing a real read, run, rotation, or write-back.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='flex flex-wrap items-center gap-3'>
                <Badge variant={outcomeVariant[selectedScenario.outcome]}>
                  {policyOutcomeCopy[selectedScenario.outcome]}
                </Badge>
                <Badge variant='outline'>
                  mutation: {selectedScenario.decision.dryRunMutation}
                </Badge>
              </div>
              <div>
                <div className='font-medium'>
                  {selectedScenario.decision.title}
                </div>
                <p className='mt-1 text-sm text-muted-foreground'>
                  {selectedScenario.decision.reason}
                </p>
              </div>
              <div className='rounded-lg border p-3 text-sm'>
                <div className='text-muted-foreground'>Next action</div>
                <div className='font-medium'>{selectedScenario.nextAction}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Linked context</CardTitle>
              <CardDescription>
                Stable refs for policy, source, lifecycle, and audit context.
              </CardDescription>
            </CardHeader>
            <CardContent className='grid gap-3 text-sm'>
              <div className='rounded-lg border p-3'>
                <div className='text-muted-foreground'>Policy</div>
                <div className='font-medium break-all'>
                  {selectedScenario.decision.policyRef}
                </div>
              </div>
              <div className='rounded-lg border p-3'>
                <div className='text-muted-foreground'>Source</div>
                <div className='font-medium break-all'>
                  {selectedScenario.decision.sourceRef}
                </div>
              </div>
              <div className='rounded-lg border p-3'>
                <div className='text-muted-foreground'>Lifecycle</div>
                <div className='font-medium break-all'>
                  {selectedScenario.decision.lifecycleRef}
                </div>
              </div>
              <div className='rounded-lg border p-3'>
                <div className='text-muted-foreground'>Audit dry-run</div>
                <div className='font-medium break-all'>
                  {selectedScenario.decision.auditRef}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </Main>
    </>
  )
}
