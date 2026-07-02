type DevtoolsEnv = {
  MODE?: string
  VITE_SERVICE_ADMIN_DEVTOOLS?: string
}

export function shouldShowTanStackDevtools(env: DevtoolsEnv) {
  return (
    env.MODE === 'development' && env.VITE_SERVICE_ADMIN_DEVTOOLS === 'true'
  )
}
