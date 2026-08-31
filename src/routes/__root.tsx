import { type QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { shouldShowTanStackDevtools } from '@/lib/service-lasso-dashboard/devtools-gate'
import { DirectionProvider } from '@/context/direction-provider'
import { FontProvider } from '@/context/font-provider'
import { ThemeProvider } from '@/context/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { NavigationProgress } from '@/components/navigation-progress'
import { GeneralError } from '@/features/errors/general-error'
import { NotFoundError } from '@/features/errors/not-found-error'
import { FirstRunSetupGate } from '@/features/first-run-setup'

const showTanStackDevtools = shouldShowTanStackDevtools(import.meta.env)

type ServiceAdminRouterContext = {
  queryClient: QueryClient
  firstRunSetupGate: boolean
}

function RootComponent() {
  const { firstRunSetupGate } = Route.useRouteContext()
  const outlet = firstRunSetupGate ? (
    <FirstRunSetupGate>
      <Outlet />
    </FirstRunSetupGate>
  ) : (
    <Outlet />
  )

  return (
    <ThemeProvider>
      <FontProvider>
        <DirectionProvider>
          <NavigationProgress />
          {outlet}
          <Toaster duration={5000} />
          {showTanStackDevtools && (
            <>
              <ReactQueryDevtools buttonPosition='bottom-left' />
              <TanStackRouterDevtools position='bottom-right' />
            </>
          )}
        </DirectionProvider>
      </FontProvider>
    </ThemeProvider>
  )
}

export const Route = createRootRouteWithContext<ServiceAdminRouterContext>()({
  component: RootComponent,
  notFoundComponent: NotFoundError,
  errorComponent: GeneralError,
})
