import { MarkerType, type Edge, type Node } from '@xyflow/react'
import {
  AppWindow,
  Boxes,
  Lock,
  Network,
  ShieldCheck,
  Wrench,
  Workflow,
  type LucideIcon,
} from 'lucide-react'
import type { DashboardService } from '@/lib/service-lasso-dashboard/types'

const serviceImageNames = new Set([
  'dagu',
  'service-admin',
  'traefik',
  'zitadel_dark',
  'zitadel_light',
])

export type GraphCategory =
  | 'app'
  | 'runtime'
  | 'infrastructure'
  | 'utility'
  | 'security'
  | 'workflow'
  | 'other'

export function getGraphCategory(serviceType: string): GraphCategory {
  const type = serviceType.toLowerCase()
  if (type.includes('ui') || type.includes('app')) return 'app'
  if (type.includes('runtime')) return 'runtime'
  if (type.includes('infra') || type.includes('core-platform')) {
    return 'infrastructure'
  }
  if (type.includes('utility')) return 'utility'
  if (
    type.includes('identity') ||
    type.includes('security') ||
    type.includes('auth')
  ) {
    return 'security'
  }
  if (type.includes('workflow')) return 'workflow'
  return 'other'
}

export function categoryNodeColor(category: GraphCategory) {
  switch (category) {
    case 'app':
      return '#0ea5e9'
    case 'runtime':
      return '#8b5cf6'
    case 'infrastructure':
      return '#64748b'
    case 'utility':
      return '#71717a'
    case 'security':
      return '#d97706'
    case 'workflow':
      return '#10b981'
    default:
      return '#6b7280'
  }
}

export function getServiceNodeIcon(category: GraphCategory): LucideIcon {
  switch (category) {
    case 'app':
      return AppWindow
    case 'runtime':
      return ShieldCheck
    case 'infrastructure':
      return Boxes
    case 'utility':
      return Wrench
    case 'security':
      return Lock
    case 'workflow':
      return Workflow
    default:
      return Network
  }
}

type BuildNodeCardInput = {
  name: string
  id: string
  serviceType: string
  imageUrl?: string
  isDark: boolean
}

export function buildServiceNodeLabel({
  name,
  id,
  serviceType,
  imageUrl,
  isDark,
}: BuildNodeCardInput) {
  const category = getGraphCategory(serviceType)
  const ServiceIcon = getServiceNodeIcon(category)
  const accent = categoryNodeColor(category)

  return (
    <div className='flex w-max max-w-[420px] min-w-[170px] items-center gap-3'>
      <div
        className='flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border'
        style={{
          borderColor: isDark ? '#334155' : '#cbd5e1',
          background: isDark ? '#020617' : '#f8fafc',
        }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={`${name} icon`}
            className='size-full object-contain p-1'
          />
        ) : (
          <ServiceIcon className='size-5' style={{ color: accent }} />
        )}
      </div>
      <div className='min-w-0 flex-1'>
        <div className='text-sm leading-tight font-semibold break-words'>
          {name}
        </div>
        <div className='mt-0.5 text-xs leading-tight break-all text-muted-foreground'>
          {id}
        </div>
      </div>
    </div>
  )
}

export function buildServiceNodeStyle({
  selected,
  isDark,
}: {
  selected: boolean
  isDark: boolean
}): Node['style'] {
  return {
    border: selected
      ? `2px solid ${isDark ? '#22c55e' : '#16a34a'}`
      : `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
    borderRadius: 10,
    width: 'max-content',
    minWidth: 170,
    maxWidth: 420,
    background: selected
      ? isDark
        ? '#052e16'
        : '#dcfce7'
      : isDark
        ? '#0f172a'
        : '#ffffff',
    color: isDark ? '#e2e8f0' : '#0f172a',
    boxShadow: selected
      ? isDark
        ? '0 0 0 2px rgba(34,197,94,0.25)'
        : '0 0 0 2px rgba(34,197,94,0.15)'
      : isDark
        ? 'none'
        : '0 1px 2px rgba(15,23,42,0.08)',
  }
}

export function buildDependencyEdge({
  id,
  source,
  target,
  selected,
  isDark,
}: {
  id: string
  source: string
  target: string
  selected: boolean
  isDark: boolean
}): Edge {
  return {
    id,
    source,
    target,
    type: 'straight',
    label: 'depends_on',
    labelStyle: {
      fill: isDark ? '#e2e8f0' : '#0f172a',
      fontSize: 10,
      fontWeight: 700,
    },
    labelBgStyle: {
      fill: isDark ? '#020617' : '#f8fafc',
      fillOpacity: 0.98,
    },
    labelBgPadding: [6, 3],
    labelBgBorderRadius: 6,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: selected
        ? isDark
          ? '#22c55e'
          : '#16a34a'
        : isDark
          ? '#64748b'
          : '#94a3b8',
      width: 18,
      height: 18,
    },
    animated: selected,
    style: {
      stroke: selected
        ? isDark
          ? '#22c55e'
          : '#16a34a'
        : isDark
          ? '#64748b'
          : '#94a3b8',
      strokeWidth: selected ? 2.5 : 1.25,
    },
  }
}

export function buildApiUsageEdge({
  id,
  source,
  target,
  isDark,
  label = 'api_usage',
  animated = true,
}: {
  id: string
  source: string
  target: string
  isDark: boolean
  label?: string
  animated?: boolean
}): Edge {
  return {
    id,
    source,
    target,
    type: 'straight',
    label,
    labelStyle: {
      fill: isDark ? '#e0f2fe' : '#0c4a6e',
      fontSize: 10,
      fontWeight: 700,
    },
    labelBgStyle: {
      fill: isDark ? '#082f49' : '#e0f2fe',
      fillOpacity: 0.98,
    },
    labelBgPadding: [6, 3],
    labelBgBorderRadius: 6,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: isDark ? '#38bdf8' : '#0ea5e9',
      width: 18,
      height: 18,
    },
    animated,
    style: {
      stroke: isDark ? '#38bdf8' : '#0ea5e9',
      strokeWidth: 2.25,
      strokeDasharray: '6 4',
    },
  }
}

function normalizeServiceAssetName(value: string) {
  return value.trim().toLowerCase().replace(/^@/, '').replace(/\s+/g, '_')
}

export function getServiceNodeImage(
  service: DashboardService,
  isDark: boolean
) {
  if (service.metadata.imageUrl) return service.metadata.imageUrl

  const candidates = [service.name, service.id].flatMap((value) => {
    const normalized = normalizeServiceAssetName(value)
    const hyphenated = normalized.replace(/_/g, '-')
    return [
      `${normalized}_${isDark ? 'dark' : 'light'}`,
      `${hyphenated}_${isDark ? 'dark' : 'light'}`,
      normalized,
      hyphenated,
    ]
  })

  if (service.id === '@serviceadmin') {
    candidates.unshift('service-admin')
  }

  for (const candidate of candidates) {
    if (serviceImageNames.has(candidate))
      return `/images/services/${candidate}.svg`
  }

  return undefined
}
