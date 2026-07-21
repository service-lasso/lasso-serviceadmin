import { useMemo, useState } from 'react'
import { Link, getRouteApi } from '@tanstack/react-router'
import { BookOpenText, FileText, FolderOpen, Search } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
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
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'

const route = getRouteApi('/_authenticated/help-center/')

const docsModules = import.meta.glob('../../../docs/help/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

type DocEntry = {
  id: string
  path: string
  fileName: string
  section: string
  title: string
  description: string
  status: DocStatus
  tags: string[]
  content: string
  searchableText: string
}

type DocStatus =
  | 'runtime-backed'
  | 'metadata-only'
  | 'preview'
  | 'stub-dev-only'
  | 'planned'
  | 'unspecified'

type DocMetadata = {
  title?: string
  description?: string
  status?: DocStatus
  tags: string[]
}

const statusLabels: Record<DocStatus, string> = {
  'runtime-backed': 'Runtime-backed',
  'metadata-only': 'Metadata-only',
  preview: 'Preview',
  'stub-dev-only': 'Stub/dev-only',
  planned: 'Planned',
  unspecified: 'Unspecified',
}

function toTitleCase(input: string) {
  return input
    .replace(/[-_]+/g, ' ')
    .replace(/\.md$/i, '')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function normalizeStatus(input?: string): DocStatus {
  const normalized = input?.trim().toLowerCase().replace(/\s+/g, '-')
  if (!normalized) return 'unspecified'

  if (normalized.includes('runtime-backed')) return 'runtime-backed'
  if (normalized.includes('metadata-only')) return 'metadata-only'
  if (normalized.includes('stub') || normalized.includes('dev-only')) {
    return 'stub-dev-only'
  }
  if (normalized.includes('planned')) return 'planned'
  if (normalized.includes('preview')) return 'preview'

  return 'unspecified'
}

function parseTags(input?: string) {
  if (!input) return []

  return input
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .split(',')
    .map((tag) => tag.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean)
}

function parseFrontmatter(body: string): {
  metadata: DocMetadata
  content: string
} {
  const match = body.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!match) {
    return {
      metadata: { tags: [] },
      content: body,
    }
  }

  const metadata = match[1].split(/\r?\n/).reduce<DocMetadata>(
    (acc, line) => {
      const parsed = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/)
      if (!parsed) return acc

      const key = parsed[1].toLowerCase()
      const value = parsed[2].trim().replace(/^["']|["']$/g, '')

      if (key === 'title') acc.title = value
      if (key === 'description') acc.description = value
      if (key === 'status') acc.status = normalizeStatus(value)
      if (key === 'tags') acc.tags = parseTags(value)

      return acc
    },
    { tags: [] }
  )

  return {
    metadata,
    content: body.slice(match[0].length),
  }
}

function getStatusFromContent(content: string) {
  return normalizeStatus(content.match(/^Status:\s*(.+)$/im)?.[1])
}

function getDescription(content: string) {
  const withoutTitle = content.replace(/^#\s+.+\r?\n+/, '')
  const paragraph = withoutTitle
    .split(/\r?\n\r?\n/)
    .map((block) => block.trim())
    .find(
      (block) =>
        block &&
        !block.startsWith('#') &&
        !block.startsWith('|') &&
        !block.startsWith('- ') &&
        !/^Status:/i.test(block)
    )

  return paragraph
    ? paragraph
        .replace(/\s+/g, ' ')
        .replace(/[`*_#[\]()]/g, '')
        .slice(0, 160)
    : 'Operator Help Center article.'
}

function buildDocEntries(): DocEntry[] {
  return Object.entries(docsModules)
    .map(([path, body]) => {
      const { metadata, content } = parseFrontmatter(body)
      const relative = path.replace(/^((\.\.\/)+)?docs\//, '')
      const parts = relative.split('/')
      const fileName = parts[parts.length - 1]
      const section =
        parts.length > 1 ? toTitleCase(parts.slice(0, -1).join(' / ')) : 'Docs'
      const firstHeading = content.match(/^#\s+(.+)$/m)?.[1]?.trim()
      const title = metadata.title || firstHeading || toTitleCase(fileName)
      const description = metadata.description || getDescription(content)
      const status = metadata.status ?? getStatusFromContent(content)

      return {
        id: relative.toLowerCase(),
        path: relative,
        fileName,
        section,
        title,
        description,
        status,
        tags: metadata.tags,
        content,
        searchableText: [
          title,
          description,
          statusLabels[status],
          metadata.tags.join(' '),
          relative,
          section,
          content,
        ]
          .join(' ')
          .toLowerCase(),
      }
    })
    .sort((a, b) => a.path.localeCompare(b.path))
}

function MarkdownArticle({ content }: { content: string }) {
  return (
    <div className='space-y-4 text-sm leading-7 text-foreground'>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className='mt-2 text-3xl font-bold tracking-tight'>
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className='mt-8 text-2xl font-semibold tracking-tight'>
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className='mt-6 text-xl font-semibold tracking-tight'>
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className='text-muted-foreground'>{children}</p>
          ),
          ul: ({ children }) => (
            <ul className='list-disc space-y-2 pl-6 text-muted-foreground'>
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className='list-decimal space-y-2 pl-6 text-muted-foreground'>
              {children}
            </ol>
          ),
          li: ({ children }) => <li>{children}</li>,
          code: ({ children }) => (
            <code className='rounded bg-muted px-1.5 py-0.5 font-mono text-xs'>
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className='overflow-x-auto rounded-lg border bg-muted p-4 text-xs'>
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className='border-l-2 pl-4 text-muted-foreground italic'>
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className='overflow-x-auto rounded-lg border'>
              <table className='w-full border-collapse text-sm'>
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className='bg-muted/50'>{children}</thead>
          ),
          th: ({ children }) => (
            <th className='border-b px-3 py-2 text-left font-medium'>
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className='border-b px-3 py-2 align-top text-muted-foreground'>
              {children}
            </td>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target='_blank'
              rel='noreferrer'
              className='font-medium text-primary underline underline-offset-4'
            >
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

export function HelpCenter() {
  usePageMetadata({
    title: 'Service Admin - Help Center',
    description:
      'Guides and runbooks for operating local Service Lasso services.',
  })

  const search = route.useSearch()
  const navigate = route.useNavigate()
  const [query, setQuery] = useState('')

  const docs = useMemo(() => buildDocEntries(), [])

  const filteredDocs = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return docs

    return docs.filter((doc) => doc.searchableText.includes(normalized))
  }, [docs, query])

  const selectedDoc = useMemo(() => {
    return (
      filteredDocs.find((doc) => doc.id === search.doc) ??
      filteredDocs[0] ??
      docs[0] ??
      null
    )
  }, [docs, filteredDocs, search.doc])

  const groupedDocs = useMemo(() => {
    return filteredDocs.reduce<Record<string, DocEntry[]>>((acc, doc) => {
      acc[doc.section] ??= []
      acc[doc.section].push(doc)
      return acc
    }, {})
  }, [filteredDocs])

  const openDoc = (docId: string) => {
    navigate({
      search: (prev) => ({
        ...(prev as Record<string, unknown>),
        doc: docId,
      }),
    })
  }

  return (
    <>
      <Header fixed>
        <div className='relative w-full max-w-sm'>
          <Search className='absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder='Search docs...'
            className='pl-9'
          />
        </div>
        <div className='ms-auto flex items-center space-x-4'>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main fluid className='flex h-full flex-1 flex-col gap-4 sm:gap-6'>
        <div className='flex flex-wrap items-end justify-end gap-2'>
          <div className='flex flex-wrap gap-2'>
            <Button variant='outline' size='sm' asChild>
              <Link to='/services'>Services</Link>
            </Button>
          </div>
        </div>

        <div className='grid min-h-0 flex-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]'>
          <Card className='min-h-0'>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <FolderOpen className='size-4' /> Docs
              </CardTitle>
              <CardDescription>Help documents.</CardDescription>
            </CardHeader>
            <CardContent className='min-h-0'>
              <ScrollArea className='h-[calc(100vh-18rem)] pr-3'>
                <div className='space-y-4'>
                  {Object.entries(groupedDocs).map(([section, entries]) => (
                    <div key={section} className='space-y-1.5'>
                      <div className='flex items-center gap-2 px-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase'>
                        <BookOpenText className='size-3.5' />
                        {section}
                      </div>
                      <div className='space-y-1'>
                        {entries.map((doc) => (
                          <button
                            key={doc.id}
                            type='button'
                            onClick={() => openDoc(doc.id)}
                            className={`w-full rounded-md border px-2.5 py-2 text-left transition-colors hover:bg-accent ${
                              selectedDoc?.id === doc.id
                                ? 'border-primary bg-primary/5'
                                : ''
                            }`}
                          >
                            <div className='flex items-start justify-between gap-2'>
                              <div className='min-w-0'>
                                <div className='truncate text-sm leading-5 font-medium'>
                                  {doc.title}
                                </div>
                                <div className='line-clamp-2 text-[11px] leading-4 text-muted-foreground'>
                                  {doc.description}
                                </div>
                              </div>
                              <div className='flex shrink-0 flex-col items-end gap-1'>
                                <Badge
                                  variant='outline'
                                  className='text-[10px]'
                                >
                                  {statusLabels[doc.status]}
                                </Badge>
                                <FileText className='size-3.5 text-muted-foreground' />
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}

                  {!filteredDocs.length ? (
                    <div className='rounded-lg border border-dashed p-4 text-sm text-muted-foreground'>
                      No docs matched the current search.
                    </div>
                  ) : null}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className='min-h-0'>
            <CardHeader>
              <div className='flex flex-wrap items-center justify-between gap-2'>
                <div>
                  <CardTitle>
                    {selectedDoc?.title ?? 'No doc selected'}
                  </CardTitle>
                  <CardDescription>
                    {selectedDoc
                      ? `${selectedDoc.section} · ${selectedDoc.fileName} · ${selectedDoc.description}`
                      : 'Pick a markdown file from the docs list.'}
                  </CardDescription>
                </div>
                {selectedDoc ? (
                  <div className='flex flex-wrap justify-end gap-2'>
                    <Badge variant='outline'>
                      {statusLabels[selectedDoc.status]}
                    </Badge>
                    {selectedDoc.tags.map((tag) => (
                      <Badge key={tag} variant='secondary'>
                        {tag}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className='min-h-0'>
              {selectedDoc ? (
                <ScrollArea className='h-[calc(100vh-18rem)] pr-4'>
                  <MarkdownArticle content={selectedDoc.content} />
                </ScrollArea>
              ) : (
                <div className='rounded-lg border border-dashed p-4 text-sm text-muted-foreground'>
                  No markdown docs are available yet under `docs/help/`.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </Main>
    </>
  )
}
