import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 加载环境变量（从项目根目录加载）
  const env = loadEnv(mode, resolve(process.cwd(), '../../'))
  
  return {
    plugins: [vue()],
    server: {
      port: 18181,
      host: true,
      fs: {
        // 允许为工作区依赖提供服务
        allow: ['..']
      }
    },
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html')
        }
      }
    },
    publicDir: 'public',
    resolve: {
      preserveSymlinks: true,
      alias: {
        '@': resolve(__dirname, 'src'),
        '@ui': resolve(__dirname, '../ui'),
        '@prompt-optimizer/ui': resolve(__dirname, '../ui'),
        // 简化样式导入
        '@ui-styles': resolve(__dirname, '../ui/dist/style.css')
      }
    },
    optimizeDeps: {
      // 包含工作区依赖
      include: ['@prompt-optimizer/ui', 'element-plus']
    },
    define: {
      'process.env': {
        NODE_ENV: JSON.stringify(process.env.NODE_ENV || 'development'),
        ...Object.keys(env).reduce((acc, key) => {
          acc[key] = env[key];
          return acc;
        }, {})
      }
    }
  }
})