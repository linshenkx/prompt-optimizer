import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import path from 'path'

export default defineConfig({
  // Monorepo: load VITE_* from repo root .env(.local) so optional integrations
  // can be enabled for the built UI bundle used by the web dev server.
  envDir: resolve(__dirname, '../..'),
  plugins: [vue()],
  resolve: {
    alias: {
      '@ui': path.resolve(__dirname, '../ui')
    }
  },
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        app: resolve(__dirname, 'src/app-entry.ts')
      },
      name: 'PromptOptimizerUI',
      fileName: (format, entryName) => `${entryName}.${format === 'es' ? 'js' : 'cjs'}`,
      formats: ['es', 'cjs']
    },
    watch: process.env.NODE_ENV === 'development' ? {
      // 更精确的监听配置
      include: ['src/**/*'],
      buildDelay: 100
    } : null,
    sourcemap: true,
    rollupOptions: {
      external: [
        'vue',
        'vue-router',
        '@prompt-optimizer/core',
        '@prompt-optimizer/core/electron',
        'uuid'
      ],
      output: {
        globals: {
          vue: 'Vue',
          'vue-router': 'VueRouter',
          '@prompt-optimizer/core': 'PromptOptimizerCore',
          '@prompt-optimizer/core/electron': 'PromptOptimizerCoreElectron',
          'uuid': 'uuid'
        },
        assetFileNames: 'style.css'
      }
    },
    cssCodeSplit: false,
    // UI types are emitted in a separate build step after Vite finishes.
    emptyOutDir: true
  },
  assetsInclude: ['**/*.jpg', '**/*.jpeg', '**/*.png', '**/*.svg']
}) 
