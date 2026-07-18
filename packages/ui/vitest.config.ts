/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@prompt-optimizer/core/electron': resolve(__dirname, '../core/src/electron.ts'),
      '@prompt-optimizer/core': resolve(__dirname, '../core/src/index.ts'),
    },
  },
  test: {
    // 全局超时设置为5秒
    testTimeout: 5000,
    // 环境设置
    environment: 'jsdom',
    // 全局设置文件
    setupFiles: ['./tests/setup.ts'],
    // 包含的文件模式
    include: ['tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    // 排除的文件模式
    exclude: ['**/node_modules/**', '**/dist/**', '**/.{idea,git,cache,output,temp}/**'],
    // 全局测试设置
    globals: true,
    // 测试覆盖率配置
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'coverage/**',
        'dist/**',
        '**/[.]**',
        'packages/*/test?(s)/**',
        '**/*.d.ts',
        '**/virtual:*',
        '**/__x00__*',
        '**/\x00*',
        'cypress/**',
      ],
    },
  },
})
