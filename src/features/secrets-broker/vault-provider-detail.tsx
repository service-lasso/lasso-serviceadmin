import { KeyRound, ListChecks, Route, ShieldCheck } from 'lucide-react'
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

const vaultMappings = [
  {
    ref: 'secret://providers/vault/payments/STRIPE_KEY',
    mount: 'kv/service-lasso',
    path: 'payments/api',
    field: 'stripe_key',
    owner: 'payments-api',
    namespace: 'providers/vault/payments',
  },
  {
    ref: 'secret://providers/vault/release/SIGNING_KEY',
    mount: 'kv/service-lasso',
    path: 'release/signing',
    field: 'signing_key',
    owner: 'release-worker',
    namespace: 'providers/vault/release',
  },
]

const vaultConfigFields = [
  ['Address', 'https://vault.service-lasso.local'],
  ['Mount', 'kv/service-lasso'],
  ['Auth identity reference', 'secret://providers/vault/operator-session'],
  ['Token env handle', 'VAULT_TOKEN via broker-managed env ref'],
  ['Namespace', 'providers/vault/*'],
  ['Priority / fallback', 'addable until configured'],
] as const

const vaultPolicyNotes = [
  'Vault and OpenBao auth happens outside Service Admin or through broker-managed SecretRef handles.',
  'KV path and field mappings are explicit so wildcard reads are not implied.',
  'Sealed, locked, auth_required, and policy_denied states fail closed before value resolution.',
  'Metadata-only tests check address, mount, seal state, policy state, and mapping reachability without reading values.',
]

function vaultProvider() {
  return secretsBrokerSourceBackends.find((source) => source.id === 'vault-cli')
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
    ...vaultConfigFields.flat(),
    ...vaultMappings.flatMap((mapping) => Object.values(mapping)),
    ...vaultPolicyNotes,
  ]
    .join(' ')
    .toLowerCase()
    .includes(normalizedQuery)
}

export function VaultProviderDetail({ query = '' }: { query?: string }) {
  const provider = vaultProvider()

  if (!provider || !matchesQuery(provider, query)) return null

  return (
    <section className='space-y-4' aria-labelledby='vault-provider-heading'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <h2
            id='vault-provider-heading'
            className='flex items-center gap-2 text-xl font-semibold'
          >
            <KeyRound className='size-5' /> HashiCorp Vault / OpenBao provider
          </h2>
          <p className='mt-1 text-sm text-muted-foreground'>
            Provider-specific add/configure preview for address, mount,
            token-env handle, auth identity ref, KV path mappings, policy, seal
            state, priority, and fallback metadata.
          </p>
        </div>
        <div className='flex flex-wrap gap-2'>
          <Badge variant='outline'>addable</Badge>
          <Badge variant='secondary'>{provider.lifecycleDetail?.state}</Badge>
          <Badge variant='outline'>tokens hidden</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className='flex flex-wrap items-start justify-between gap-3'>
            <div>
              <CardTitle className='flex items-center gap-2'>
                <ListChecks className='size-4' /> Vault/OpenBao configuration
                metadata
              </CardTitle>
              <CardDescription>
                Vault tokens, OpenBao tokens, SecretString payloads, raw CLI
                output, and provider response bodies are never captured by this
                Service Admin surface.
              </CardDescription>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button type='button' variant='outline'>
                  <KeyRound className='size-4' /> Configure Vault/OpenBao
                </Button>
              </DialogTrigger>
              <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-2xl'>
                <DialogHeader>
                  <DialogTitle>Configure Vault/OpenBao</DialogTitle>
                  <DialogDescription>
                    Capture only safe metadata needed by the broker source
                    contract. Provider credentials remain outside Service Admin
                    or behind SecretRef handles.
                  </DialogDescription>
                </DialogHeader>

                <div className='grid gap-4 md:grid-cols-2'>
                  {vaultConfigFields.map(([label, value]) => (
                    <div key={label} className='space-y-2'>
                      <Label htmlFor={`vault-${label}`}>{label}</Label>
                      <Input id={`vault-${label}`} readOnly value={value} />
                    </div>
                  ))}
                </div>

                <div className='rounded-md border p-3 text-sm'>
                  <div className='font-medium'>Test action</div>
                  <div className='mt-1 text-muted-foreground'>
                    Metadata-only Vault/OpenBao status check; seal, auth,
                    policy, and mount state are recorded without fetching raw
                    secret values or CLI response bodies.
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
            {vaultPolicyNotes.map((note) => (
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
                  <TableHead>Mount / path</TableHead>
                  <TableHead>Field</TableHead>
                  <TableHead>Ownership</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vaultMappings.map((mapping) => (
                  <TableRow key={mapping.ref}>
                    <TableCell className='min-w-72 align-top'>
                      {mapping.ref}
                    </TableCell>
                    <TableCell className='min-w-56 align-top'>
                      <div>{mapping.mount}</div>
                      <div className='text-sm text-muted-foreground'>
                        {mapping.path}
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
              <Badge variant='outline'>policy metadata only</Badge>
              <Badge variant='outline'>no raw Vault/OpenBao output</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
