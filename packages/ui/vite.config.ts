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
    watch: process.env.NODE_ENV === 'development' ? {} : null,
    sourcemap: true,
    rollupOptions: {
      external: ['vue', '@prompt-optimizer/core', 'element-plus', 'element-plus/dist/index.css', 'uuid'],
      output: {
        globals: {
          vue: 'Vue',
          '@prompt-optimizer/core': 'PromptOptimizerCore',
          'element-plus': 'ElementPlus',
          'uuid': 'uuid'
        },
        assetFileNames: 'style.css'
      }
    },
    cssCodeSplit: false
  },
  assetsInclude: ['**/*.jpg', '**/*.jpeg', '**/*.png', '**/*.svg']
}) 