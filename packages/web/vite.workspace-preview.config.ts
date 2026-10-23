import { defineConfig, loadEnv, mergeConfig, type ProxyOptions } from 'vite'
import { resolve } from 'node:path'
import webConfig from './vite.config'

export default defineConfig((environment) => {
  // This key is server-only. Never use a VITE_ prefix or expose it in define.
  const previewKey = loadEnv(environment.mode, resolve(__dirname, '../..'), 'MAGPIE_WORKSPACE_PREVIEW_').MAGPIE_WORKSPACE_PREVIEW_KEY
  const baseConfig = webConfig(environment)
  const legacyPreviewEnv = {
    VITE_CUSTOM_API_KEY_mobile_preview: '',
    VITE_CUSTOM_API_BASE_URL_mobile_preview: '',
    VITE_CUSTOM_API_MODEL_mobile_preview: '',
    VITE_CUSTOM_API_PARAMS_mobile_preview: '',
    VITE_CUSTOM_API_HEADERS_mobile_preview: '',
  }
  // Use the same restricted gateway for HMR and the built, installable preview.
  const proxy: Record<string, ProxyOptions> = {
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
  }
  return mergeConfig(baseConfig, {
    define: {
      'import.meta.env.VITE_WORKSPACE_PREVIEW': JSON.stringify('1'),
      // The historical dev-only preset must not enter an installable bundle.
      // Clear its metadata too, so discovery cannot create a keyless preset.
      ...(environment.command === 'build' ? {
        ...Object.fromEntries(Object.entries(legacyPreviewEnv).map(([key, value]) => [
          `import.meta.env.${key}`, JSON.stringify(value),
        ])),
        'process.env': { ...baseConfig.define?.['process.env'], ...legacyPreviewEnv },
      } : {}),
    },
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
      proxy,
    },
    preview: { host: '0.0.0.0', port: 18181, strictPort: true, proxy },
  })
})
