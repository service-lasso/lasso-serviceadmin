import { cn } from '@/lib/utils'
import { ContextualHelpLinks } from '@/components/contextual-help-links'

type MainProps = React.HTMLAttributes<HTMLElement> & {
  constrained?: boolean
  fixed?: boolean
  fluid?: boolean
  ref?: React.Ref<HTMLElement>
}

export function Main({
  children,
  constrained,
  fixed,
  className,
  fluid,
  ...props
}: MainProps) {
  return (
    <main
      data-layout={fixed ? 'fixed' : 'auto'}
      className={cn(
        'px-4 py-6',

        // If layout is fixed, make the main container flex and grow
        fixed && 'flex grow flex-col overflow-hidden',

        // Most app pages should fill the Service Admin workspace; opt in only
        // for intentionally narrow reading or settings surfaces.
        constrained &&
          !fluid &&
          '@7xl/content:mx-auto @7xl/content:w-full @7xl/content:max-w-7xl',
        className
      )}
      {...props}
    >
      <ContextualHelpLinks />
      {children}
    </main>
  )
}
