import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Sticky table header that stays visible while the body scrolls. */
export const dataTableStickyHeaderClassName = 'sticky top-0 z-10 bg-background'

type DataTableScrollRegionProps = {
  children: ReactNode
  className?: string
  testId?: string
}

/**
 * Fills remaining page height and scrolls only the table body.
 * Keep pagination outside this region so the scrollbar sits above it.
 */
export function DataTableScrollRegion({
  children,
  className,
  testId = 'data-table-scroll-region',
}: DataTableScrollRegionProps) {
  return (
    <div
      className={cn(
        'min-h-[320px] min-w-0 flex-1 overflow-auto rounded-md border',
        className
      )}
      data-testid={testId}
    >
      {children}
    </div>
  )
}
