import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import path from 'path'
import { DEFAULT_VITE_ENV } from '../core/src/utils/default-env'

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
export default defineConfig(({ mode }) => {
  const monorepoRoot = resolve(__dirname, '../..')
  const env = loadEnv(mode, monorepoRoot)
  const processEnv = {
    ...DEFAULT_VITE_ENV,
    ...env,
  }

  return {
    envDir: monorepoRoot,
    plugins: [vue()],
    server: {
      port: 18181,
      host: true,
      fs: {
        // 允许为工作区依赖提供服务
        allow: ['..']
      },
      hmr: true,
      watch: {
        // 确保监视monorepo中其他包的变化
        ignored: ['!**/node_modules/@prompt-optimizer/**']
      }
    },
    build: {
      chunkSizeWarningLimit: 3000,
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html')
        },
        output: {
          manualChunks: createManualChunk
        }
      }
    },
    publicDir: 'public',
    resolve: {
      preserveSymlinks: true,
      alias: {
        '@': resolve(__dirname, 'src'),
        '@prompt-optimizer/core': path.resolve(__dirname, '../core'),
        '@prompt-optimizer/ui': path.resolve(__dirname, '../ui'),
        '@prompt-optimizer/web': path.resolve(__dirname, '../web'),
        '@prompt-optimizer/extension': path.resolve(__dirname, '../extension')
      }
    },
    define: {
      'process.env': {
        NODE_ENV: JSON.stringify(process.env.NODE_ENV || 'development'),
        ...Object.keys(processEnv).reduce((acc, key) => {
          acc[key] = processEnv[key as keyof typeof processEnv]
          return acc
        }, {} as Record<string, string>)
      }
    }
  }
})
