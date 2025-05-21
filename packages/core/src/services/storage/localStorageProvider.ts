import { IStorageProvider } from './types';

export class LocalStorageProvider implements IStorageProvider {
  public async getItem(key: string): Promise<string | null> {
    try {
      const item = localStorage.getItem(key);
      return Promise.resolve(item);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  public async setItem(key: string, value: string): Promise<void> {
    try {
      localStorage.setItem(key, value);
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  }

  public async removeItem(key: string): Promise<void> {
    try {
      localStorage.removeItem(key);
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  }

  public async clearAll(): Promise<void> {
    try {
      localStorage.clear();
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  }
}
