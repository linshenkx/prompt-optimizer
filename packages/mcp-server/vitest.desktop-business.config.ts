import { defineConfig } from 'vitest/config';
export default defineConfig({ envDir: false, test: {
  environment: 'node', setupFiles: [], include: ['tests/desktop-business.test.ts'], maxWorkers: 1,
} });
