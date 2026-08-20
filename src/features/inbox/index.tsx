import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { Link } from '@tanstack/react-router'
import { Inbox as InboxIcon } from 'lucide-react'
import { usePageMetadata } from '@/lib/page-metadata'
import {
  useInbox,
  useInboxCounts,
  useMarkInboxItemsRead,
  useMarkInboxRead,
} from '@/lib/service-lasso-dashboard/hooks'
import {
  filterInboxItemsForView,
  resolveInboxDeepLink,
  type InboxDeepLink,
} from '@/lib/service-lasso-dashboard/inbox'
import type {
  InboxListResult,
  OperatorInboxItem,
  OperatorInboxSeverity,
} from '@/lib/service-lasso-dashboard/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { HeaderActions, usePageToolbar } from '@/components/page-toolbar'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'

type InboxViewFilter = 'unread' | 'read' | 'all'

function formatInboxTime(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return format(parsed, 'd MMM yyyy HH:mm')
}

function severityVariant(
  severity: OperatorInboxSeverity
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (severity === 'error' || severity === 'critical') {
    return 'destructive'
  }
  if (severity === 'warning') {
    return 'outline'
  }
  if (severity === 'success') {
    return 'default'
  }
  return 'secondary'
}

function inboxSourceNotice(result?: InboxListResult) {
  if (!result) {
    return {
      title: 'Checking runtime Inbox',
      description:
        'The page is requesting durable operator Inbox records from Service Lasso.',
    }
  }

  if (result.stubMode) {
    return {
      title: 'Fixture preview',
      description:
        'Explicit Service Admin stub mode is enabled; these rows are sample Inbox messages only and were not persisted by the runtime.',
    }
  }

  if (result.status === 'unavailable') {
    return {
      title: 'Inbox unavailable',
      description:
        result.unavailableReason ??
        'Service Lasso runtime Inbox API is not available.',
    }
  }

  return {
    title: 'Live runtime Inbox',
    description:
      'Messages are durable operator Inbox records from Service Lasso. Toasts may still show immediate feedback; this list is the record you can reopen later.',
  }
}

function InboxTargetLink({ item }: { item: OperatorInboxItem }) {
  const href = item.relatedTarget?.route ?? item.action?.target ?? null
  const deepLink = resolveInboxDeepLink(href)
  if (!deepLink) {
    return null
  }

  const label =
    item.action?.label ??
    (deepLink.kind === 'logs'
      ? 'Open logs'
      : deepLink.kind === 'service'
        ? 'Open service'
        : 'Open')

  return (
    <Button asChild variant='outline' size='sm'>
      <InboxDeepLinkAnchor deepLink={deepLink} label={label} />
    </Button>
  )
}

function InboxDeepLinkAnchor({
  deepLink,
  label,
}: {
  deepLink: InboxDeepLink
  label: string
}) {
  if (deepLink.kind === 'service') {
    return (
      <Link
        to='/services/$serviceId'
        params={{ serviceId: deepLink.serviceId }}
      >
        {label}
      </Link>
    )
  }

  if (deepLink.kind === 'logs') {
    return (
      <Link
        to='/logs'
        search={
          deepLink.serviceId ? { service: deepLink.serviceId } : undefined
        }
      >
        {label}
      </Link>
    )
  }

  if (deepLink.kind === 'runtime') {
    return <Link to='/runtime'>{label}</Link>
  }
  if (deepLink.kind === 'audit') {
    return <Link to='/operations/audit-logging'>{label}</Link>
  }
  if (deepLink.kind === 'telemetry') {
    return <Link to='/operations/telemetry'>{label}</Link>
  }
  return <Link to='/'>{label}</Link>
}

function InboxItemCard({
  item,
  onMarkRead,
  markReadPending,
}: {
  item: OperatorInboxItem
  onMarkRead: (itemId: string) => void
  markReadPending: boolean
}) {
  const unread = item.state === 'unread'

  return (
    <article
      data-testid={`inbox-item-${item.id}`}
      className='rounded-md border p-4'
    >
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div className='min-w-0 flex-1'>
          <div className='flex flex-wrap items-center gap-2'>
            {unread ? (
              <span className='size-2 shrink-0 rounded-full bg-primary' />
            ) : null}
            <h2 className='text-base font-semibold'>{item.title}</h2>
            <Badge variant={severityVariant(item.severity)}>
              {item.severity}
            </Badge>
            <Badge variant='outline'>{item.type}</Badge>
            <Badge variant='secondary'>{unread ? 'Unread' : 'Read'}</Badge>
          </div>
          <p className='mt-2 text-sm text-muted-foreground'>{item.summary}</p>
          {item.details ? (
            <p className='mt-1 text-sm text-muted-foreground'>{item.details}</p>
          ) : null}
          <p className='mt-2 text-xs text-muted-foreground'>
            {formatInboxTime(item.createdAt)}
          </p>
        </div>
        <div className='flex shrink-0 flex-wrap items-center gap-2'>
          <InboxTargetLink item={item} />
          {unread ? (
            <Button
              type='button'
              size='sm'
              onClick={() => onMarkRead(item.id)}
              disabled={markReadPending}
            >
              Mark read
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  )
}

export function OperatorInboxPage() {
  usePageMetadata({
    title: 'Service Admin - Inbox',
    description:
      'Durable operator Inbox messages from Service Lasso runtime events.',
  })
  usePageToolbar({
    quickNav: [
      { id: 'services', label: 'Services', to: '/services' },
      { id: 'logs', label: 'Logs', to: '/logs' },
    ],
  })

  const [view, setView] = useState<InboxViewFilter>('unread')
  const inboxQuery = useInbox({ filter: 'all', limit: 200 })
  const countsQuery = useInboxCounts()
  const markRead = useMarkInboxRead()
  const markItemsRead = useMarkInboxItemsRead()
  const result = inboxQuery.data
  const notice = inboxSourceNotice(result)
  const items = useMemo(
    () => filterInboxItemsForView(result?.items ?? [], view),
    [result?.items, view]
  )
  const unreadIds = useMemo(
    () =>
      filterInboxItemsForView(result?.items ?? [], 'unread').map(
        (item) => item.id
      ),
    [result?.items]
  )
  const unreadCount =
    countsQuery.data?.status === 'available' ? countsQuery.data.unread : 0
  const totalVisible = result?.items.filter(
    (item) => item.visibility === 'visible'
  ).length
  const markReadPending = markRead.isPending || markItemsRead.isPending

  return (
    <>
      <Header fixed>
        <Search />
        <HeaderActions>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </HeaderActions>
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div className='grid gap-4 md:grid-cols-3'>
          <div className='rounded-md border p-4'>
            <div className='flex items-center gap-2 text-sm font-medium'>
              <InboxIcon className='size-4' /> Unread
            </div>
            <div className='mt-2 text-2xl font-bold'>{unreadCount}</div>
            <p className='text-xs text-muted-foreground'>
              Durable notices waiting for operator review.
            </p>
          </div>
          <div className='rounded-md border p-4'>
            <div className='text-sm font-medium'>Visible</div>
            <div className='mt-2 text-2xl font-bold'>
              {typeof totalVisible === 'number' ? totalVisible : '—'}
            </div>
            <p className='text-xs text-muted-foreground'>
              Hidden records stay restorable in the runtime store.
            </p>
          </div>
          <div className='rounded-md border p-4'>
            <div className='text-sm font-medium'>Source</div>
            <div className='mt-2 text-2xl font-bold'>
              {result?.stubMode
                ? 'Fixture'
                : result?.status === 'available'
                  ? 'Live'
                  : 'Unavailable'}
            </div>
            <p className='text-xs text-muted-foreground'>
              Secret values, operator tokens, and raw payloads are never shown.
            </p>
          </div>
        </div>

        <div className='rounded-md border border-dashed bg-muted/20 p-4 text-sm'>
          <div className='font-medium text-foreground'>{notice.title}</div>
          <p className='mt-1 text-muted-foreground'>{notice.description}</p>
        </div>

        <div className='flex flex-wrap items-center gap-2'>
          {(['unread', 'read', 'all'] as const).map((option) => (
            <Button
              key={option}
              type='button'
              size='sm'
              variant={view === option ? 'default' : 'outline'}
              onClick={() => setView(option)}
            >
              {option === 'unread'
                ? 'Unread'
                : option === 'read'
                  ? 'Read'
                  : 'All'}
            </Button>
          ))}
          <Button
            type='button'
            size='sm'
            variant='outline'
            disabled={unreadIds.length === 0 || markReadPending}
            onClick={() => markItemsRead.mutate(unreadIds)}
          >
            Mark all read
          </Button>
        </div>

        {inboxQuery.isLoading ? (
          <div className='flex flex-1 flex-col gap-4'>
            <Skeleton className='h-24 w-full' />
            <Skeleton className='h-24 w-full' />
          </div>
        ) : items.length === 0 ? (
          <p className='text-sm text-muted-foreground'>
            {result?.status === 'unavailable'
              ? 'Runtime Inbox messages are unavailable.'
              : view === 'unread'
                ? 'No unread Inbox messages.'
                : view === 'read'
                  ? 'No read Inbox messages.'
                  : 'No Inbox messages.'}
          </p>
        ) : (
          <div className='flex flex-col gap-3'>
            {items.map((item) => (
              <InboxItemCard
                key={item.id}
                item={item}
                onMarkRead={(itemId) => markRead.mutate(itemId)}
                markReadPending={markReadPending}
              />
            ))}
          </div>
        )}
      </Main>
    </>
  )
}
