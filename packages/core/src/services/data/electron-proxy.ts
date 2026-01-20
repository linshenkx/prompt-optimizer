import { IDataManager } from './types';
import { DataError } from './errors';
import { DATA_ERROR_CODES } from '../../constants/error-codes';

/**
 * Electron环境下的DataManager代理
 * 通过IPC调用主进程中的真实DataManager实例
 */
export class ElectronDataManagerProxy implements IDataManager {
  private electronAPI: any;

  constructor() {
    // 验证Electron环境
    if (typeof window === 'undefined' || !(window as any).electronAPI) {
      throw new DataError(
        DATA_ERROR_CODES.ELECTRON_API_UNAVAILABLE,
        'ElectronDataManagerProxy can only be used in Electron renderer process',
      );
    }
    this.electronAPI = (window as any).electronAPI;
  }

  async exportAllData(): Promise<string> {
    return this.electronAPI.data.exportAllData();
  }

  async importAllData(dataString: string): Promise<void> {
    await this.electronAPI.data.importAllData(dataString);
  }
} 
