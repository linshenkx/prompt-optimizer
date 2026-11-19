import { defineConfig } from 'vitest/config'

export default defineConfig({ envDir: false, test: {
  environment: 'node', setupFiles: [], globals: true, maxWorkers: 1,
  include: ['tests/unit/asset-reader/*.test.ts', 'tests/unit/text-comparison/*.test.ts',
    'tests/unit/data/manager.test.ts', 'tests/unit/data/workspace-session-transfer.test.ts',
    'tests/unit/preference/read-snapshot.test.ts', 'tests/unit/preference/compare-and-set.test.ts',
    'tests/unit/preference/import-export.test.ts', 'tests/unit/preference/global-settings-import.test.ts'],
} })
