import { defineConfig } from 'vitest/config'

// Deliberately bypass vitest.config.js and tests/setup.js: both load env files.
export default defineConfig({
  envDir: false,
  test: {
    environment: 'node',
    setupFiles: [],
    include: ['tests/unit/asset-reader/*.test.ts'],
    maxWorkers: 1,
  },
})
