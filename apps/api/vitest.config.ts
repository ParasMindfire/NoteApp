import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'api',
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,mts}'],
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
})
