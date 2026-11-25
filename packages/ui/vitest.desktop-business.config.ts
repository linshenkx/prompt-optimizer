import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
export default defineConfig({ envDir: false, plugins: [vue()], test: {
  environment: 'jsdom', setupFiles: ['./tests/setup.ts'], maxWorkers: 1, testTimeout: 15000,
  include: ['tests/unit/utils/desktop-resource-worker.spec.ts'],
} })
