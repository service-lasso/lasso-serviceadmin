import {
  Blocks,
  BookKey,
  Boxes,
  ClipboardList,
  Command,
  FileChartColumn,
  GitBranch,
  Globe,
  Network,
  SlidersHorizontal,
  HardDrive,
  HelpCircle,
  Inbox,
  LayoutDashboard,
  Palette,
  Route,
  ScrollText,
  Settings,
  ShieldCheck,
  TimerReset,
} from 'lucide-react'
import { type SidebarData } from '../types'

export const sidebarData: SidebarData = {
  user: {
    name: 'Service Lasso',
    email: 'local-dev@service-lasso.local',
    avatar: '/avatars/shadcn.jpg',
  },
  teams: [
    {
      name: 'Service Lasso',
      logo: Command,
      plan: 'Service Admin',
    },
  ],
  navGroups: [
    {
      title: 'Service Admin',
      items: [
        {
          title: 'Dashboard',
          url: '/',
          icon: LayoutDashboard,
        },
        {
          title: 'Services',
          url: '/services',
          icon: Boxes,
        },
        {
          title: 'Dependencies',
          url: '/dependencies',
          icon: GitBranch,
        },
        {
          title: 'Routes',
          url: '/service-routes',
          icon: Route,
        },
        {
          title: 'Logs',
          url: '/logs',
          icon: ScrollText,
        },
        {
          title: 'Runtime',
          url: '/runtime',
          icon: TimerReset,
        },
        {
          title: 'MCP',
          url: '/mcp',
          icon: Command,
        },
        {
          title: 'Installed',
          url: '/installed',
          icon: HardDrive,
        },
        {
          title: 'Variables',
          url: '/variables',
          icon: SlidersHorizontal,
        },
        {
          title: 'Network',
          url: '/network',
          icon: Globe,
        },
        {
          title: 'Security',
          url: '/security',
          icon: ShieldCheck,
        },
      ],
    },
    {
      title: 'Operations',
      items: [
        {
          title: 'Inbox',
          url: '/inbox',
          icon: Inbox,
        },
        {
          title: 'Telemetry',
          url: '/operations/telemetry',
          icon: FileChartColumn,
        },
        {
          title: 'Audit',
          url: '/operations/audit-logging',
          icon: ScrollText,
        },
      ],
    },
    {
      title: 'Secrets Broker',
      items: [
        {
          title: 'Secrets',
          url: '/secrets-broker/secrets',
          icon: BookKey,
        },
        {
          title: 'Providers',
          url: '/secrets-broker/sources',
          icon: Blocks,
        },
        {
          title: 'Topology',
          url: '/secrets-broker/topology',
          icon: Network,
        },
        {
          title: 'Review',
          url: '/secrets-broker/review',
          icon: ClipboardList,
        },
      ],
    },
    {
      title: 'Configuration',
      items: [
        {
          title: 'Settings',
          icon: Settings,
          items: [
            {
              title: 'Appearance',
              url: '/settings/appearance',
              icon: Palette,
            },
          ],
        },
        {
          title: 'Help Center',
          url: '/help-center',
          icon: HelpCircle,
        },
      ],
    },
  ],
}
