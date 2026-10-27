import base from '../../playwright.config'

/** Optional local acceptance across installed browsers, using isolated profiles. */
export default {
  ...base,
  testDir: '.',
  testMatch: 'remote-backup-import-code.spec.ts',
  workers: 1,
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' as const } },
    { name: 'chrome', use: { browserName: 'chromium' as const, channel: 'chrome' } },
    { name: 'edge', use: { browserName: 'chromium' as const, channel: 'msedge' } },
  ],
}
