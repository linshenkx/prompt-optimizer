import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@ui': path.resolve(__dirname, '../ui')
    }
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'PromptOptimizerUI',
      fileName: (format) => `index.${format === 'es' ? 'js' : 'cjs'}`,
      formats: ['es', 'cjs']
    },
    watch: process.env.NODE_ENV === 'development' ? {
      // 更精确的监听配置
      include: ['src/**/*'],
      buildDelay: 100
    } : null,
    sourcemap: true,
    rollupOptions: {
      external: ['vue', 'vue-router', '@prompt-optimizer/core', 'element-plus', 'element-plus/dist/index.css', 'uuid'],
      output: {
        globals: {
          vue: 'Vue',
          'vue-router': 'VueRouter',
          '@prompt-optimizer/core': 'PromptOptimizerCore',
          'element-plus': 'ElementPlus',
          'uuid': 'uuid'
        },
        assetFileNames: 'style.css'
      }
    },
    cssCodeSplit: false,
    emptyOutDir: false
  },
  assetsInclude: ['**/*.jpg', '**/*.jpeg', '**/*.png', '**/*.svg']
}) 
