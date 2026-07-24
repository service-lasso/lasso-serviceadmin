import { useMemo, useState } from 'react'
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  EyeOff,
  Inbox as InboxIcon,
  Search as SearchIcon,
} from 'lucide-react'
import { usePageMetadata } from '@/lib/page-metadata'
import {
  useInboxMessageAction,
  useInboxSummary,
} from '@/lib/service-lasso-dashboard/hooks'
import type {
  InboxMessage,
  InboxMessageAction,
  InboxMessageCategory,
  InboxMessageSeverity,
} from '@/lib/service-lasso-dashboard/types'
import { cn } from '@/lib/utils'
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
import { Skeleton } from '@/components/ui/skeleton'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'

type InboxFilter =
  | 'all'
  | 'unread'
  | InboxMessageCategory
  | 'hidden'

const filters: Array<{ id: InboxFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'update', label: 'Updates' },
  { id: 'system', label: 'System' },
  { id: 'workflow', label: 'Workflow' },
  { id: 'error', label: 'Errors' },
  { id: 'hidden', label: 'Hidden' },
]

const severityLabels: Record<InboxMessageSeverity, string> = {
  info: 'Info',
  warning: 'Warning',
  critical: 'Critical',
}

function filterCount(message: InboxMessage, filter: InboxFilter) {
  if (filter === 'all') return !message.hidden
  if (filter === 'unread') return !message.hidden && !message.read
  if (filter === 'hidden') return message.hidden
  return !message.hidden && message.category === filter
}

function messageMatchesFilter(message: InboxMessage, filter: InboxFilter) {
  return filterCount(message, filter)
}

function messageMatchesSearch(message: InboxMessage, query: string) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return true

  return [
    message.title,
    message.summary,
    message.details,
    message.category,
    message.severity,
    message.target?.label,
  ]
    .filter((value): value is string => typeof value === 'string')
    .some((value) => value.toLowerCase().includes(normalized))
}

function SeverityBadge({ severity }: { severity: InboxMessageSeverity }) {
  if (severity === 'critical') {
    return <Badge variant='destructive'>Critical</Badge>
  }

  if (severity === 'warning') {
    return <Badge variant='secondary'>Warning</Badge>
  }

  return <Badge variant='outline'>Info</Badge>
}

function CategoryBadge({ category }: { category: InboxMessageCategory }) {
  return <Badge variant='outline'>{category}</Badge>
}

function InboxLoading() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className='h-6 w-36' />
        <Skeleton className='h-4 w-80' />
      </CardHeader>
      <CardContent>
        <Skeleton className='h-[520px] w-full' />
      </CardContent>
    </Card>
  )
}

function ActionButton({
  action,
  messageId,
}: {
  action: InboxMessageAction
  messageId: string
}) {
  const actionMutation = useInboxMessageAction()

  if (
    action.kind === 'open_service' ||
    action.kind === 'open_logs' ||
    action.kind === 'open_workflow' ||
    action.kind === 'open_update' ||
    action.kind === 'view_audit'
  ) {
    return (
      <Button
        asChild
        variant='outline'
        size='sm'
        disabled={action.disabled}
      >
        <a href={action.target ?? '#'}>{action.label}</a>
      </Button>
    )
  }

  return (
    <Button
      variant='outline'
      size='sm'
      disabled={action.disabled || actionMutation.isPending}
      onClick={() =>
        actionMutation.mutate({
          messageId,
          action: action.kind,
        })
      }
    >
      {action.label}
    </Button>
  )
}

export function Inbox() {
  usePageMetadata({
    title: 'Service Admin - Inbox',
    description: 'Service Admin durable operator message inbox.',
  })

  const inboxQuery = useInboxSummary()
  const [activeFilter, setActiveFilter] = useState<InboxFilter>('all')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const messages = inboxQuery.data?.messages ?? []
  const visibleMessages = useMemo(
    () =>
      messages.filter(
        (message) =>
          messageMatchesFilter(message, activeFilter) &&
          messageMatchesSearch(message, query)
      ),
    [activeFilter, messages, query]
  )
  const selectedMessage =
    messages.find((message) => message.id === selectedId) ??
    visibleMessages[0] ??
    null

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

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>Inbox</h2>
            <p className='text-muted-foreground'>
              Durable runtime messages, update notices, and workflow actions.
            </p>
          </div>
          <div className='flex items-center gap-2 text-sm text-muted-foreground'>
            <Bell className='size-4' />
            <span>{inboxQuery.data?.counts.unread ?? 0} unread</span>
          </div>
        </div>

        {inboxQuery.isLoading ? (
          <InboxLoading />
        ) : inboxQuery.isError ? (
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <AlertCircle className='size-4' /> Inbox unavailable
              </CardTitle>
              <CardDescription>
                Runtime Inbox APIs did not return operator messages.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className='grid min-h-[620px] gap-4 lg:grid-cols-[380px_minmax(0,1fr)]'>
            <Card className='min-h-0'>
              <CardHeader className='space-y-4'>
                <div>
                  <CardTitle className='flex items-center gap-2'>
                    <InboxIcon className='size-4' /> Messages
                  </CardTitle>
                  <CardDescription>
                    {visibleMessages.length} shown from{' '}
                    {inboxQuery.data?.counts.total ?? 0} active messages.
                  </CardDescription>
                </div>

                <label className='relative block'>
                  <SearchIcon className='pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground' />
                  <span className='sr-only'>Search inbox</span>
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder='Search title, details, target, or severity...'
                    className='pl-8'
                  />
                </label>

                <div className='flex flex-wrap gap-2'>
                  {filters.map((filter) => {
                    const count = messages.filter((message) =>
                      filterCount(message, filter.id)
                    ).length

                    return (
                      <Button
                        key={filter.id}
                        type='button'
                        variant={
                          activeFilter === filter.id ? 'default' : 'outline'
                        }
                        size='sm'
                        className='h-8'
                        onClick={() => setActiveFilter(filter.id)}
                      >
                        {filter.label} {count}
                      </Button>
                    )
                  })}
                </div>
              </CardHeader>

              <CardContent className='space-y-2'>
                {visibleMessages.length ? (
                  visibleMessages.map((message) => (
                    <button
                      key={message.id}
                      type='button'
                      className={cn(
                        'w-full rounded-md border p-3 text-left transition-colors hover:bg-muted',
                        selectedMessage?.id === message.id &&
                          'border-primary bg-muted',
                        !message.read && 'border-l-4 border-l-primary'
                      )}
                      onClick={() => setSelectedId(message.id)}
                    >
                      <div className='flex items-start justify-between gap-3'>
                        <div className='min-w-0'>
                          <div className='truncate font-medium'>
                            {message.title}
                          </div>
                          <div className='line-clamp-2 text-sm text-muted-foreground'>
                            {message.summary}
                          </div>
                        </div>
                        {message.read ? (
                          <CheckCircle2 className='size-4 shrink-0 text-muted-foreground' />
                        ) : (
                          <Bell className='size-4 shrink-0 text-primary' />
                        )}
                      </div>
                      <div className='mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
                        <CategoryBadge category={message.category} />
                        <SeverityBadge severity={message.severity} />
                        <span>{new Date(message.createdAt).toLocaleString()}</span>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className='rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground'>
                    No inbox messages match the current filters.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className='min-h-0'>
              {selectedMessage ? (
                <>
                  <CardHeader className='space-y-4'>
                    <div className='flex flex-wrap items-start justify-between gap-3'>
                      <div className='min-w-0'>
                        <CardTitle className='text-xl'>
                          {selectedMessage.title}
                        </CardTitle>
                        <CardDescription>
                          {new Date(selectedMessage.createdAt).toLocaleString()}
                        </CardDescription>
                      </div>
                      <div className='flex flex-wrap gap-2'>
                        <CategoryBadge category={selectedMessage.category} />
                        <SeverityBadge severity={selectedMessage.severity} />
                        {selectedMessage.hidden ? (
                          <Badge variant='secondary'>
                            <EyeOff className='mr-1 size-3' /> Hidden
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className='space-y-6'>
                    <div>
                      <h3 className='text-sm font-medium'>Details</h3>
                      <p className='mt-2 text-sm leading-6 text-muted-foreground'>
                        {selectedMessage.details}
                      </p>
                    </div>

                    <div className='grid gap-4 md:grid-cols-2'>
                      <div className='rounded-md border p-4'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          State
                        </div>
                        <div className='mt-2 text-sm'>
                          {selectedMessage.read ? 'Read' : 'Unread'} ·{' '}
                          {severityLabels[selectedMessage.severity]}
                        </div>
                      </div>
                      <div className='rounded-md border p-4'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Related target
                        </div>
                        {selectedMessage.target ? (
                          <a
                            href={selectedMessage.target.href}
                            className='mt-2 block truncate text-sm font-medium hover:underline'
                          >
                            {selectedMessage.target.label}
                          </a>
                        ) : (
                          <div className='mt-2 text-sm text-muted-foreground'>
                            No linked target
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <h3 className='text-sm font-medium'>Actions</h3>
                      <div className='mt-3 flex flex-wrap gap-2'>
                        {selectedMessage.actions.map((action) => (
                          <ActionButton
                            key={action.id}
                            action={action}
                            messageId={selectedMessage.id}
                          />
                        ))}
                      </div>
                      {selectedMessage.actions.some((action) => action.reason) ? (
                        <p className='mt-3 text-xs text-muted-foreground'>
                          {selectedMessage.actions.find((action) => action.reason)
                            ?.reason}
                        </p>
                      ) : null}
                    </div>
                  </CardContent>
                </>
              ) : (
                <CardContent className='flex min-h-[420px] items-center justify-center text-sm text-muted-foreground'>
                  Select a message to review details and actions.
                </CardContent>
              )}
            </Card>
          </div>
        )}
      </Main>
    </>
  )
}
