export const serviceDetailTabs = [
  { id: 'overview', label: 'Overview', shortcut: 'Ctrl+1' },
  { id: 'dependencies', label: 'Dependencies', shortcut: 'Ctrl+2' },
  { id: 'endpoints', label: 'Endpoints', shortcut: 'Ctrl+3' },
  { id: 'variables', label: 'Variables', shortcut: 'Ctrl+4' },
  { id: 'config', label: 'Config', shortcut: 'Ctrl+5' },
  { id: 'logs', label: 'Logs', shortcut: 'Ctrl+6' },
  { id: 'terminal', label: 'Terminal', shortcut: 'Ctrl+7' },
  { id: 'setup', label: 'Setup', shortcut: 'Ctrl+8' },
  { id: 'access', label: 'Access', shortcut: 'Ctrl+9' },
  { id: 'secrets', label: 'Secrets', shortcut: 'Ctrl+0' },
] as const

export type ServiceDetailTabId = (typeof serviceDetailTabs)[number]['id']

export const defaultServiceDetailTab: ServiceDetailTabId = 'overview'

export const serviceDetailTabsByShortcut = Object.fromEntries(
  serviceDetailTabs.map((tab) => [
    getServiceDetailTabShortcutLabel(tab.shortcut),
    tab.id,
  ])
) as Record<string, ServiceDetailTabId>

export function getServiceDetailTabShortcutLabel(shortcut: string): string {
  const lastKey = shortcut.split('+').pop()?.trim()

  return lastKey || shortcut
}

const serviceDetailTabIds = new Set<ServiceDetailTabId>(
  serviceDetailTabs.map((tab) => tab.id)
)

export function normalizeServiceDetailTab(value: unknown): ServiceDetailTabId {
  return typeof value === 'string' &&
    serviceDetailTabIds.has(value as ServiceDetailTabId)
    ? (value as ServiceDetailTabId)
    : defaultServiceDetailTab
}
