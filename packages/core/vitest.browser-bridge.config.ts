import { defineConfig } from 'vitest/config'

export default defineConfig({ envDir: false, test: {
  environment: 'node', setupFiles: [], maxWorkers: 1,
  include: ['tests/unit/browser-bridge/*.test.ts', 'tests/unit/asset-reader/*.test.ts', 'tests/unit/text-comparison/*.test.ts'],
} })
