import type { IPreferenceService } from './types';
import { safeSerializeForIPC } from '../../utils/ipc-serialization';
import { StorageError } from '../storage/errors';

declare const window: {
  electronAPI: {
    preference: IPreferenceService;
  }
};

export class ElectronPreferenceServiceProxy implements IPreferenceService {
  private ensureApiAvailable() {
    const windowAny = window as any;
    if (!windowAny?.electronAPI?.preference) {
      throw new StorageError(
        'Electron API not available. Please ensure preload script is loaded and window.electronAPI.preference is accessible.',
        'read',
      );
    }
  }

  async get<T>(key: string, defaultValue: T): Promise<T> {
    this.ensureApiAvailable();
    return window.electronAPI.preference.get(key, defaultValue);
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.ensureApiAvailable();
    // 自动序列化，防止Vue响应式对象IPC传递错误
    const safeValue = safeSerializeForIPC(value);
    return window.electronAPI.preference.set(key, safeValue);
  }

  async delete(key: string): Promise<void> {
    this.ensureApiAvailable();
    return window.electronAPI.preference.delete(key);
  }

  async keys(): Promise<string[]> {
    this.ensureApiAvailable();
    return window.electronAPI.preference.keys();
  }

  async clear(): Promise<void> {
    this.ensureApiAvailable();
    return window.electronAPI.preference.clear();
  }

  async getAll(): Promise<Record<string, string>> {
    this.ensureApiAvailable();
    return (window.electronAPI as any).preference.getAll();
  }

  // 实现 IImportExportable 接口

  /**
   * 导出所有偏好设置
   */
  async exportData(): Promise<Record<string, string>> {
    this.ensureApiAvailable();
    return (window.electronAPI as any).preference.exportData();
  }

  /**
   * 导入偏好设置
   */
  async importData(data: any): Promise<void> {
    this.ensureApiAvailable();
    // 自动序列化，防止Vue响应式对象IPC传递错误
    const safeData = safeSerializeForIPC(data);
    return (window.electronAPI as any).preference.importData(safeData);
  }

  /**
   * 获取数据类型标识
   */
  async getDataType(): Promise<string> {
    this.ensureApiAvailable();
    return (window.electronAPI as any).preference.getDataType();
  }

  /**
   * 验证偏好设置数据格式
   */
  async validateData(data: any): Promise<boolean> {
    this.ensureApiAvailable();
    // 自动序列化，防止Vue响应式对象IPC传递错误
    const safeData = safeSerializeForIPC(data);
    return (window.electronAPI as any).preference.validateData(safeData);
  }
}
