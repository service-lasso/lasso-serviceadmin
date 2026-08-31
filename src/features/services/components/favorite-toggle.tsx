import { Star } from 'lucide-react'
import {
  useFavoriteFeatureState,
  useToggleFavorite,
} from '@/lib/service-lasso-dashboard/hooks'
import type { DashboardService } from '@/lib/service-lasso-dashboard/types'

const disabledFavoritesTitle =
  'Favorites editing is disabled because VITE_SERVICE_LASSO_FAVORITES_ENABLED=false'

/**
 * Builds the accessible label for adding or removing a service favorite.
 */
export function favoriteToggleLabel(service: DashboardService): string {
  return service.favorite ? 'Remove favorite' : 'Add favorite'
}

type FavoriteToggleProps = {
  service: DashboardService
  className?: string
}

/**
 * Operator favorite star. Enabled against live Core by default; the Vite env
 * is only a kill-switch (`false`).
 */
export function FavoriteToggle({ service, className }: FavoriteToggleProps) {
  const toggleFavorite = useToggleFavorite()
  const favoriteFeature = useFavoriteFeatureState()
  const label = favoriteToggleLabel(service)

  return (
    <button
      type='button'
      aria-label={label}
      title={favoriteFeature.enabled ? label : disabledFavoritesTitle}
      disabled={!favoriteFeature.enabled}
      className={
        className ??
        'inline-flex items-center rounded-md border p-1.5 hover:bg-accent/40 disabled:cursor-not-allowed disabled:opacity-50'
      }
      onClick={(event) => {
        event.stopPropagation()
        if (!favoriteFeature.enabled) {
          return
        }
        void toggleFavorite.mutateAsync(service.id)
      }}
    >
      <Star
        className={`size-4 ${service.favorite ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground'}`}
      />
    </button>
  )
}
