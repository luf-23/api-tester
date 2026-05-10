import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/**/*.test.ts', 'apps/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@api-tester/shared': path.resolve(__dirname, 'packages/shared/src'),
      '@api-tester/domain': path.resolve(__dirname, 'packages/domain/src'),
      '@api-tester/storage': path.resolve(__dirname, 'packages/storage/src'),
    },
  },
})
