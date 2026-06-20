import { Cloud, ListChecks, Route, ShieldCheck } from 'lucide-react'
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

const awsSecretMappings = [
  {
    ref: 'secret://providers/aws/default/backup-worker',
    region: 'ap-southeast-2',
    secretId: '/service-lasso/backup-worker',
    field: 'runtime_token',
    owner: 'backup-worker',
    namespace: 'providers/aws/default',
  },
  {
    ref: 'secret://providers/aws/payments/signing-ref',
    region: 'us-east-1',
    secretId: '/service-lasso/payments/signing',
    field: 'signing_ref',
    owner: 'payments-api',
    namespace: 'providers/aws/payments',
  },
]

const awsConfigFields = [
  ['Region', 'ap-southeast-2'],
  ['Account / profile', 'service-lasso-ops profile metadata'],
  ['Token env handle', 'AWS_SESSION_TOKEN presence check only'],
  ['Endpoint override', 'http://127.0.0.1:4566 for tests'],
  ['Secret id mapping', '/service-lasso/{service}/{ref}'],
  ['Path / field mapping', 'JSON field selector metadata only'],
  ['Namespace ownership', 'providers/aws/*'],
  ['Priority / fallback', 'addable until configured'],
] as const

const awsPolicyNotes = [
  'AWS authentication happens outside Service Admin or through broker-managed environment/SecretRef handles.',
  'Secret ids, paths, fields, regions, account/profile names, and endpoint overrides are metadata only.',
  'Metadata-only tests check caller identity availability, region reachability, mapping shape, and IAM denial state without fetching SecretString values.',
  'Auth-required, policy-denied, missing-ref, and configuration-error outcomes fail closed before value resolution.',
]

function awsProvider() {
  return secretsBrokerSourceBackends.find(
    (source) => source.id === 'aws-secrets-manager-cli'
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
    ...awsConfigFields.flat(),
    ...awsSecretMappings.flatMap((mapping) => Object.values(mapping)),
    ...awsPolicyNotes,
  ]
    .join(' ')
    .toLowerCase()
    .includes(normalizedQuery)
}

export function AwsSecretsManagerProviderDetail({
  query = '',
}: {
  query?: string
}) {
  const provider = awsProvider()

  if (!provider || !matchesQuery(provider, query)) return null

  return (
    <section className='space-y-4' aria-labelledby='aws-provider-heading'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <h2
            id='aws-provider-heading'
            className='flex items-center gap-2 text-xl font-semibold'
          >
            <Cloud className='size-5' /> AWS Secrets Manager CLI provider
          </h2>
          <p className='mt-1 text-sm text-muted-foreground'>
            Provider-specific add/configure preview for region, account/profile,
            token-env handle, endpoint override, secret id/path/field mappings,
            namespace ownership, priority, and fallback metadata.
          </p>
        </div>
        <div className='flex flex-wrap gap-2'>
          <Badge variant='outline'>addable</Badge>
          <Badge variant='secondary'>{provider.lifecycleDetail?.state}</Badge>
          <Badge variant='outline'>SecretString hidden</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className='flex flex-wrap items-start justify-between gap-3'>
            <div>
              <CardTitle className='flex items-center gap-2'>
                <ListChecks className='size-4' /> AWS configuration metadata
              </CardTitle>
              <CardDescription>
                AWS access keys, session tokens, SecretString values, raw
                response bodies, and provider errors containing values are never
                captured by this Service Admin surface.
              </CardDescription>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button type='button' variant='outline'>
                  <Cloud className='size-4' /> Configure AWS Secrets Manager
                </Button>
              </DialogTrigger>
              <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-2xl'>
                <DialogHeader>
                  <DialogTitle>Configure AWS Secrets Manager</DialogTitle>
                  <DialogDescription>
                    Capture only safe metadata needed by the broker source
                    contract. Credential material remains outside Service Admin.
                  </DialogDescription>
                </DialogHeader>

                <div className='grid gap-4 md:grid-cols-2'>
                  {awsConfigFields.map(([label, value]) => (
                    <div key={label} className='space-y-2'>
                      <Label htmlFor={`aws-${label}`}>{label}</Label>
                      <Input id={`aws-${label}`} readOnly value={value} />
                    </div>
                  ))}
                </div>

                <div className='rounded-md border p-3 text-sm'>
                  <div className='font-medium'>Test action</div>
                  <div className='mt-1 text-muted-foreground'>
                    Metadata-only AWS CLI probe; caller identity, region,
                    endpoint, mapping shape, and IAM denial status are recorded
                    without reading SecretString or SecretBinary payloads.
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
            {awsPolicyNotes.map((note) => (
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
                  <TableHead>Region / secret id</TableHead>
                  <TableHead>Field</TableHead>
                  <TableHead>Ownership</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {awsSecretMappings.map((mapping) => (
                  <TableRow key={mapping.ref}>
                    <TableCell className='min-w-72 align-top'>
                      {mapping.ref}
                    </TableCell>
                    <TableCell className='min-w-64 align-top'>
                      <div>{mapping.region}</div>
                      <div className='text-sm text-muted-foreground'>
                        {mapping.secretId}
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
              <Badge variant='outline'>IAM metadata only</Badge>
              <Badge variant='outline'>no raw AWS output</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
