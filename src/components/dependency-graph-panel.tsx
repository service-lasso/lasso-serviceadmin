import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

type DependencyGraphPanelProps = {
  title: string
  description: string
  actions?: ReactNode
  graph: ReactNode
  /**
   * Grow with the parent pane (Dependencies page). Off keeps the
   * service-detail neighborhood graph at its intrinsic canvas height.
   */
  fill?: boolean
  className?: string
  cardTestId?: string
}

export function DependencyGraphPanel({
  title,
  description,
  actions,
  graph,
  fill = false,
  className,
  cardTestId,
}: DependencyGraphPanelProps) {
  return (
    <Card
      className={cn(
        fill && 'flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
        className
      )}
      data-testid={cardTestId}
    >
      <CardHeader className={fill ? 'shrink-0' : undefined}>
        <div className='flex flex-wrap items-start justify-between gap-2'>
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {actions ? (
            <div className='flex items-center gap-2'>{actions}</div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent
        className={
          fill ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : 'space-y-3'
        }
      >
        {graph}
      </CardContent>
    </Card>
  )
}
