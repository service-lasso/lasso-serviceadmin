import { Link } from '@tanstack/react-router'
import { ExternalLink } from 'lucide-react'
import { useServices } from '@/lib/service-lasso-api/hooks'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ServiceActionButtons } from '@/features/service-lasso/action-buttons'
import { StatusBadge } from '@/features/service-lasso/status-badge'

export function ServicesPage() {
  const { data: services } = useServices()

  if (!services) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Services</CardTitle>
        <CardDescription>
          First-pass service list with operator actions, ports, URLs, and
          stub-backed state.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Service</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Acquisition</TableHead>
              <TableHead>Ports</TableHead>
              <TableHead>URLs</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {services.map((service) => (
              <TableRow key={service.id}>
                <TableCell>
                  <div className='font-medium'>
                    <Link
                      to='/services/$serviceId'
                      params={{ serviceId: service.id }}
                      className='hover:underline'
                    >
                      {service.name}
                    </Link>
                  </div>
                  <div className='text-sm text-muted-foreground'>
                    {service.id}
                  </div>
                </TableCell>
                <TableCell>
                  <StatusBadge status={service.status} />
                </TableCell>
                <TableCell className='capitalize'>{service.category}</TableCell>
                <TableCell>{service.acquisition}</TableCell>
                <TableCell>
                  {service.ports.length ? service.ports.join(', ') : '—'}
                </TableCell>
                <TableCell>
                  <div className='flex flex-col gap-1'>
                    {service.urls.length ? (
                      service.urls.map((url: string) => (
                        <a
                          key={url}
                          href={url}
                          className='inline-flex items-center gap-1 text-sm text-primary hover:underline'
                        >
                          {url}
                          <ExternalLink className='size-3' />
                        </a>
                      ))
                    ) : (
                      <span className='text-muted-foreground'>—</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <ServiceActionButtons
                    serviceId={service.id}
                    actions={service.actions}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
