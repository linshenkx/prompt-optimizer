import { watch } from 'vue'
import type { Ref } from 'vue'
import type { IStorageProvider } from '@prompt-optimizer/core'
import type { AppServices } from '../types/services'

/**
 * Services 接口定义，仅包含此 composable 需要的部分
 */
interface Services {
  storageProvider: IStorageProvider;
}

/**
 * 统一存储服务Hook
 * 使用core提供的存储抽象，支持localStorage和Dexie
 * @param services 服务实例引用
 */
export function useStorage(services: Ref<AppServices | null>) {
  // 存储提供器实例引用
  let storage: IStorageProvider | null = null

  // 监听服务实例变化
  watch(services, (newServices) => {
    if (!newServices) return
    // 使用服务提供的存储实例，而不是自行创建
    storage = newServices.storageProvider
  }, { immediate: true })

  /**
   * 获取存储项
   * @param key 存储键
   * @returns 存储值或null
   */
  const getItem = async (key: string): Promise<string | null> => {
    try {
      // 检查storage是否可用
      if (!storage) {
        console.warn('Storage not available, cannot get item')
        return null
      }
      
      return await storage.getItem(key)
    } catch (error) {
      console.error(`获取存储项失败 (${key}):`, error)
      return null
    }
  }

  /**
   * 设置存储项
   * @param key 存储键
   * @param value 存储值
   */
  const setItem = async (key: string, value: string): Promise<void> => {
    try {
      // 检查storage是否可用
      if (!storage) {
        console.warn('Storage not available, cannot set item')
        throw new Error('Storage not available')
      }
      
      await storage.setItem(key, value)
    } catch (error) {
      console.error(`设置存储项失败 (${key}):`, error)
      throw error
    }
  }

  /**
   * 删除存储项
   * @param key 存储键
   */
  const removeItem = async (key: string): Promise<void> => {
    try {
      // 检查storage是否可用
      if (!storage) {
        console.warn('Storage not available, cannot remove item')
        throw new Error('Storage not available')
      }
      
      await storage.removeItem(key)
    } catch (error) {
      console.error(`删除存储项失败 (${key}):`, error)
      throw error
    }
  }

  /**
   * 获取JSON格式的存储项
   * @param key 存储键
   * @returns 解析后的对象或null
   */
  const getItemJSON = async <T = any>(key: string): Promise<T | null> => {
    try {
      const value = await getItem(key)
      return value ? JSON.parse(value) : null
    } catch (error) {
      console.error(`获取JSON存储项失败 (${key}):`, error)
      return null
    }
  }

  /**
   * 设置JSON格式的存储项
   * @param key 存储键
   * @param value 要序列化的对象
   */
  const setItemJSON = async (key: string, value: any): Promise<void> => {
    try {
      await setItem(key, JSON.stringify(value))
    } catch (error) {
      console.error(`设置JSON存储项失败 (${key}):`, error)
      throw error
    }
  }

  /**
   * 批量操作
   * @param operations 操作列表
   */
  const batchUpdate = async (operations: Array<{
    key: string;
    operation: 'set' | 'remove';
    value?: string;
  }>): Promise<void> => {
    try {
      // @ts-ignore
      if ('batchUpdate' in storage) {
        await storage.batchUpdate(operations)
      } else {
        // 降级到单个操作
        for (const op of operations) {
          if (op.operation === 'set' && op.value !== undefined) {
            await setItem(op.key, op.value)
          } else if (op.operation === 'remove') {
            await removeItem(op.key)
          }
        }
      }
    } catch (error) {
      console.error('批量更新失败:', error)
      throw error
    }
  }

  return {
    getItem,
    setItem,
    removeItem,
    getItemJSON,
    setItemJSON,
    batchUpdate
  }
}