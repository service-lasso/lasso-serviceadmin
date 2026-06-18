import {
  Boxes,
  Command,
  DatabaseZap,
  FileChartColumn,
  GitBranch,
  Globe,
  Network,
  ShieldCheck,
  SlidersHorizontal,
  HardDrive,
  HelpCircle,
  LayoutDashboard,
  Palette,
  Route,
  ScrollText,
  Settings,
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
      ],
    },
    {
      title: 'Operations',
      items: [
        {
          title: 'Telemetry',
          url: '/operations/telemetry',
          icon: FileChartColumn,
        },
        {
          title: 'Audit Logging',
          url: '/operations/audit-logging',
          icon: ScrollText,
        },
      ],
    },
    {
      title: 'Secrets Broker',
      items: [
        {
          title: 'Overview / Setup',
          url: '/secrets-broker',
          icon: ShieldCheck,
        },
        {
          title: 'Secrets',
          url: '/secrets-broker/secrets',
          icon: DatabaseZap,
        },
        {
          title: 'Operational Controls',
          url: '/secrets-broker/operational-controls',
          icon: ShieldCheck,
        },
        {
          title: 'Providers',
          url: '/secrets-broker/sources',
          icon: DatabaseZap,
        },
        {
          title: 'Topology',
          url: '/secrets-broker/topology',
          icon: Network,
        },
        {
          title: 'Audit / Events',
          url: '/secrets-broker/audit-events',
          icon: GitBranch,
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
