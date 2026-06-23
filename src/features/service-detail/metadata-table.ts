import type { DashboardService } from '@/lib/service-lasso-dashboard/types'

export type MetadataTableRow = {
  label: string
  value: string
}

export function buildMetadataTableRows(
  metadata: DashboardService['metadata']
): MetadataTableRow[] {
  return [
    { label: 'Package', value: metadata.packageId },
    { label: 'Install path', value: metadata.installPath },
    { label: 'Config path', value: metadata.configPath },
    { label: 'Data path', value: metadata.dataPath },
    { label: 'Log path', value: metadata.logPath },
    { label: 'Work path', value: metadata.workPath },
    { label: 'Profile', value: metadata.profile },
  ].filter(
    (row): row is MetadataTableRow =>
      typeof row.value === 'string' && row.value.trim().length > 0
  )
}
