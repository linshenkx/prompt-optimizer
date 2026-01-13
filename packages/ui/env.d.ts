/// <reference types="vite/client" />

declare module '*.vue' {
  import { type DefineComponent } from 'vue'

  const component: DefineComponent<{}, {}, any>
  export default component
}

// Vite 已经通过 /// <reference types="vite/client" /> 提供了内置的环境变量类型

// E2E: 注入到 window 的测试辅助变量
interface Window {
  __TEST_DB_NAME__?: string
}

// 引入 Electron 类型定义
/// <reference path="./src/types/electron.d.ts" />
