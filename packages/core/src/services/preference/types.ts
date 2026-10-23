import { IImportExportable } from '../../interfaces/import-export';

export interface IPreferenceService extends IImportExportable {
  get<T>(key: string, defaultValue: T): Promise<T>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
  clear(): Promise<void>;

  /** Available only when backed by a genuinely atomic storage operation. null removes the key. */
  compareAndSet?<T>(key: string, expected: unknown, value: T | null): Promise<boolean>;

  /**
   * 获取所有偏好设置
   * @returns 包含所有偏好设置的键值对对象
   */
  getAll(): Promise<Record<string, string>>;
}
