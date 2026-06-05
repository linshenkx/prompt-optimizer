import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import basicSsl from '@vitejs/plugin-basic-ssl'

function createManualChunk(id: string): string | undefined {
  if (!id.includes('node_modules')) {
    return undefined
  }

  if (id.includes('/vue') || id.includes('/vue-router') || id.includes('/pinia') || id.includes('/vue-i18n')) {
    return 'vendor-vue'
  }
  if (id.includes('/naive-ui') || id.includes('/@vicons/')) {
    return 'vendor-ui'
  }
  if (id.includes('/@codemirror/') || id.includes('/codemirror')) {
    return 'vendor-editor'
  }
  if (id.includes('/markdown-it') || id.includes('/highlight.js') || id.includes('/dompurify')) {
    return 'vendor-markdown'
  }
  if (id.includes('/@aws-sdk/') || id.includes('/undici')) {
    return 'vendor-remote-storage'
  }

  return 'vendor'
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(), basicSsl()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@prompt-optimizer/ui': resolve(__dirname, '../ui')
    },
  },
  base: './',  // 使用相对路径
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'index.html')
      },
      output: {
        manualChunks: createManualChunk,
        entryFileNames: `assets/[name].js`,
        chunkFileNames: `assets/[name].js`,
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'background.js') {
            return 'background.js';
          }
          return `assets/[name].[ext]`;
        }
      }
    },
    copyPublicDir: true
  },
  server: {
    port: 5174,
    https: {}
  }
})
