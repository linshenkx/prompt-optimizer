/**
 * Pinia 实例管理和安装器
 *
 * 提供 Pinia 的创建、安装和服务注入功能
 *
 * 使用流程：
 * 1. 在应用启动时调用 installPinia(app)
 * 2. 服务初始化完成后调用 setPiniaServices(services)
 */

import { type App, shallowRef } from 'vue'
import { createPinia } from 'pinia'
import type { AppServices } from '../types/services'

/**
 * 模块级服务引用（使用 shallowRef 避免深度代理）
 */
const servicesRef = shallowRef<AppServices | null>(null)

/**
 * Pinia 实例（全局单例）
 */
export const pinia = createPinia()

/**
 * 安装 Pinia
 *
 * 用于应用启动阶段，在 app.mount() 之前调用
 *
 * @param app - Vue 应用实例
 */
export function installPinia(app: App) {
  app.use(pinia)
}

/**
 * 设置 Pinia 服务实例
 *
 * 用于服务初始化完成后，注入到所有 Store
 *
 * @param services - 应用服务实例（或 null）
 */
export function setPiniaServices(services: AppServices | null) {
  servicesRef.value = services
}

/**
 * 获取 Pinia 服务实例
 *
 * 这是**本项目推荐的服务访问方式**，用于 Store 和 Composable 内部访问服务。
 *
 * **设计说明**：
 * - 这是本项目的标准服务访问方式（工程取舍）
 * - 基于单例模式，适用于单应用场景
 * - 测试时需要使用 setPiniaServices() 设置 mock 服务
 * - 测试后需要调用 setPiniaServices(null) 清理，避免污染
 *
 * **为何推荐 getPiniaServices()**：
 * - 避免 this 上下文依赖，解构调用时更安全
 * - 符合函数式编程风格，与 Composition API 一致
 * - 测试更简单（直接调用函数即可）
 * - Setup Store 中无需依赖 this，代码更清晰
 * - 全局单例模式，适用于单应用场景
 *
 * **使用示例**：
 * ```typescript
 * import { getPiniaServices } from '@/plugins/pinia'
 *
 * export const useMyStore = defineStore('myStore', () => {
 *   const data = ref([])
 *
 *   const loadData = async () => {
 *     const $services = getPiniaServices()
 *     if (!$services) {
 *       console.warn('Services not available')
 *       return
 *     }
 *
 *     const models = await $services.modelManager.getAllModels()
 *     data.value = models
 *   }
 *
 *   return { data, loadData }
 * })
 * ```
 *
 * **测试示例**：
 * ```typescript
 * import { setPiniaServices } from '@/plugins/pinia'
 *
 * it('should load data', async () => {
 *   const mockServices = { modelManager: { getAllModels: vi.fn() } }
 *   setPiniaServices(mockServices as any)
 *
 *   const store = useMyStore()
 *   await store.loadData()
 *
 *   expect(mockServices.modelManager.getAllModels).toHaveBeenCalled()
 *
 *   setPiniaServices(null)  // 清理
 * })
 * ```
 *
 * @returns 应用服务实例（或 null）
 */
export function getPiniaServices(): AppServices | null {
  return servicesRef.value
}
