/**
 * IPC序列化工具
 * 用于处理Vue响应式对象在Electron IPC通信中的序列化问题
 * 
 * 这个工具专门为ElectronProxy类设计，提供统一的序列化处理
 */

import { CORE_ERROR_CODES, type ErrorParams } from '../constants/error-codes'

class IpcSerializationError extends Error {
  public readonly code: string
  public readonly params?: ErrorParams

  constructor(details: string) {
    super(`[${CORE_ERROR_CODES.IPC_SERIALIZATION_FAILED}] ${details}`)
    this.name = 'IpcSerializationError'
    this.code = CORE_ERROR_CODES.IPC_SERIALIZATION_FAILED
    this.params = { details }
  }
}

/**
 * 安全序列化函数，用于清理Vue响应式对象
 * 确保所有通过IPC传递的对象都是纯净的JavaScript对象
 * 
 * @param obj 要序列化的对象
 * @returns 纯净的JavaScript对象
 */
export function safeSerializeForIPC<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // 对于基本类型，直接返回
  if (typeof obj !== 'object') {
    return obj;
  }

  // 使用JSON序列化确保100%的IPC兼容性
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch (error) {
    console.error('[IPC Serialization] Failed to serialize object:', error);
    const details = error instanceof Error ? error.message : String(error)
    throw new IpcSerializationError(`Failed to serialize object for IPC: ${details}`);
  }
}

/**
 * 检查对象是否可以安全地通过IPC传递
 * 主要用于开发时调试
 * 
 * @param obj 要检查的对象
 * @param label 对象标签，用于日志输出
 */
export function debugIPCSerializability(obj: any, label: string = 'object'): void {
  try {
    JSON.stringify(obj);
    console.log(`[IPC Debug] ${label} is serializable`);
  } catch (error) {
    console.error(`[IPC Debug] ${label} is NOT serializable:`, error);
    console.error(`[IPC Debug] Object:`, obj);
  }
}

/**
 * 批量序列化多个参数
 * 用于有多个参数需要序列化的场景
 * 
 * @param args 参数数组
 * @returns 序列化后的参数数组
 */
export function safeSerializeArgs<T extends any[]>(...args: T): T {
  return args.map(arg => safeSerializeForIPC(arg)) as T;
}
