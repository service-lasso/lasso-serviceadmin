import {
  Boxes,
  ClipboardCheck,
  Command,
  DatabaseZap,
  FileKey2,
  GitBranch,
  Globe,
  KeyRound,
  LifeBuoy,
  LockKeyhole,
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
          title: 'Configuration',
          url: '/secrets-broker/configuration',
          icon: Settings,
        },
        {
          title: 'Sources / Backends',
          url: '/secrets-broker/sources',
          icon: DatabaseZap,
        },
        {
          title: 'Provider Connections',
          url: '/secrets-broker/provider-connections',
          icon: KeyRound,
        },
        {
          title: 'Single Reveal',
          url: '/secrets-broker/single-reveal',
          icon: LockKeyhole,
        },
        {
          title: 'Backup / Keys',
          url: '/secrets-broker/backup-keys',
          icon: FileKey2,
        },
        {
          title: 'Workflow Boundaries',
          url: '/secrets-broker/workflow-boundaries',
          icon: ClipboardCheck,
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
        {
          title: 'Diagnostics',
          url: '/secrets-broker/diagnostics',
          icon: LifeBuoy,
        },
        {
          title: 'Secret Inventory',
          url: '/secrets-broker/secret-inventory',
          icon: DatabaseZap,
        },
        {
          title: 'Policy Simulation',
          url: '/secrets-broker/policy-simulation',
          icon: ClipboardCheck,
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
