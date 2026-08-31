import { type ImgHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Logo({
  alt = 'Service Lasso',
  className,
  ...props
}: ImgHTMLAttributes<HTMLImageElement>) {
  return (
    <img
      src='/images/service-lasso-icon.svg'
      alt={alt}
      className={cn('size-6', className)}
      {...props}
    />
  )
}
