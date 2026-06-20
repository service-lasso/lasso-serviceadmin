import { KeyRound, ListChecks, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  secretsBrokerSourceBackends,
  type SecretsBrokerSourceBackend,
} from './source-backends'

const bitwardenMappings = [
  {
    ref: 'secret://providers/bitwarden/default/OPENCLAW_API_KEY',
    project: 'Service Lasso platform',
    secretId: 'bws://project/service-lasso/openclaw-api-key',
    selector: 'value',
    owner: '@serviceadmin',
    namespace: 'providers/bitwarden/default',
  },
  {
    ref: 'secret://providers/bitwarden/default/RELEASE_SIGNING_KEY',
    project: 'Service Lasso release',
    secretId: 'bws://project/service-lasso/release-signing-key',
    selector: 'value',
    owner: 'release-worker',
    namespace: 'providers/bitwarden/default',
  },
]

const bitwardenConfigFields = [
  ['Project id', 'service-lasso-platform'],
  ['Source id', 'bitwarden-bws-cli'],
  ['CLI command path', 'bws'],
  ['Token reference', 'secret://providers/bitwarden/bws-access-token'],
  ['Secret selector', 'value metadata only'],
  ['Priority / fallback', 'addable until configured'],
] as const

function bitwardenProvider() {
  return secretsBrokerSourceBackends.find(
    (source) => source.id === 'bitwarden-bws-cli'
  )
}

function matchesQuery(provider: SecretsBrokerSourceBackend, query: string) {
  const normalizedQuery = query.trim().toLowerCase()

  if (!normalizedQuery) return true

  return [
    provider.title,
    provider.type,
    provider.provider,
    provider.source,
    provider.state,
    provider.lifecycle,
    provider.summary,
    provider.nextAction,
    ...bitwardenConfigFields.flat(),
    ...bitwardenMappings.flatMap((mapping) => Object.values(mapping)),
  ]
    .join(' ')
    .toLowerCase()
    .includes(normalizedQuery)
}

export function BitwardenBwsProviderDetail({ query = '' }: { query?: string }) {
  const provider = bitwardenProvider()

  if (!provider || !matchesQuery(provider, query)) return null

  return (
    <section className='space-y-4' aria-labelledby='bitwarden-bws-heading'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <h2
            id='bitwarden-bws-heading'
            className='flex items-center gap-2 text-xl font-semibold'
          >
            <KeyRound className='size-5' /> Bitwarden / BWS CLI provider
          </h2>
          <p className='mt-1 text-sm text-muted-foreground'>
            Provider-specific add/configure preview for project, source,
            token-reference, secret mapping, selector, namespace, and fallback
            metadata.
          </p>
        </div>
        <div className='flex flex-wrap gap-2'>
          <Badge variant='outline'>addable</Badge>
          <Badge variant='secondary'>{provider.lifecycleDetail?.state}</Badge>
          <Badge variant='outline'>values hidden</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className='flex flex-wrap items-start justify-between gap-3'>
            <div>
              <CardTitle className='flex items-center gap-2'>
                <ListChecks className='size-4' /> Safe BWS configuration
                metadata
              </CardTitle>
              <CardDescription>
                BWS access tokens, secret values, raw CLI output, and provider
                response bodies are never captured by this Service Admin
                surface.
              </CardDescription>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button type='button' variant='outline'>
                  <KeyRound className='size-4' /> Configure Bitwarden BWS
                </Button>
              </DialogTrigger>
              <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-2xl'>
                <DialogHeader>
                  <DialogTitle>Configure Bitwarden BWS</DialogTitle>
                  <DialogDescription>
                    Capture only safe metadata needed by the broker source
                    contract. BWS authentication material remains behind a
                    SecretRef handle.
                  </DialogDescription>
                </DialogHeader>

                <div className='grid gap-4 md:grid-cols-2'>
                  {bitwardenConfigFields.map(([label, value]) => (
                    <div key={label} className='space-y-2'>
                      <Label htmlFor={`bitwarden-${label}`}>{label}</Label>
                      <Input id={`bitwarden-${label}`} readOnly value={value} />
                    </div>
                  ))}
                </div>

                <div className='rounded-md border p-3 text-sm'>
                  <div className='font-medium'>Test action</div>
                  <div className='mt-1 text-muted-foreground'>
                    Metadata-only BWS project and secret-handle check; values,
                    token material, and raw command output are scrubbed before
                    diagnostics or audit events.
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid gap-3 text-sm md:grid-cols-3'>
            <div>
              <div className='text-xs text-muted-foreground'>source id</div>
              <div className='font-medium'>{provider.sourceId}</div>
            </div>
            <div>
              <div className='text-xs text-muted-foreground'>kind</div>
              <div className='font-medium'>{provider.kind}</div>
            </div>
            <div>
              <div className='text-xs text-muted-foreground'>display name</div>
              <div className='font-medium'>{provider.title}</div>
            </div>
            <div>
              <div className='text-xs text-muted-foreground'>configured</div>
              <div className='font-medium'>{String(provider.configured)}</div>
            </div>
            <div>
              <div className='text-xs text-muted-foreground'>enabled</div>
              <div className='font-medium'>{String(provider.enabled)}</div>
            </div>
            <div>
              <div className='text-xs text-muted-foreground'>next action</div>
              <div className='font-medium'>
                {provider.lifecycleDetail?.nextAction}
              </div>
            </div>
          </div>

          <div className='overflow-x-auto rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ref</TableHead>
                  <TableHead>Project / secret</TableHead>
                  <TableHead>Selector</TableHead>
                  <TableHead>Ownership</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bitwardenMappings.map((mapping) => (
                  <TableRow key={mapping.ref}>
                    <TableCell className='min-w-72 align-top'>
                      {mapping.ref}
                    </TableCell>
                    <TableCell className='min-w-56 align-top'>
                      <div>{mapping.project}</div>
                      <div className='text-sm text-muted-foreground'>
                        {mapping.secretId}
                      </div>
                    </TableCell>
                    <TableCell className='min-w-40 align-top'>
                      {mapping.selector}
                    </TableCell>
                    <TableCell className='min-w-56 align-top'>
                      <div>{mapping.owner}</div>
                      <div className='text-sm text-muted-foreground'>
                        {mapping.namespace}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className='rounded-md border p-3 text-sm'>
            <div className='flex items-center gap-2 font-medium'>
              <ShieldCheck className='size-4' /> Diagnostics and audit
            </div>
            <div className='mt-2 flex flex-wrap gap-2'>
              {provider.testResult.metadata.map((item) => (
                <Badge key={item} variant='outline'>
                  {item}
                </Badge>
              ))}
              <Badge variant='outline'>audit metadata only</Badge>
              <Badge variant='outline'>no raw BWS output</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
