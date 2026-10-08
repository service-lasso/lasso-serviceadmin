import { useMemo, useState } from 'react'
import { FileKey, Folder, HardDrive, RefreshCw } from 'lucide-react'
import {
  useBrokerWebDAV,
  useRuntimeIdentity,
} from '@/lib/service-lasso-dashboard/hooks'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

function bytes(value: number) {
  if (value < 1024) return `${value} B`
  if (value < 1048576) return `${(value / 1024).toFixed(1)} KiB`
  return `${(value / 1048576).toFixed(1)} MiB`
}
function time(value?: string) {
  return value ? new Date(value).toLocaleString() : 'Never'
}

export function SecretsWebDAVPanel() {
  const identity = useRuntimeIdentity()
  const permissions = identity.data?.permissions ?? []
  const canRead =
    permissions.includes('*') || permissions.includes('workspace:read')
  const [cursor, setCursor] = useState('0')
  const [history, setHistory] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [owner, setOwner] = useState('')
  const [sort, setSort] = useState('name')
  const inventory = useBrokerWebDAV(cursor, canRead)
  const data = inventory.data
  const owners = useMemo(
    () => [...new Set(data?.files.map((file) => file.serviceId) ?? [])].sort(),
    [data]
  )
  const files = useMemo(
    () =>
      (data?.files ?? [])
        .filter(
          (file) =>
            (!owner || file.serviceId === owner) &&
            `${file.path} ${file.serviceId} ${file.workspaceId}`
              .toLowerCase()
              .includes(search.toLowerCase())
        )
        .sort((a, b) =>
          sort === 'size'
            ? b.sizeBytes - a.sizeBytes
            : sort === 'downloads'
              ? b.downloads - a.downloads
              : a.path.localeCompare(b.path)
        ),
    [data, owner, search, sort]
  )
  const refresh = () => {
    setHistory([])
    setOwner('')
    if (cursor !== '0') setCursor('0')
    else void inventory.refetch()
  }
  return (
    <Card data-testid='broker-webdav'>
      <CardHeader>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <CardTitle className='flex items-center gap-2'>
            <HardDrive className='size-4' /> RAM WebDAV files
          </CardTitle>
          <div className='flex items-center gap-2'>
            {canRead && data && !inventory.isError && (
              <Badge
                variant={data.state === 'listening' ? 'secondary' : 'outline'}
              >
                {data.state === 'listening'
                  ? 'Listening · loopback only'
                  : 'Stopped'}
              </Badge>
            )}
            <Button
              variant='outline'
              size='sm'
              onClick={refresh}
              disabled={!canRead || inventory.isFetching}
            >
              <RefreshCw className='mr-2 size-4' />
              Refresh files
            </Button>
          </div>
        </div>
        <CardDescription>
          Read-only files supplied to services from Broker memory. Metadata and
          usage only.
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        {!canRead ? (
          <p role='status'>
            Workspace read permission is required to view WebDAV files.
          </p>
        ) : inventory.isError ? (
          <p role='alert'>
            WebDAV inventory is unavailable. Check Broker status and try
            refreshing.
          </p>
        ) : !data ? (
          <p role='status'>Loading WebDAV inventory…</p>
        ) : (
          <>
            <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
              {[
                [
                  'RAM used',
                  `${bytes(data.usedBytes)} / ${bytes(data.capacityBytes)}`,
                ],
                ['Active grants', data.activeGrants],
                ['Files', data.fileCount],
                ['Completed downloads', data.downloads],
              ].map(([label, value]) => (
                <div key={label} className='rounded-lg border bg-muted/20 p-4'>
                  <p className='text-sm text-muted-foreground'>{label}</p>
                  <p className='mt-1 text-xl font-semibold'>{value}</p>
                </div>
              ))}
            </div>
            <progress
              aria-label='WebDAV RAM usage'
              value={data.usedBytes}
              max={data.capacityBytes}
              className='h-2 w-full accent-primary'
            />
            <div className='flex flex-wrap gap-3'>
              <Input
                aria-label='Search WebDAV files'
                placeholder='Search files or services on this page'
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className='max-w-sm'
              />
              <select
                aria-label='Sort WebDAV files'
                className='rounded-md border bg-background px-3 text-sm'
                value={sort}
                onChange={(event) => setSort(event.target.value)}
              >
                <option value='name'>Name</option>
                <option value='size'>Largest first</option>
                <option value='downloads'>Most downloaded</option>
              </select>
            </div>
            <div className='grid gap-4 lg:grid-cols-[180px_1fr]'>
              <nav
                aria-label='WebDAV service folders'
                className='space-y-1 rounded-md border p-2'
              >
                <Button
                  variant={owner === '' ? 'secondary' : 'ghost'}
                  className='w-full justify-start'
                  onClick={() => setOwner('')}
                >
                  <Folder className='mr-2 size-4' />
                  All services
                </Button>
                {owners.map((service) => (
                  <Button
                    key={service}
                    variant={owner === service ? 'secondary' : 'ghost'}
                    className='w-full justify-start'
                    onClick={() => setOwner(service)}
                  >
                    <Folder className='mr-2 size-4 shrink-0' />
                    <span className='truncate'>{service}</span>
                  </Button>
                ))}
              </nav>
              <div className='min-w-0 overflow-x-auto rounded-md border'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Downloads</TableHead>
                      <TableHead>Bytes served</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Last access</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {files.map((file) => (
                      <TableRow key={`${file.grantId}/${file.path}`}>
                        <TableCell>
                          <span className='flex items-center gap-2'>
                            <FileKey className='size-4 shrink-0' />
                            {file.path}
                          </span>
                        </TableCell>
                        <TableCell>
                          {file.serviceId}
                          <div className='text-xs text-muted-foreground'>
                            {file.workspaceId}
                          </div>
                        </TableCell>
                        <TableCell>{bytes(file.sizeBytes)}</TableCell>
                        <TableCell>{file.downloads}</TableCell>
                        <TableCell>{bytes(file.servedBytes)}</TableCell>
                        <TableCell>{time(file.createdAt)}</TableCell>
                        <TableCell>{time(file.lastAccessAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {files.length === 0 && (
                  <p
                    role='status'
                    className='p-6 text-center text-muted-foreground'
                  >
                    {data.fileCount === 0
                      ? 'No active secret files. Start a service configured with ephemeral files.'
                      : 'No matching files on this page.'}
                  </p>
                )}
              </div>
            </div>
            <div className='flex items-center justify-between gap-3'>
              <p className='text-xs text-muted-foreground'>
                Served: {bytes(data.servedBytes)} · Updated{' '}
                {time(data.generatedAt)}
              </p>
              <div className='flex gap-2'>
                <Button
                  size='sm'
                  variant='outline'
                  disabled={history.length === 0}
                  onClick={() => {
                    setCursor(history[history.length - 1])
                    setHistory(history.slice(0, -1))
                    setOwner('')
                  }}
                >
                  Previous page
                </Button>
                <Button
                  size='sm'
                  variant='outline'
                  disabled={!data.nextCursor}
                  onClick={() => {
                    if (data.nextCursor) {
                      setHistory([...history, cursor])
                      setCursor(data.nextCursor)
                      setOwner('')
                    }
                  }}
                >
                  Next page
                </Button>
              </div>
            </div>
            <p className='text-xs text-muted-foreground'>
              Counts cover active grants and reset on rotation, revocation or
              Broker restart. HEAD and directory listings do not count as
              downloads. Bytes served measure server writes.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
