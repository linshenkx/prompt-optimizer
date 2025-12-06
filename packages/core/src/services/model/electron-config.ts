import { TextModelConfig } from './types';
import { getAllModels } from './defaults';

/**
 * Electron环境下的配置管理器
 * 确保UI进程和主进程的配置状态完全一致
 */
export class ElectronConfigManager {
  private static instance: ElectronConfigManager;
  private envVars: Record<string, string> = {};
  private initialized = false;

  private constructor() {}

  static getInstance(): ElectronConfigManager {
    if (!ElectronConfigManager.instance) {
      ElectronConfigManager.instance = new ElectronConfigManager();
    }
    return ElectronConfigManager.instance;
  }

  /**
   * 从主进程同步环境变量
   */
  async syncFromMainProcess(): Promise<void> {
    if (typeof window === 'undefined' || !window.electronAPI) {
      throw new Error('ElectronConfigManager can only be used in Electron renderer process');
    }

    try {
      console.log('[ElectronConfigManager] Syncing environment variables from main process...');
      this.envVars = await window.electronAPI.config.getEnvironmentVariables();
      this.initialized = true;
      console.log('[ElectronConfigManager] Environment variables synced successfully');

      // 调试输出
      Object.keys(this.envVars).forEach(key => {
        const value = this.envVars[key];
        if (value) {
          console.log(`[ElectronConfigManager] ${key}: ${value.substring(0, 10)}...`);
        }
      });
    } catch (error) {
      console.error('[ElectronConfigManager] Failed to sync environment variables:', error);
      throw error;
    }
  }

  /**
   * 获取环境变量
   */
  getEnvVar(key: string): string {
    if (!this.initialized) {
      console.warn(`[ElectronConfigManager] Environment variables not synced yet, returning empty for ${key}`);
      return '';
    }
    return this.envVars[key] || '';
  }

  /**
   * 检查是否已初始化
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * 生成默认模型配置（基于同步的环境变量）
   *
   * 注意：此方法现在直接调用 getAllModels()，因为 getEnvVar 已经支持多环境
   * （包括 process.env、import.meta.env、window.runtime_config）
   *
   * @returns TextModelConfig 格式的模型配置
   */
  generateDefaultModels(): Record<string, TextModelConfig> {
    return getAllModels();
  }
}

/**
 * 检查是否在Electron渲染进程中
 */
export function isElectronRenderer(): boolean {
  return typeof window !== 'undefined' && !!window.electronAPI;
}
