import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/test/setup.ts',
      // Full service-detail flows exercise several modal and mutation states.
      // Keep the bound explicit so slower Windows runners do not turn successful
      // interaction sequences into the Vitest five-second default timeout.
      testTimeout: 15_000,
    },
  })
)
