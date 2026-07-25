import { useMemo } from 'react'
import { SearchIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSearch } from '@/context/search-provider'

type SearchProps = {
  className?: string
  placeholder?: string
}

export function Search({ className, placeholder = 'Search' }: SearchProps) {
  const { setOpen } = useSearch()

  const shortcutLabel = useMemo(() => {
    if (typeof window === 'undefined') return 'Ctrl+K'

    const platform = window.navigator.platform?.toLowerCase() ?? ''
    const userAgent = window.navigator.userAgent?.toLowerCase() ?? ''
    const isMac = platform.includes('mac') || userAgent.includes('mac os')

    return isMac ? '⌘K' : 'Ctrl+K'
  }, [])

  return (
    <button
      type='button'
      onClick={() => setOpen(true)}
      className={cn(
        'inline-flex h-9 w-fit items-center gap-2 rounded-md border bg-background px-3 text-sm text-muted-foreground shadow-xs transition-colors hover:bg-accent/40',
        className
      )}
    >
      <SearchIcon className='size-4' />
      <span className='min-w-24 text-left'>{placeholder}</span>
      <span className='ms-4 rounded border bg-muted px-1.5 py-0.5 text-[11px] font-medium'>
        {shortcutLabel}
      </span>
    </button>
  )
}
