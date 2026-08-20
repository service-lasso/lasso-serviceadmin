import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      globals: true,
      exclude: ['**/node_modules/**', '**/dist/**', '**/tests/ui/**'],
      setupFiles: './src/test/setup.ts',
      testTimeout: 30000,
    },
  })
)
