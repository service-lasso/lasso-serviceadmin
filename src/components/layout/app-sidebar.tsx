import { useInboxCounts } from '@/lib/service-lasso-dashboard/hooks'
import { useLayout } from '@/context/layout-provider'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar'
import { InstanceSelector } from '@/components/instance-selector'
import { sidebarData } from './data/sidebar-data'
import { NavGroup } from './nav-group'
import { NavUser } from './nav-user'
import { type NavGroup as NavGroupData, type NavItem } from './types'

function withInboxUnreadBadge(
  groups: NavGroupData[],
  unread: number
): NavGroupData[] {
  return groups.map((group) => ({
    ...group,
    items: group.items.map((item): NavItem => {
      if (!('url' in item) || item.url !== '/inbox') {
        return item
      }
      if (unread <= 0) {
        return item
      }
      return {
        ...item,
        badge: String(unread),
        badgeAriaLabel: `Inbox, ${unread} unread`,
      }
    }),
  }))
}

export function AppSidebar() {
  const { collapsible, variant } = useLayout()
  const inboxCountsQuery = useInboxCounts()
  const unread =
    inboxCountsQuery.data?.status === 'available'
      ? inboxCountsQuery.data.unread
      : 0
  const navGroups = withInboxUnreadBadge(sidebarData.navGroups, unread)

  const sidebarUser = {
    ...sidebarData.user,
    name: 'Service Admin',
    email: 'Local instance',
  }

  return (
    <Sidebar collapsible={collapsible} variant={variant}>
      <SidebarHeader>
        <InstanceSelector side='right' />

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
        <NavUser user={sidebarUser} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
