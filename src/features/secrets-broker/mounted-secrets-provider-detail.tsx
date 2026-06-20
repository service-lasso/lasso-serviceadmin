import { FileText, ListChecks, Route, ShieldCheck } from 'lucide-react'
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

const mountedSecretMappings = [
  {
    ref: 'mounted://run-secrets/postgres-password',
    file: '/run/secrets/postgres-password',
    owner: 'postgres',
    namespace: 'services/postgres/runtime',
  },
  {
    ref: 'mounted://run-secrets/serviceadmin-session',
    file: '/run/secrets/serviceadmin-session',
    owner: '@serviceadmin',
    namespace: 'services/@serviceadmin/runtime',
  },
]

const mountedSecretConfigFields = [
  ['Root path', '/run/secrets'],
  [
    'Allowed paths',
    '/run/secrets/postgres-password, /run/secrets/serviceadmin-session',
  ],
  ['Follow symlinks', 'false'],
  ['Max bytes per file', '4096'],
  ['Mapping mode', 'explicit ref to file path only'],
  ['Priority / fallback', 'addable until configured'],
] as const

const mountedSecretPolicyNotes = [
  'Read-only mounted-file provider for Docker and Kubernetes secret mounts.',
  'Blocks paths outside the configured root and reports policy denials as metadata.',
  'Rejects symlink traversal unless a broker policy explicitly allows it.',
  'Tests read file metadata only; file contents and provider credentials are never rendered.',
]

function mountedSecretsProvider() {
  return secretsBrokerSourceBackends.find(
    (source) => source.id === 'mounted-secrets'
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
    ...mountedSecretConfigFields.flat(),
    ...mountedSecretMappings.flatMap((mapping) => Object.values(mapping)),
    ...mountedSecretPolicyNotes,
  ]
    .join(' ')
    .toLowerCase()
    .includes(normalizedQuery)
}

export function MountedSecretsProviderDetail({
  query = '',
}: {
  query?: string
}) {
  const provider = mountedSecretsProvider()

  if (!provider || !matchesQuery(provider, query)) return null

  return (
    <section className='space-y-4' aria-labelledby='mounted-secrets-heading'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <h2
            id='mounted-secrets-heading'
            className='flex items-center gap-2 text-xl font-semibold'
          >
            <FileText className='size-5' /> Docker/Kubernetes mounted secrets
          </h2>
          <p className='mt-1 text-sm text-muted-foreground'>
            Provider-specific add/configure preview for mount root, allowed
            paths, symlink policy, file mappings, namespace ownership, priority,
            and fallback metadata.
          </p>
        </div>
        <div className='flex flex-wrap gap-2'>
          <Badge variant='outline'>addable</Badge>
          <Badge variant='secondary'>{provider.lifecycleDetail?.state}</Badge>
          <Badge variant='outline'>file contents hidden</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className='flex flex-wrap items-start justify-between gap-3'>
            <div>
              <CardTitle className='flex items-center gap-2'>
                <ListChecks className='size-4' /> Mounted file configuration
                metadata
              </CardTitle>
              <CardDescription>
                Root paths, allowed files, ref mappings, and policy status are
                shown without reading mounted secret file contents.
              </CardDescription>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button type='button' variant='outline'>
                  <FileText className='size-4' /> Configure mounted secrets
                </Button>
              </DialogTrigger>
              <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-2xl'>
                <DialogHeader>
                  <DialogTitle>Configure mounted secrets</DialogTitle>
                  <DialogDescription>
                    Capture only safe metadata needed by the broker source
                    contract. File values remain inside the container or
                    orchestrator mount.
                  </DialogDescription>
                </DialogHeader>

                <div className='grid gap-4 md:grid-cols-2'>
                  {mountedSecretConfigFields.map(([label, value]) => (
                    <div key={label} className='space-y-2'>
                      <Label htmlFor={`mounted-secrets-${label}`}>
                        {label}
                      </Label>
                      <Input
                        id={`mounted-secrets-${label}`}
                        readOnly
                        value={value}
                      />
                    </div>
                  ))}
                </div>

                <div className='rounded-md border p-3 text-sm'>
                  <div className='font-medium'>Test action</div>
                  <div className='mt-1 text-muted-foreground'>
                    Metadata-only path existence, byte-limit, and symlink policy
                    check; mounted file contents are excluded from diagnostics
                    and audit events.
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

          <div className='grid gap-3 text-sm md:grid-cols-2'>
            {mountedSecretPolicyNotes.map((note) => (
              <div key={note} className='flex gap-2 rounded-md border p-3'>
                <Route className='mt-0.5 size-4 shrink-0 text-muted-foreground' />
                <span>{note}</span>
              </div>
            ))}
          </div>

          <div className='overflow-x-auto rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ref</TableHead>
                  <TableHead>Mounted file</TableHead>
                  <TableHead>Ownership</TableHead>
                  <TableHead>Policy</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mountedSecretMappings.map((mapping) => (
                  <TableRow key={mapping.ref}>
                    <TableCell className='min-w-72 align-top'>
                      {mapping.ref}
                    </TableCell>
                    <TableCell className='min-w-64 align-top'>
                      {mapping.file}
                    </TableCell>
                    <TableCell className='min-w-56 align-top'>
                      <div>{mapping.owner}</div>
                      <div className='text-sm text-muted-foreground'>
                        {mapping.namespace}
                      </div>
                    </TableCell>
                    <TableCell className='min-w-64 align-top'>
                      <div>root scoped</div>
                      <div className='text-sm text-muted-foreground'>
                        followSymlinks=false, maxBytes=4096
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
              <Badge variant='outline'>path metadata only</Badge>
              <Badge variant='outline'>no file contents</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
