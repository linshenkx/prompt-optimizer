import { defineConfig, loadEnv, mergeConfig } from 'vite'
import { resolve } from 'node:path'
import webConfig from './vite.config'

export default defineConfig((environment) => {
  // This key is server-only. Never use a VITE_ prefix or expose it in define.
  const previewKey = loadEnv(environment.mode, resolve(__dirname, '../..'), 'MAGPIE_WORKSPACE_PREVIEW_').MAGPIE_WORKSPACE_PREVIEW_KEY
  return mergeConfig(webConfig(environment), {
    define: { 'import.meta.env.VITE_WORKSPACE_PREVIEW': JSON.stringify('1') },
    resolve: {
      preserveSymlinks: false,
      dedupe: ['vue'],
      alias: [
        { find: '@prompt-optimizer/ui/dist/style.css', replacement: resolve(__dirname, '../ui/src/styles/index.css') },
        { find: /^@prompt-optimizer\/ui$/, replacement: resolve(__dirname, '../ui/src/index.ts') },
      ],
    },
    server: {
      host: '0.0.0.0',
      strictPort: true,
      fs: { allow: [resolve(__dirname, '../..')] },
      // Local preview only: keep the browser on the same origin as the app.
      // Expose inference/catalog endpoints, not Magpie's management API.
      proxy: {
        '^/__local_magpie/v1/(models|chat/completions|images/(generations|edits))$': {
          target: 'http://127.0.0.1:3425',
          changeOrigin: true,
          configure(proxy) {
            proxy.on('proxyReq', (request) => {
              if (previewKey && (/^\/v1\/images\//.test(request.path) || request.path === '/v1/chat/completions')) {
                request.setHeader('Authorization', `Bearer ${previewKey}`)
              }
            })
          },
          rewrite: (path: string) => path.replace(/^\/__local_magpie/, ''),
          timeout: 600_000,
          proxyTimeout: 600_000,
        },
      },
    },
  })
})
