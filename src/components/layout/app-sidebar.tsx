import { Link } from '@tanstack/react-router'
import { PanelsTopLeft } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { sidebarData } from '@/components/layout/data/sidebar-data'
import { NavGroup } from '@/components/layout/nav-group'

export function AppSidebar() {
  return (
    <Sidebar collapsible='icon' variant='inset'>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size='lg' asChild>
              <Link to='/'>
                <div className='flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground'>
                  <PanelsTopLeft className='size-4' />
                </div>
                <div className='grid flex-1 text-left text-sm leading-tight'>
                  <span className='truncate font-semibold'>Service Lasso</span>
                  <span className='truncate text-xs text-muted-foreground'>
                    lasso-@serviceadmin
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {sidebarData.navGroups.map((group) => (
          <NavGroup key={group.title} {...group} />
        ))}
      </SidebarContent>

      <SidebarFooter>
        <div className='rounded-lg border p-3 text-xs text-muted-foreground'>
          Optional operator UI, API-driven, and currently wired to explicit
          harness stubs.
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
