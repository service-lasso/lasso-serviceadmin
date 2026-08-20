import { useEffect, useMemo, useState } from 'react'
import Editor, { DiffEditor } from '@monaco-editor/react'
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileClock,
  GitCompare,
  RefreshCw,
  Save,
  Search,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  fetchServiceConfigDocument,
  saveServiceConfigDocument,
} from '@/lib/service-lasso-dashboard/client'
import type {
  DashboardService,
  ServiceConfigDocument,
  ServiceConfigRevision,
} from '@/lib/service-lasso-dashboard/types'
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
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type JsonValidationState =
  | { status: 'valid'; formatted: string }
  | { status: 'invalid'; message: string }

function validateJsonObject(value: string): JsonValidationState {
  try {
    const parsed = JSON.parse(value) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {
        status: 'invalid',
        message: 'server.json must be a JSON object.',
      }
    }
    return {
      status: 'valid',
      formatted: `${JSON.stringify(parsed, null, 2)}\n`,
    }
  } catch (error) {
    return {
      status: 'invalid',
      message: error instanceof Error ? error.message : 'Invalid JSON.',
    }
  }
}

function shortHash(value: string) {
  return value.slice(0, 12)
}

function revisionLabel(revision: ServiceConfigRevision) {
  return `${new Date(revision.createdAt).toLocaleString()} · ${shortHash(
    revision.previousHash
  )}`
}

const REVISION_PAGE_SIZE_OPTIONS = [10, 25, 50] as const

function revisionSearchText(revision: ServiceConfigRevision) {
  return [
    new Date(revision.createdAt).toLocaleString(),
    revision.actor,
    revision.previousHash,
    shortHash(revision.previousHash),
    revision.reason ?? 'Not recorded',
  ]
    .join(' ')
    .toLowerCase()
}

function sortNewestRevisions(revisions: ServiceConfigRevision[]) {
  return [...revisions].sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  )
}

function RevisionTable({
  revisions,
  selectedRevisionId,
  onSelect,
}: {
  revisions: ServiceConfigRevision[]
  selectedRevisionId: string | null
  onSelect: (revision: ServiceConfigRevision) => void
}) {
  const [filter, setFilter] = useState('')
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] =
    useState<(typeof REVISION_PAGE_SIZE_OPTIONS)[number]>(10)

  const normalizedFilter = filter.trim().toLowerCase()
  const sortedRevisions = useMemo(
    () => sortNewestRevisions(revisions),
    [revisions]
  )
  const filteredRevisions = useMemo(() => {
    if (!normalizedFilter) return sortedRevisions
    return sortedRevisions.filter((revision) =>
      revisionSearchText(revision).includes(normalizedFilter)
    )
  }, [normalizedFilter, sortedRevisions])
  const pageCount = Math.max(1, Math.ceil(filteredRevisions.length / pageSize))
  const safePageIndex = Math.min(pageIndex, pageCount - 1)
  const pageStart = safePageIndex * pageSize
  const visibleRevisions = filteredRevisions.slice(
    pageStart,
    pageStart + pageSize
  )
  const resultStart = filteredRevisions.length ? pageStart + 1 : 0
  const resultEnd = Math.min(
    pageStart + visibleRevisions.length,
    filteredRevisions.length
  )

  const emptyMessage = normalizedFilter
    ? 'No backup revisions match the current filter.'
    : 'No backup revisions have been recorded for this service yet.'

  return (
    <div className='space-y-3'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <label className='relative min-w-0 flex-1 sm:max-w-sm'>
          <span className='sr-only'>Search backup history</span>
          <Search className='pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value)
              setPageIndex(0)
            }}
            placeholder='Search backups'
            className='pl-9'
          />
        </label>
        <div className='flex items-center gap-2 text-sm'>
          <span className='text-muted-foreground'>Rows</span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => {
              setPageSize(Number(value) as typeof pageSize)
              setPageIndex(0)
            }}
          >
            <SelectTrigger size='sm' aria-label='Rows per page'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REVISION_PAGE_SIZE_OPTIONS.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className='overflow-x-auto rounded-md border'>
        <Table className='min-w-[760px] table-fixed'>
          <colgroup>
            <col className='w-[24%]' />
            <col className='w-[16%]' />
            <col className='w-[18%]' />
            <col className='w-[22%]' />
            <col className='w-[20%]' />
          </colgroup>
          <TableHeader>
            <TableRow>
              <TableHead>Created</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Previous hash</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRevisions.length ? (
              visibleRevisions.map((revision) => (
                <TableRow key={revision.id}>
                  <TableCell className='align-top text-sm whitespace-normal'>
                    {new Date(revision.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell className='align-top text-sm whitespace-normal'>
                    {revision.actor}
                  </TableCell>
                  <TableCell className='align-top font-mono text-xs break-all text-muted-foreground'>
                    {shortHash(revision.previousHash)}
                  </TableCell>
                  <TableCell className='align-top text-sm whitespace-normal text-muted-foreground'>
                    {revision.reason ?? 'Not recorded'}
                  </TableCell>
                  <TableCell className='align-top'>
                    <Button
                      type='button'
                      size='sm'
                      variant={
                        selectedRevisionId === revision.id
                          ? 'default'
                          : 'outline'
                      }
                      onClick={() => onSelect(revision)}
                    >
                      <GitCompare className='mr-2 size-4' />
                      Compare
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className='h-20 text-center'>
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className='flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground'>
        <div>
          Showing {resultStart}-{resultEnd} of {filteredRevisions.length}
          {filteredRevisions.length !== revisions.length
            ? ` matching ${revisions.length} total`
            : ''}
        </div>
        <div className='flex items-center gap-2'>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() => setPageIndex(Math.max(0, safePageIndex - 1))}
            disabled={safePageIndex === 0}
            aria-label='Previous backup history page'
          >
            <ChevronLeft className='size-4' />
          </Button>
          <span>
            Page {safePageIndex + 1} of {pageCount}
          </span>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() =>
              setPageIndex(Math.min(pageCount - 1, safePageIndex + 1))
            }
            disabled={safePageIndex >= pageCount - 1}
            aria-label='Next backup history page'
          >
            <ChevronRight className='size-4' />
          </Button>
        </div>
      </div>
    </div>
  )
}

function ComparePanel({
  revision,
  editorContent,
}: {
  revision: ServiceConfigRevision | null
  editorContent: string
}) {
  if (!revision) {
    return (
      <div className='rounded-md border border-dashed p-4 text-sm text-muted-foreground'>
        Select a backup revision to compare it with the current editor buffer.
      </div>
    )
  }

  if (!revision.content.trim()) {
    return (
      <div className='rounded-md border border-destructive/45 p-4 text-sm'>
        <div className='font-medium text-destructive'>
          Backup content unavailable
        </div>
        <div className='mt-1 text-muted-foreground'>
          Select another backup revision or reload server.json before comparing.
        </div>
      </div>
    )
  }

  return (
    <div className='space-y-3'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <div className='text-sm font-medium'>Monaco diff editor</div>
          <div className='text-sm text-muted-foreground'>
            Original backup revision compared with the current editor buffer.
          </div>
        </div>
        <div className='flex flex-wrap gap-2'>
          <Badge variant='outline'>
            Original: backup {revisionLabel(revision)}
          </Badge>
          <Badge variant='secondary'>Modified: current editor buffer</Badge>
        </div>
      </div>
      <div
        className='min-w-0 overflow-hidden rounded-md border'
        data-testid='service-config-diff-editor'
      >
        <DiffEditor
          height='440px'
          language='json'
          original={revision.content}
          modified={editorContent}
          theme='vs-dark'
          options={{
            automaticLayout: true,
            minimap: { enabled: false },
            originalEditable: false,
            readOnly: true,
            renderSideBySide: true,
            scrollBeyondLastLine: false,
            wordWrap: 'on',
          }}
          loading='Loading server.json diff editor'
        />
      </div>
    </div>
  )
}

export function ServiceConfigEditor({
  service,
}: {
  service: DashboardService
}) {
  const [document, setDocument] = useState<ServiceConfigDocument | null>(null)
  const [editorContent, setEditorContent] = useState('')
  const [savedContent, setSavedContent] = useState('')
  const [auditReason, setAuditReason] = useState('')
  const [selectedRevisionId, setSelectedRevisionId] = useState<string | null>(
    null
  )
  const [status, setStatus] = useState<string>('Loading server.json')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [reloadDialogOpen, setReloadDialogOpen] = useState(false)

  const validation = useMemo(
    () => validateJsonObject(editorContent),
    [editorContent]
  )
  const isDirty = editorContent !== savedContent
  const selectedRevision =
    document?.revisions.find(
      (revision) => revision.id === selectedRevisionId
    ) ?? null

  const loadConfig = async ({ force = false } = {}) => {
    if (isDirty && !force) {
      setReloadDialogOpen(true)
      return
    }

    setIsLoading(true)
    setStatus('Loading server.json')
    try {
      const nextDocument = await fetchServiceConfigDocument(service.id)
      const sortedRevisions = sortNewestRevisions(nextDocument.revisions)
      setDocument(nextDocument)
      setEditorContent(nextDocument.content)
      setSavedContent(nextDocument.content)
      setSelectedRevisionId(sortedRevisions[0]?.id ?? null)
      setStatus('Loaded current runtime server.json')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Load failed')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadConfig({ force: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service.id])

  const formatEditorJson = () => {
    if (validation.status !== 'valid') {
      setStatus(validation.message)
      return
    }
    setEditorContent(validation.formatted)
    setStatus('Formatted server.json')
  }

  const saveConfig = async () => {
    if (validation.status !== 'valid') {
      setStatus(validation.message)
      return
    }

    setIsSaving(true)
    setStatus('Saving server.json')
    try {
      await saveServiceConfigDocument({
        serviceId: service.id,
        content: validation.formatted,
        reason: auditReason,
      })
      const nextDocument = await fetchServiceConfigDocument(service.id)
      const sortedRevisions = sortNewestRevisions(nextDocument.revisions)
      setDocument(nextDocument)
      setEditorContent(nextDocument.content)
      setSavedContent(nextDocument.content)
      setSelectedRevisionId(sortedRevisions[0]?.id ?? null)
      setAuditReason('')
      setStatus('Saved server.json and created a backup revision')
      toast.success('server.json saved with backup history.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Save failed'
      setStatus(message)
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <Card data-testid='service-config-editor'>
        <CardHeader>
          <div className='flex flex-wrap items-start justify-between gap-3'>
            <div className='space-y-1'>
              <CardTitle className='flex items-center gap-2'>
                <FileClock className='size-4' /> server.json editor
              </CardTitle>
              <CardDescription>
                {document?.path ??
                  service.metadata.configPath ??
                  'Service manifest path unavailable'}
              </CardDescription>
            </div>
            <div className='flex flex-wrap gap-2'>
              <Badge
                variant={
                  validation.status === 'valid' ? 'outline' : 'destructive'
                }
              >
                {validation.status === 'valid' ? 'Valid JSON' : 'Invalid JSON'}
              </Badge>
              <Badge variant={isDirty ? 'secondary' : 'outline'}>
                {isDirty ? 'Unsaved changes' : 'Saved'}
              </Badge>
              <Badge variant='outline'>
                {document?.backupCount ?? 0} backups
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className='space-y-5'>
          <div className='grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]'>
            <div className='min-w-0 overflow-hidden rounded-md border'>
              <Editor
                height='520px'
                defaultLanguage='json'
                language='json'
                value={editorContent}
                theme='vs-dark'
                options={{
                  automaticLayout: true,
                  formatOnPaste: true,
                  formatOnType: true,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  tabSize: 2,
                  wordWrap: 'on',
                }}
                loading='Loading server.json editor'
                onChange={(value) => setEditorContent(value ?? '')}
              />
            </div>
            <div className='space-y-4'>
              <label className='block space-y-2 text-sm font-medium'>
                Audit reason
                <textarea
                  className='min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm'
                  value={auditReason}
                  onChange={(event) => setAuditReason(event.target.value)}
                  placeholder='Describe the operator change'
                />
              </label>
              <div className='flex flex-wrap gap-2'>
                <Button
                  type='button'
                  variant='outline'
                  onClick={formatEditorJson}
                  disabled={validation.status !== 'valid'}
                >
                  <CheckCircle2 className='mr-2 size-4' />
                  Format
                </Button>
                <Button
                  type='button'
                  variant='outline'
                  onClick={() => void loadConfig()}
                  disabled={isLoading}
                >
                  <RefreshCw className='mr-2 size-4' />
                  Reload
                </Button>
                <Button
                  type='button'
                  onClick={() => void saveConfig()}
                  disabled={
                    !isDirty ||
                    isSaving ||
                    validation.status !== 'valid' ||
                    !auditReason.trim()
                  }
                >
                  <Save className='mr-2 size-4' />
                  Save
                </Button>
              </div>
              <div className='rounded-md border bg-muted/35 p-3 text-sm'>
                {validation.status === 'invalid' ? validation.message : status}
              </div>
            </div>
          </div>

          <div className='space-y-3'>
            <div>
              <h3 className='text-sm font-medium'>Backup history</h3>
              <p className='text-sm text-muted-foreground'>
                Each successful save records the previous runtime-backed
                server.json for review.
              </p>
            </div>
            <RevisionTable
              revisions={document?.revisions ?? []}
              selectedRevisionId={selectedRevisionId}
              onSelect={(revision) => setSelectedRevisionId(revision.id)}
            />
            <ComparePanel
              revision={selectedRevision}
              editorContent={editorContent}
            />
          </div>
        </CardContent>
      </Card>

      <Dialog open={reloadDialogOpen} onOpenChange={setReloadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard unsaved server.json changes?</DialogTitle>
            <DialogDescription>
              Reloading will replace the editor buffer with the current runtime
              file.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type='button' variant='outline'>
                Keep editing
              </Button>
            </DialogClose>
            <Button
              type='button'
              variant='destructive'
              onClick={() => {
                setReloadDialogOpen(false)
                void loadConfig({ force: true })
              }}
            >
              Discard and reload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
