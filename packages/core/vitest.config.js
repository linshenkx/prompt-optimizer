import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import path from 'path'
import { fileURLToPath } from 'node:url'

/** 始终相对本配置文件定位 package 根，避免 monorepo 根目录调用时找错 setup/src。 */
const packageRoot = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => {
  // 优先加载 packages/core 下的 env，其次当前 cwd
  const envFromPackage = loadEnv(mode, packageRoot, '')
  const envFromCwd = loadEnv(mode, process.cwd(), '')
  process.env = { ...process.env, ...envFromCwd, ...envFromPackage }

  return {
    // 固定 root 为 core 包，保证包含路径与别名稳定
    root: packageRoot,
    test: {
      // Avoid Windows OOM with forked workers on large suites
      pool: 'threads',
      globals: true,
      environment: 'node',
      // 绝对路径 setup，从仓库根或 packages/core 调用均可
      setupFiles: [path.join(packageRoot, 'tests/setup.js')],
      // 设置测试超时时间
      testTimeout: 30000, // 默认30秒
      hookTimeout: 30000, // 钩子超时30秒
      // 环境变量配置
      env: {
        ...process.env
      }
    }
  }
}) 
