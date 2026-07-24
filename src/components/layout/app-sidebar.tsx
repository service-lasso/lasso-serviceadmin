import { useMemo } from 'react'
import { useLayout } from '@/context/layout-provider'
import { useInboxSummary } from '@/lib/service-lasso-dashboard/hooks'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar'
// import { AppTitle } from './app-title'
import { sidebarData } from './data/sidebar-data'
import { NavGroup } from './nav-group'
import { NavUser } from './nav-user'
import { TeamSwitcher } from './team-switcher'
import { type NavGroup as NavGroupData } from './types'

export function AppSidebar() {
  const { collapsible, variant } = useLayout()
  const inboxQuery = useInboxSummary()
  const inboxUnreadCount = inboxQuery.data?.counts.unread ?? 0
  const inboxBadge =
    !inboxQuery.isError && inboxUnreadCount > 0
      ? inboxUnreadCount > 99
        ? '99+'
        : String(inboxUnreadCount)
      : undefined

  const navGroups = useMemo<NavGroupData[]>(
    () =>
      sidebarData.navGroups.map((group) => ({
        ...group,
        items: group.items.map((item) =>
          item.title === 'Inbox'
            ? {
                ...item,
                badge: inboxBadge,
              }
            : item
        ),
      })),
    [inboxBadge]
  )

  return (
    <Sidebar collapsible={collapsible} variant={variant}>
      <SidebarHeader>
        <TeamSwitcher teams={sidebarData.teams} />

        {/* Replace <TeamSwitch /> with the following <AppTitle />
         /* if you want to use the normal app title instead of TeamSwitch dropdown */}
        {/* <AppTitle /> */}
      </SidebarHeader>
      <SidebarContent>
        {navGroups.map((props) => (
          <NavGroup key={props.title} {...props} />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={sidebarData.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
