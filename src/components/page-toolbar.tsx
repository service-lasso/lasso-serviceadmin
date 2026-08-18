/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from 'react'
import { Link, useRouterState, type LinkProps } from '@tanstack/react-router'
import { Compass, type LucideIcon } from 'lucide-react'
import { getContextualHelpLinks } from '@/components/contextual-help-links'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { lifecycleActionButtonClass } from '@/lib/service-lasso-dashboard/action-styles'
import { cn } from '@/lib/utils'

export type PageActionTone = 'default' | 'start' | 'stop' | 'restart'

export type PageActionItem = {
  id: string
  label: string
  icon: LucideIcon
  onClick?: () => void
  disabled?: boolean
  tone?: PageActionTone
}

export type PageQuickNavItem = {
  id: string
  label: string
  to: NonNullable<LinkProps['to']>
  search?: LinkProps['search']
}

type PageToolbarConfig = {
  actions?: PageActionItem[]
  quickNav?: PageQuickNavItem[]
}

type PageToolbarContextValue = {
  config: PageToolbarConfig
  configRef: MutableRefObject<PageToolbarConfig>
  setConfig: (config: PageToolbarConfig) => void
}

const PageToolbarContext = createContext<PageToolbarContextValue | null>(null)

/**
 * Provides the compact page Action list / Quick Nav slot rendered by Main.
 */
export function PageToolbarProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<PageToolbarConfig>({})
  const configRef = useRef<PageToolbarConfig>({})
  const value = useMemo(
    () => ({ config, configRef, setConfig }),
    [config]
  )

  return (
    <PageToolbarContext.Provider value={value}>
      {children}
    </PageToolbarContext.Provider>
  )
}

/**
 * Registers icon actions and page Quick Nav items for the current screen.
 * Help-center links are merged automatically from the active route.
 */
export function usePageToolbar(config: PageToolbarConfig) {
  const context = useContext(PageToolbarContext)
  if (!context) {
    throw new Error('usePageToolbar must be used inside PageToolbarProvider.')
  }

  const { setConfig, configRef } = context
  configRef.current = config

  const actionKey = JSON.stringify(
    (config.actions ?? []).map((action) => [
      action.id,
      action.label,
      action.disabled ?? false,
      action.tone ?? 'default',
    ])
  )
  const navKey = JSON.stringify(
    (config.quickNav ?? []).map((item) => [
      item.id,
      item.label,
      String(item.to ?? ''),
    ])
  )

  useLayoutEffect(() => {
    setConfig(configRef.current)
    return () => {
      setConfig({})
    }
  }, [actionKey, navKey, setConfig, configRef])
}

function actionButtonClass(tone: PageActionTone | undefined) {
  if (tone === 'start' || tone === 'stop' || tone === 'restart') {
    return lifecycleActionButtonClass(tone, 'size-8')
  }

  return 'size-8'
}

/**
 * Compact Action list (icons) plus Quick Nav. Help links join Quick Nav.
 * Quick Nav is inline from `md` and collapses to a menu on small viewports.
 */
export function PageToolbar() {
  const context = useContext(PageToolbarContext)
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const helpLinks = getContextualHelpLinks(pathname)
  const actions = context?.config.actions ?? []
  const pageNav = context?.config.quickNav ?? []
  const helpNav: PageQuickNavItem[] = helpLinks.map((link) => ({
    id: `help:${link.doc}:${link.label}`,
    label: link.label,
    to: '/help-center',
    search: { doc: link.doc },
  }))
  const quickNav = [...pageNav, ...helpNav]

  if (!actions.length && !quickNav.length) {
    return null
  }

  return (
    <div
      className='flex flex-wrap items-center justify-end gap-2'
      data-testid='page-toolbar'
    >
      {actions.length ? (
        <nav aria-label='Page actions' className='flex items-center gap-1'>
          {actions.map((action) => {
            const Icon = action.icon
            return (
              <Button
                key={action.id}
                type='button'
                size='icon'
                variant={action.tone ? 'default' : 'outline'}
                className={actionButtonClass(action.tone)}
                aria-label={action.label}
                title={action.label}
                disabled={action.disabled}
                onClick={() => {
                  const latest = context?.configRef.current.actions?.find(
                    (candidate) => candidate.id === action.id
                  )
                  latest?.onClick?.()
                }}
              >
                <Icon className='size-3.5' />
              </Button>
            )
          })}
        </nav>
      ) : null}

      {quickNav.length ? (
        <>
          <nav
            aria-label='Quick Nav'
            className='hidden items-center gap-1 md:flex'
          >
            {quickNav.map((item) => (
              <Button key={item.id} variant='ghost' size='sm' asChild>
                <Link
                  to={item.to}
                  search={item.search}
                  aria-label={
                    item.to === '/help-center'
                      ? `Open Help Center: ${item.label}`
                      : item.label
                  }
                >
                  {item.label}
                </Link>
              </Button>
            ))}
          </nav>
          <div className='md:hidden'>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  aria-label='Open Quick Nav'
                >
                  <Compass className='size-3.5' />
                  Quick Nav
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end'>
                <DropdownMenuLabel>Quick Nav</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {quickNav.map((item) => (
                  <DropdownMenuItem key={item.id} asChild>
                    <Link
                      to={item.to}
                      search={item.search}
                      className={cn('cursor-pointer')}
                      aria-label={
                        item.to === '/help-center'
                          ? `Open Help Center: ${item.label}`
                          : item.label
                      }
                    >
                      {item.label}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </>
      ) : null}
    </div>
  )
}
