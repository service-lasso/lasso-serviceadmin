import { Link } from '@tanstack/react-router'
import { Inbox } from 'lucide-react'
import { useInboxCounts } from '@/lib/service-lasso-dashboard/hooks'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

/**
 * Header Inbox chip shown on every authenticated page.
 * The unread count is omitted when the runtime Inbox API is unavailable.
 */
export function InboxHeaderChip() {
  const countsQuery = useInboxCounts()
  const unread =
    countsQuery.data?.status === 'available' ? countsQuery.data.unread : 0
  const label = unread > 0 ? `Open Inbox, ${unread} unread` : 'Open Inbox'

  return (
    <Button
      asChild
      variant='outline'
      size='sm'
      className='shrink-0 gap-1.5 px-2'
    >
      <Link
        to='/inbox'
        aria-label={label}
        data-testid='inbox-header-chip'
        className='flex items-center'
      >
        <Inbox aria-hidden='true' className='size-4' />
        <span className='hidden sm:inline'>Inbox</span>
        {unread > 0 ? (
          <Badge
            variant='destructive'
            className={cn('h-5 min-w-5 rounded-full px-1.5 font-mono')}
          >
            {unread}
          </Badge>
        ) : null}
      </Link>
    </Button>
  )
}
