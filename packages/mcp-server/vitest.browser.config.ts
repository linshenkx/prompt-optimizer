import { defineConfig } from 'vitest/config';
export default defineConfig({ envDir: false, test: {
  environment: 'node', setupFiles: [], include: ['tests/browser-transport.test.ts'], maxWorkers: 1,
} });
