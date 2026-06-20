import {
  Activity,
  AlertTriangle,
  Braces,
  FileText,
  ListChecks,
  TerminalSquare,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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

const providerIcons = {
  env: Braces,
  file: FileText,
  exec: TerminalSquare,
}

const resolutionNotes: Record<'env' | 'file' | 'exec', string[]> = {
  env: [
    'Matches explicit env ref mappings only.',
    'Reports variable names and match counts without values.',
    'Read-only bootstrap source; write and rotate stay unavailable.',
  ],
  file: [
    'Matches configured files or fields under approved root paths.',
    'Blocks unsafe paths, sandbox escapes, and symlink traversal by policy.',
    'File contents are never rendered in Service Admin.',
  ],
  exec: [
    'Runs only explicitly allowlisted resolver commands.',
    'Requires trusted paths, timeout, output byte limits, and protocol checks.',
    'Stdout, stderr, and credential payloads are scrubbed from diagnostics.',
  ],
}

function localBootstrapProviders() {
  return secretsBrokerSourceBackends.filter((source) =>
    ['env', 'file', 'exec'].includes(source.type)
  ) as Array<SecretsBrokerSourceBackend & { type: 'env' | 'file' | 'exec' }>
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
  ]
    .join(' ')
    .toLowerCase()
    .includes(normalizedQuery)
}

function SourceIdentity({
  provider,
}: {
  provider: SecretsBrokerSourceBackend
}) {
  return (
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
        <div className='text-xs text-muted-foreground'>enabled</div>
        <div className='font-medium'>{String(provider.enabled)}</div>
      </div>
      <div>
        <div className='text-xs text-muted-foreground'>critical</div>
        <div className='font-medium'>{String(provider.critical)}</div>
      </div>
      <div>
        <div className='text-xs text-muted-foreground'>priority</div>
        <div className='font-medium'>{provider.priority ?? 'not assigned'}</div>
      </div>
    </div>
  )
}

export function LocalBootstrapProviderDetails({
  query = '',
}: {
  query?: string
}) {
  const providers = localBootstrapProviders().filter((provider) =>
    matchesQuery(provider, query)
  )

  if (providers.length === 0) return null

  return (
    <section className='space-y-4' aria-labelledby='bootstrap-provider-heading'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <h2
            id='bootstrap-provider-heading'
            className='flex items-center gap-2 text-xl font-semibold'
          >
            <ListChecks className='size-5' /> Local bootstrap providers
          </h2>
          <p className='mt-1 text-sm text-muted-foreground'>
            Shared metadata-only detail pattern for Environment, File, and Exec
            sources. These providers read mapped refs only and do not expose
            generic write, rotate, or reveal-by-default controls.
          </p>
        </div>
        <div className='flex flex-wrap gap-2'>
          <Badge variant='secondary'>Env / File / Exec</Badge>
          <Badge variant='outline'>No raw values</Badge>
          <Badge variant='outline'>Read-only by default</Badge>
        </div>
      </div>

      <div className='grid gap-4 xl:grid-cols-3'>
        {providers.map((provider) => {
          const Icon = providerIcons[provider.type]

          return (
            <Card key={provider.id}>
              <CardHeader>
                <div className='flex flex-wrap items-start justify-between gap-3'>
                  <div>
                    <CardTitle className='flex items-center gap-2 text-lg'>
                      <Icon className='size-4' /> {provider.title}
                    </CardTitle>
                    <CardDescription>{provider.summary}</CardDescription>
                  </div>
                  <Badge
                    variant={
                      provider.state === 'failing'
                        ? 'destructive'
                        : provider.state === 'reachable'
                          ? 'default'
                          : 'outline'
                    }
                  >
                    {provider.state}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className='space-y-4'>
                <SourceIdentity provider={provider} />

                <div className='rounded-md border p-3 text-sm'>
                  <div className='mb-2 font-medium'>Lifecycle</div>
                  <div className='flex flex-wrap gap-2'>
                    <Badge variant='secondary'>
                      {provider.lifecycleDetail?.state}
                    </Badge>
                    <Badge variant='outline'>
                      {provider.lifecycleDetail?.outcome}
                    </Badge>
                    <Badge variant='outline'>
                      retryable {String(provider.lifecycleDetail?.retryable)}
                    </Badge>
                  </div>
                  <div className='mt-2 text-muted-foreground'>
                    {provider.lifecycleDetail?.nextAction}
                  </div>
                </div>

                <div className='space-y-2 text-sm'>
                  <div className='font-medium'>Capabilities</div>
                  <div className='flex flex-wrap gap-2'>
                    {provider.capabilities?.map((capability) => (
                      <Badge key={capability} variant='outline'>
                        {capability}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className='space-y-2 text-sm'>
                  <div className='font-medium'>Resolution / fallback</div>
                  {resolutionNotes[provider.type].map((note) => (
                    <div key={note} className='rounded-md border p-2'>
                      {note}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Activity className='size-4' /> Mappings, diagnostics, and audit
          </CardTitle>
          <CardDescription>
            Explicit refs, namespace matching, warnings, and test metadata are
            shown without env values, file contents, command output, tokens, or
            credentials.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='overflow-x-auto rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead>Explicit refs / namespaces</TableHead>
                  <TableHead>Diagnostics</TableHead>
                  <TableHead>Warnings</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {providers.map((provider) => (
                  <TableRow key={provider.id}>
                    <TableCell className='min-w-56 align-top'>
                      <div className='font-medium'>{provider.title}</div>
                      <div className='text-sm text-muted-foreground'>
                        {provider.brokerState}
                      </div>
                    </TableCell>
                    <TableCell className='min-w-72 align-top'>
                      <div className='space-y-1 text-sm'>
                        {provider.exampleRefs.map((ref) => (
                          <div key={ref}>{ref}</div>
                        ))}
                        <div className='text-muted-foreground'>
                          namespaces:{' '}
                          {provider.namespaces.length
                            ? provider.namespaces.join(', ')
                            : 'explicit mappings pending'}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className='min-w-72 align-top'>
                      <div className='space-y-1 text-sm'>
                        {provider.testResult.metadata.map((item) => (
                          <div key={item}>{item}</div>
                        ))}
                        <div className='text-muted-foreground'>
                          audit: metadata event only
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className='min-w-72 align-top'>
                      <div className='space-y-2 text-sm'>
                        {provider.warnings.map((warning) => (
                          <div key={warning.code} className='flex gap-2'>
                            <AlertTriangle className='mt-0.5 size-4 shrink-0' />
                            <div>
                              <div className='font-medium'>{warning.title}</div>
                              <div className='text-muted-foreground'>
                                {warning.description}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className='rounded-md border p-3 text-sm text-muted-foreground'>
            Backup, restore, recovery shares, master-key material, provider
            credentials, broad plaintext editing, and raw bulk reveal controls
            remain exclusive to their appropriate flows and are not part of
            these bootstrap provider details.
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
