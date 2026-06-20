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

const onePasswordMappings = [
  {
    ref: 'secret://providers/onepassword/default/OPENCLAW_API_KEY',
    vault: 'Service Lasso',
    itemPath: 'OpenClaw / API key',
    field: 'credential',
    owner: '@serviceadmin',
    namespace: 'providers/onepassword/default',
  },
  {
    ref: 'secret://providers/onepassword/default/RELEASE_SIGNING_KEY',
    vault: 'Service Lasso',
    itemPath: 'Release / signing key',
    field: 'private-key',
    owner: 'release-worker',
    namespace: 'providers/onepassword/default',
  },
]

const onePasswordConfigFields = [
  ['Account context', 'service-lasso.1password.com'],
  ['CLI command path', 'op'],
  ['Trusted command dirs', 'C:/Program Files/1Password CLI'],
  ['Auth state', 'operator sign-in required'],
  ['Credential handle', 'secret://providers/onepassword/cli-session'],
  ['Priority / fallback', 'addable until configured'],
] as const

function onePasswordProvider() {
  return secretsBrokerSourceBackends.find(
    (source) => source.id === 'onepassword-cli'
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
    ...onePasswordConfigFields.flat(),
    ...onePasswordMappings.flatMap((mapping) => Object.values(mapping)),
  ]
    .join(' ')
    .toLowerCase()
    .includes(normalizedQuery)
}

export function OnePasswordCliProviderDetail({
  query = '',
}: {
  query?: string
}) {
  const provider = onePasswordProvider()

  if (!provider || !matchesQuery(provider, query)) return null

  return (
    <section className='space-y-4' aria-labelledby='onepassword-cli-heading'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <h2
            id='onepassword-cli-heading'
            className='flex items-center gap-2 text-xl font-semibold'
          >
            <KeyRound className='size-5' /> 1Password CLI provider
          </h2>
          <p className='mt-1 text-sm text-muted-foreground'>
            Provider-specific add/configure preview for vault, account, item,
            field, command-path, auth, namespace, and fallback metadata.
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
                <ListChecks className='size-4' /> Safe configuration metadata
              </CardTitle>
              <CardDescription>
                1Password values, session tokens, raw CLI output, and field
                payloads are never captured by this Service Admin surface.
              </CardDescription>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button type='button' variant='outline'>
                  <KeyRound className='size-4' /> Configure 1Password CLI
                </Button>
              </DialogTrigger>
              <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-2xl'>
                <DialogHeader>
                  <DialogTitle>Configure 1Password CLI</DialogTitle>
                  <DialogDescription>
                    Capture only safe metadata needed by the broker source
                    contract. Sign-in happens outside Service Admin.
                  </DialogDescription>
                </DialogHeader>

                <div className='grid gap-4 md:grid-cols-2'>
                  {onePasswordConfigFields.map(([label, value]) => (
                    <div key={label} className='space-y-2'>
                      <Label htmlFor={`onepassword-${label}`}>{label}</Label>
                      <Input
                        id={`onepassword-${label}`}
                        readOnly
                        value={value}
                      />
                    </div>
                  ))}
                </div>

                <div className='rounded-md border p-3 text-sm'>
                  <div className='font-medium'>Test action</div>
                  <div className='mt-1 text-muted-foreground'>
                    Metadata-only CLI status check; item values and command
                    output are scrubbed before diagnostics or audit events.
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
                  <TableHead>Vault / item</TableHead>
                  <TableHead>Field</TableHead>
                  <TableHead>Ownership</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {onePasswordMappings.map((mapping) => (
                  <TableRow key={mapping.ref}>
                    <TableCell className='min-w-72 align-top'>
                      {mapping.ref}
                    </TableCell>
                    <TableCell className='min-w-56 align-top'>
                      <div>{mapping.vault}</div>
                      <div className='text-sm text-muted-foreground'>
                        {mapping.itemPath}
                      </div>
                    </TableCell>
                    <TableCell className='min-w-40 align-top'>
                      {mapping.field}
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
              <Badge variant='outline'>no raw CLI output</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
