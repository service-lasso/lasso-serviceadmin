import {
  Boxes,
  Building2,
  Command,
  DatabaseZap,
  GitBranch,
  Globe,
  KeyRound,
  LifeBuoy,
  LockKeyhole,
  Scale,
  SlidersHorizontal,
  HardDrive,
  HelpCircle,
  LayoutDashboard,
  Palette,
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
      title: 'Operations',
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
          title: 'Fleet Overview',
          url: '/fleet-overview',
          icon: Building2,
        },
        {
          title: 'Dependencies',
          url: '/dependencies',
          icon: GitBranch,
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
          title: 'Secrets Broker',
          url: '/secrets-broker',
          icon: KeyRound,
        },
        {
          title: 'Secret Inventory',
          url: '/secret-inventory',
          icon: DatabaseZap,
        },
        {
          title: 'Policy Simulation',
          url: '/secrets-policy-simulation',
          icon: Scale,
        },
        {
          title: 'ZITADEL Session',
          url: '/auth-session',
          icon: LockKeyhole,
        },
        {
          title: 'Support Bundle',
          url: '/support-bundle',
          icon: LifeBuoy,
        },
        {
          title: 'Network',
          url: '/network',
          icon: Globe,
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
