import { IImportExportable } from '../../interfaces/import-export';

/** One read and a single-use cleanup bound to the exact stored representation. */
export interface PreferenceReadSnapshot<T> {
  readonly result: { ok: true; value: T } | { ok: false; error: unknown };
  /** Removes only the value read above. A changed or already consumed snapshot returns false. */
  removeIfUnchanged(): Promise<boolean>;
}

export interface IPreferenceService extends IImportExportable {
  get<T>(key: string, defaultValue: T): Promise<T>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
  clear(): Promise<void>;

  /** Available only when backed by a genuinely atomic storage operation. null removes the key. */
  compareAndSet?<T>(key: string, expected: unknown, value: T | null): Promise<boolean>;

  /** Atomic storage only. IO failures throw; decoding failures are returned in result. */
  readSnapshot?<T>(key: string, defaultValue: T): Promise<PreferenceReadSnapshot<T>>;

  /**
   * 获取所有偏好设置
   * @returns 包含所有偏好设置的键值对对象
   */
  getAll(): Promise<Record<string, string>>;
}
