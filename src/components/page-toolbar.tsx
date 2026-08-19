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
import { BookOpenText, Compass, type LucideIcon } from 'lucide-react'
import { lifecycleActionButtonClass } from '@/lib/service-lasso-dashboard/action-styles'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { getContextualHelpLinks } from '@/components/contextual-help-links'

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

type HeaderActionsProps = {
  children: ReactNode
  className?: string
}

/**
 * Header right cluster. Page actions and the Links menu sit immediately
 * left of ThemeSwitch (and the rest of the trailing chrome).
 */
export function HeaderActions({ children, className }: HeaderActionsProps) {
  return (
    <div className={cn('ms-auto flex items-center space-x-4', className)}>
      <PageToolbar />
      {children}
    </div>
  )
}

/**
 * Provides the compact page Action list / Quick Nav / Links slot.
 */
export function PageToolbarProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<PageToolbarConfig>({})
  const configRef = useRef<PageToolbarConfig>({})
  const value = useMemo(() => ({ config, configRef, setConfig }), [config])

  return (
    <PageToolbarContext.Provider value={value}>
      {children}
    </PageToolbarContext.Provider>
  )
}

/**
 * Registers icon actions and page Quick Nav items for the current screen.
 * Help-center links are rendered separately as a Links menu.
 */
export function usePageToolbar(config: PageToolbarConfig) {
  const context = useContext(PageToolbarContext)
  if (!context) {
    throw new Error('usePageToolbar must be used inside PageToolbarProvider.')
  }

  const { setConfig, configRef } = context

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
    configRef.current = config
  })

  useLayoutEffect(() => {
    setConfig(config)
    return () => {
      setConfig({})
    }
    // onClick identity is ignored so the toolbar does not loop setState.
  }, [actionKey, navKey, setConfig])
}

function actionButtonClass(tone: PageActionTone | undefined) {
  if (tone === 'start' || tone === 'stop' || tone === 'restart') {
    return lifecycleActionButtonClass(tone, 'size-8')
  }

  return 'size-8'
}

/**
 * Compact Action list, page Quick Nav, and a Links dropdown for help docs.
 * Rendered in the Header right cluster, immediately left of ThemeSwitch.
 */
export function PageToolbar() {
  const context = useContext(PageToolbarContext)
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const helpLinks = getContextualHelpLinks(pathname)
  const actions = context?.config.actions ?? []
  const quickNav = context?.config.quickNav ?? []

  if (!actions.length && !quickNav.length && !helpLinks.length) {
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
                variant='outline'
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
                <Link to={item.to} search={item.search} aria-label={item.label}>
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
                      aria-label={item.label}
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

      {helpLinks.length ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type='button'
              variant='outline'
              size='sm'
              aria-label='Links'
            >
              <BookOpenText className='size-3.5' />
              Links
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            <DropdownMenuLabel>Links</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {helpLinks.map((link) => (
              <DropdownMenuItem key={`${link.doc}:${link.label}`} asChild>
                <Link
                  to='/help-center'
                  search={{ doc: link.doc }}
                  className={cn('cursor-pointer')}
                  aria-label={`Open Help Center: ${link.label}`}
                >
                  {link.label}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  )
}
