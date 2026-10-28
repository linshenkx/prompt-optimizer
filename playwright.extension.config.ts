import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/extension',
  outputDir: './test-results/extension',
  workers: 1,
  retries: 0,
  timeout: 60000,
  expect: { timeout: 10000 },
  reporter: [['list']],
})
