/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@prompt-optimizer/core': resolve(__dirname, '../core/src/index.ts'),
    },
  },
  test: {
    // 组件测试在本地与 CI 长链路中可能超过 5 秒；15 秒与现有慢用例保持一致。
    testTimeout: 15000,
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
      include: ['src/**/*.{ts,vue}'],
      exclude: [
        'coverage/**',
        'dist/**',
        '**/*.d.ts',
      ],
    },
  },
})
