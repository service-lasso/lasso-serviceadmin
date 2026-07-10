import { useEffect, useState } from 'react'
import { useRouterState } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { sidebarData } from './data/sidebar-data'
import { type NavItem } from './types'

type HeaderProps = React.HTMLAttributes<HTMLElement> & {
  fixed?: boolean
  ref?: React.Ref<HTMLElement>
}

function findActiveNavItem(pathname: string): NavItem | undefined {
  const normalizedPath = pathname === '/' ? pathname : pathname.replace(/\/$/, '')

  for (const group of sidebarData.navGroups) {
    for (const item of group.items) {
      if (Array.isArray(item.items)) {
        const activeChild = item.items.find((child) => {
          return child.url === normalizedPath
        })

        if (activeChild) {
          return activeChild
        }

        continue
      }

      if (item.url === normalizedPath) {
        return item
      }
    }
  }

  return undefined
}

export function Header({ className, fixed, children, ...props }: HeaderProps) {
  const [offset, setOffset] = useState(0)
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const activeNavItem = findActiveNavItem(pathname)
  const ActiveIcon = activeNavItem?.icon

  useEffect(() => {
    const onScroll = () => {
      setOffset(document.body.scrollTop || document.documentElement.scrollTop)
    }

    // Add scroll listener to the body
    document.addEventListener('scroll', onScroll, { passive: true })

    // Clean up the event listener on unmount
    return () => document.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cn(
        'z-50 h-16',
        fixed && 'header-fixed peer/header sticky top-0 w-[inherit]',
        offset > 10 && fixed ? 'shadow' : 'shadow-none',
        className
      )}
      {...props}
    >
      <div
        className={cn(
          'relative flex h-full items-center gap-3 p-4 sm:gap-4',
          offset > 10 &&
            fixed &&
            'after:absolute after:inset-0 after:-z-10 after:bg-background/20 after:backdrop-blur-lg'
        )}
      >
        <SidebarTrigger variant='outline' className='max-md:scale-125' />
        <Separator orientation='vertical' className='h-6' />
        {activeNavItem && ActiveIcon ? (
          <div
            aria-label={`Current page: ${activeNavItem.title}`}
            className='pointer-events-none absolute inset-x-20 flex min-w-0 justify-center max-sm:inset-x-16'
            data-testid='active-page-identity'
          >
            <div className='flex max-w-full items-center gap-2 truncate text-sm font-semibold text-foreground'>
              <ActiveIcon aria-hidden='true' className='size-4 shrink-0' />
              <span className='truncate'>{activeNavItem.title}</span>
            </div>
          </div>
        ) : null}
        {children}
      </div>
    </header>
  )
}
