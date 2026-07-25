import type { ReactNode } from 'react'
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
}

export function DependencyGraphPanel({
  title,
  description,
  actions,
  graph,
}: DependencyGraphPanelProps) {
  return (
    <Card>
      <CardHeader>
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
      <CardContent className='space-y-3'>{graph}</CardContent>
    </Card>
  )
}
