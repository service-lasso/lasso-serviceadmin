import { useDependencyGraph } from '@/lib/service-lasso-api/hooks'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { StatusBadge } from '@/features/service-lasso/status-badge'

export function DependenciesPage() {
  const { data } = useDependencyGraph()

  if (!data) {
    return null
  }

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle>Dependencies</CardTitle>
          <CardDescription>
            React Flow is the intended richer graph layer later. This first
            slice keeps the contract visible with a clean textual graph stub.
          </CardDescription>
        </CardHeader>
        <CardContent className='grid gap-4 lg:grid-cols-[1.2fr_1fr]'>
          <div className='space-y-3'>
            {data.edges.map((edge) => (
              <div
                key={`${edge.from}-${edge.to}`}
                className='rounded-lg border p-3 text-sm'
              >
                <span className='font-medium'>{edge.from}</span> depends on{' '}
                <span className='font-medium'>{edge.to}</span>
              </div>
            ))}
          </div>
          <div className='space-y-3'>
            {data.nodes.map((node) => (
              <div key={node.id} className='rounded-lg border p-3'>
                <div className='flex items-center justify-between gap-3'>
                  <div>
                    <div className='font-medium'>{node.name}</div>
                    <div className='text-sm text-muted-foreground'>
                      {node.id}
                    </div>
                  </div>
                  <StatusBadge status={node.status} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
