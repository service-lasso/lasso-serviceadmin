import {
  Boxes,
  Cable,
  Command,
  Globe,
  LayoutDashboard,
  Logs,
  PackageOpen,
  ServerCog,
  Settings,
  Shield,
} from 'lucide-react'
import { type SidebarData } from '../types'

export const sidebarData: SidebarData = {
  user: {
    name: 'Service Lasso',
    email: 'operator@servicelasso.local',
    avatar: '/images/favicon.png',
  },
  teams: [
    {
      name: 'Service Admin UI',
      logo: Command,
      plan: 'Operator shell',
    },
  ],
  navGroups: [
    {
      title: 'Operator',
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
          icon: Cable,
        },
        {
          title: 'Runtime',
          url: '/runtime',
          icon: ServerCog,
        },
        {
          title: 'Logs',
          url: '/logs',
          icon: Logs,
        },
        {
          title: 'Network',
          url: '/network',
          icon: Globe,
        },
        {
          title: 'Installed',
          url: '/installed',
          icon: PackageOpen,
        },
      ],
    },
    {
      title: 'Admin UI',
      items: [
        {
          title: 'Settings',
          url: '/settings',
          icon: Settings,
        },
        {
          title: 'OpenSpec tracker',
          url: '/settings',
          icon: Shield,
        },
      ],
    },
  ],
}
