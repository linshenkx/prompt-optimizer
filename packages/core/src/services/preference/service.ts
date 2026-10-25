import type { IPreferenceService, PreferenceReadSnapshot } from "./types";
import type { IStorageProvider } from "../storage/types";
import { ImportExportError } from "../../interfaces/import-export";
import { IMPORT_EXPORT_ERROR_CODES } from "../../constants/error-codes";
import { StorageError } from "../storage/errors";
import { toErrorWithCode } from "../../utils/error";
import { FUNCTION_MODEL_KEYS } from "../../constants/storage-keys";
import { GLOBAL_SETTINGS_STORAGE_KEY, LEGACY_GLOBAL_SETTING_FIELDS, parseGlobalSettingsSnapshot } from './global-settings';

const SESSION_KEY_PREFIX = "session/";
export const MAX_SESSION_SNAPSHOT_BYTES = 1024 * 1024;

type SessionStorageOperation = "read" | "write";
type PreferenceStorageOperation = SessionStorageOperation | "delete";

const getSerializedValueBytes = (value: string): number =>
  new TextEncoder().encode(value).byteLength;

const assertSessionSnapshotSize = (
  key: string,
  serializedValue: string,
  operation: SessionStorageOperation,
): void => {
  if (!key.startsWith(SESSION_KEY_PREFIX)) {
    return;
  }

  const bytes = getSerializedValueBytes(serializedValue);
  if (bytes <= MAX_SESSION_SNAPSHOT_BYTES) {
    return;
  }

  throw new StorageError(
    `Session snapshot exceeds ${MAX_SESSION_SNAPSHOT_BYTES} bytes`,
    operation,
    {
      reason: "session_snapshot_too_large",
      key,
      bytes,
      limitBytes: MAX_SESSION_SNAPSHOT_BYTES,
    },
  );
};

const assertValidPreferenceKey: (
  key: unknown,
  operation: PreferenceStorageOperation,
) => asserts key is string = (key, operation) => {
  if (typeof key !== "string" || key.length === 0) {
    throw new StorageError("Invalid preference key", operation, {
      reason: "invalid_preference_key",
      keyType: typeof key,
    });
  }
};

// 需要导出的UI配置键 - 白名单验证
const UI_SETTINGS_KEYS = [
  FUNCTION_MODEL_KEYS.EVALUATION_MODEL,
  FUNCTION_MODEL_KEYS.IMAGE_RECOGNITION_MODEL,
  "app:settings:ui:theme-id",
  "app:settings:ui:preferred-language",
  "app:settings:ui:builtin-template-language",

  // 已废弃：模型选择已迁移到各模式的 session store
  // 保留用于导入旧版本数据时的向后兼容，避免导入失败
  // TODO: 确认无旧数据后可安全移除（预计 v3.0）
  "app:selected-optimize-model",
  "app:selected-test-model",

  "app:selected-optimize-template", // 系统优化模板
  "app:selected-user-optimize-template", // 用户优化模板
  "app:selected-iterate-template", // 迭代模板
] as const;

// 旧版本键名映射表 - 用于兼容性处理
const LEGACY_KEY_MAPPING: Record<string, string> = {
  // 旧版本的简短键名 -> 新版本的完整键名
  "theme-id": "app:settings:ui:theme-id",
  "preferred-language": "app:settings:ui:preferred-language",
  "builtin-template-language": "app:settings:ui:builtin-template-language",
  // 其他键名保持不变，因为它们已经有正确的前缀
};

/**
 * 将旧版本键名转换为新版本键名
 * @param key 原始键名
 * @returns 标准化后的键名
 */
const normalizeSettingKey = (key: string): string => {
  return LEGACY_KEY_MAPPING[key] || key;
};

/**
 * 验证UI配置键是否安全
 */
const isValidSettingKey = (key: string): boolean => {
  // 先标准化键名，再验证
  const normalizedKey = normalizeSettingKey(key);
  return (
    UI_SETTINGS_KEYS.includes(normalizedKey as any) &&
    normalizedKey.length <= 50 &&
    normalizedKey.length > 0 &&
    !/[<>"\\'&\x00-\x1f\x7f-\x9f]/.test(normalizedKey)
  ); // 排除危险字符和控制字符
};

/**
 * 验证UI配置值是否安全
 */
const isValidSettingValue = (value: any): value is string => {
  return (
    typeof value === "string" &&
    value.length <= 1000 && // 限制值的长度
    !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/.test(value)
  ); // 排除控制字符
};

/**
 * 基于IStorageProvider的偏好设置服务实现
 */
export class PreferenceService implements IPreferenceService {
  private readonly PREFIX = "pref:";
  private keyCache: Set<string> = new Set();
  private storageProvider: IStorageProvider;
  readonly compareAndSet?: IPreferenceService['compareAndSet'];
  readonly readSnapshot?: IPreferenceService['readSnapshot'];

  constructor(storageProvider: IStorageProvider) {
    this.storageProvider = storageProvider;
    if (storageProvider.compareAndSetItem) {
      this.readSnapshot = async <T>(key: string, defaultValue: T): Promise<PreferenceReadSnapshot<T>> => {
        assertValidPreferenceKey(key, 'read');
        const prefKey = this.getPrefKey(key);
        // Keep the original bytes private: reserializing decoded JSON would not
        // match formatted legacy values, and oversized values cannot be decoded.
        let storedValue = await storageProvider.getItem(prefKey);
        let result: PreferenceReadSnapshot<T>['result'];
        try {
          result = { ok: true, value: this.decodePreferenceValue(key, storedValue, defaultValue) };
        } catch (error) {
          result = {
            ok: false,
            // JSON.parse errors can quote private payloads. Expose only the
            // structured size error or a payload-free decoding failure.
            error: error instanceof StorageError ? error : new StorageError(
              'Failed to decode preference snapshot', 'read', { reason: 'invalid_preference_json' },
            ),
          };
        }
        let canRemove = storedValue !== null;
        return {
          result,
          removeIfUnchanged: async () => {
            if (!canRemove) return false;
            canRemove = false;
            const expected = storedValue;
            storedValue = null;
            const removed = await storageProvider.compareAndSetItem!(prefKey, expected, null);
            if (removed) this.keyCache.delete(key);
            return removed;
          },
        };
      };
      this.compareAndSet = async <T>(key: string, expected: unknown, value: T | null) => {
        assertValidPreferenceKey(key, 'write');
        const serialized = value === null ? null : JSON.stringify(value);
        if (serialized !== null) assertSessionSnapshotSize(key, serialized, 'write');
        let matched = await storageProvider.compareAndSetItem!(
          this.getPrefKey(key), expected == null ? null : JSON.stringify(expected), serialized,
        );
        // Legacy preference writers could persist JSON null instead of removing a key.
        if (!matched && expected == null) {
          matched = await storageProvider.compareAndSetItem!(this.getPrefKey(key), 'null', serialized);
        }
        if (matched) {
          if (value === null) this.keyCache.delete(key);
          else this.keyCache.add(key);
        }
        return matched;
      };
    }
  }

  /**
   * 获取偏好设置
   * @param key 键名
   * @param defaultValue 默认值
   * @returns 设置值，如果不存在则返回默认值
   */
  async get<T>(key: string, defaultValue: T): Promise<T> {
    try {
      assertValidPreferenceKey(key, "read");
      const prefKey = this.getPrefKey(key);
      const storedValue = await this.storageProvider.getItem(prefKey);

      return this.decodePreferenceValue(key, storedValue, defaultValue);
    } catch (error) {
      console.error(
        `[PreferenceService] Error getting preference for key "${key}":`,
        error,
      );
      if (typeof (error as any)?.code === "string") {
        throw toErrorWithCode(error);
      }
      const details = error instanceof Error ? error.message : String(error);
      throw new StorageError(`Failed to get preference: ${details}`, "read");
    }
  }

  private decodePreferenceValue<T>(key: string, storedValue: string | null, defaultValue: T): T {
    if (storedValue === null) return defaultValue;
    assertSessionSnapshotSize(key, storedValue, 'read');
    this.keyCache.add(key);
    return JSON.parse(storedValue) as T;
  }

  /**
   * 设置偏好设置
   * @param key 键名
   * @param value 值
   */
  async set<T>(key: string, value: T): Promise<void> {
    try {
      assertValidPreferenceKey(key, "write");
      const prefKey = this.getPrefKey(key);
      const stringValue = JSON.stringify(value);
      assertSessionSnapshotSize(key, stringValue, "write");

      await this.storageProvider.setItem(prefKey, stringValue);
      // 将键添加到缓存中
      this.keyCache.add(key);
    } catch (error) {
      console.error(
        `[PreferenceService] Error setting preference for key "${key}":`,
        error,
      );
      if (typeof (error as any)?.code === "string") {
        throw toErrorWithCode(error);
      }
      const details = error instanceof Error ? error.message : String(error);
      throw new StorageError(`Failed to set preference: ${details}`, "write");
    }
  }

  /**
   * 删除偏好设置
   * @param key 键名
   */
  async delete(key: string): Promise<void> {
    try {
      assertValidPreferenceKey(key, "delete");
      const prefKey = this.getPrefKey(key);
      await this.storageProvider.removeItem(prefKey);
      // 从缓存中移除键
      this.keyCache.delete(key);
    } catch (error) {
      console.error(
        `[PreferenceService] Error deleting preference for key "${key}":`,
        error,
      );
      if (typeof (error as any)?.code === "string") {
        throw toErrorWithCode(error);
      }
      const details = error instanceof Error ? error.message : String(error);
      throw new StorageError(`Failed to delete preference: ${details}`, "delete");
    }
  }

  /**
   * 获取所有偏好设置的键名
   * @returns 键名列表
   */
  async keys(): Promise<string[]> {
    // 由于IStorageProvider没有getAllKeys方法，我们只能返回已知的键
    // 这是一个限制，但在大多数情况下应该足够了
    return Array.from(this.keyCache);
  }

  /**
   * 清除所有偏好设置
   */
  async clear(): Promise<void> {
    try {
      const prefKeys = Array.from(this.keyCache);
      for (const key of prefKeys) {
        await this.delete(key);
      }
      this.keyCache.clear();
    } catch (error) {
      console.error("[PreferenceService] Error clearing preferences:", error);
      if (typeof (error as any)?.code === "string") {
        throw toErrorWithCode(error);
      }
      const details = error instanceof Error ? error.message : String(error);
      throw new StorageError(`Failed to clear preferences: ${details}`, "clear");
    }
  }

  /**
   * 获取所有偏好设置
   * @returns 包含所有偏好设置的键值对对象（使用原始键名，不带前缀）
   */
  async getAll(): Promise<Record<string, string>> {
    try {
      // 重启后缓存只包含本次访问过的键，已知 UI 设置仍需从存储读取。
      const allKeys = new Set([...await this.keys(), ...UI_SETTINGS_KEYS]);
      const result: Record<string, string> = {};

      for (const key of allKeys) {
        try {
          const value = await this.get(key, null);
          if (value !== null) {
            result[key] = String(value);
          }
        } catch (error) {
          console.warn(
            `[PreferenceService] Failed to get preference for key "${key}":`,
            error,
          );
          // 继续处理其他键，不因单个键失败而中断
        }
      }

      return result;
    } catch (error) {
      console.error(
        "[PreferenceService] Error getting all preferences:",
        error,
      );
      if (typeof (error as any)?.code === "string") {
        throw toErrorWithCode(error);
      }
      const details = error instanceof Error ? error.message : String(error);
      throw new StorageError(`Failed to get all preferences: ${details}`, "read");
    }
  }

  // 实现 IImportExportable 接口

  /**
   * 导出所有偏好设置
   */
  async exportData(): Promise<Record<string, string>> {
    try {
      // Session snapshots have their own structured DataManager section. They must
      // not be exported as "[object Object]" UI settings or bypass its whitelist.
      return Object.fromEntries(
        Object.entries(await this.getAll()).filter(([key]) => !key.startsWith(SESSION_KEY_PREFIX)),
      );
    } catch (error) {
      throw new ImportExportError(
        "Failed to export preference data",
        await this.getDataType(),
        error as Error,
        IMPORT_EXPORT_ERROR_CODES.EXPORT_FAILED,
      );
    }
  }

  /**
   * 导入偏好设置
   */
  async importData(data: any): Promise<void> {
    if (!(await this.validateData(data))) {
      throw new ImportExportError(
        "Invalid preference data format: data must be an object with string key-value pairs",
        await this.getDataType(),
        undefined,
        IMPORT_EXPORT_ERROR_CODES.VALIDATION_ERROR,
      );
    }

    const preferences = data as Record<string, string>;
    const failedSettings: { key: string; error: Error }[] = [];
    const legacyGlobalSettings: Record<string, string> = {};
    const importedGlobalSettings = parseGlobalSettingsSnapshot(preferences[GLOBAL_SETTINGS_STORAGE_KEY]);

    for (const [key, value] of Object.entries(preferences)) {
      try {
        // The structured snapshot has its own field validation, not the legacy key whitelist.
        if (key === GLOBAL_SETTINGS_STORAGE_KEY) {
          if (!importedGlobalSettings) console.warn('Skipping invalid global settings snapshot');
          continue;
        }
        // 验证键名是否安全且在白名单中
        if (!isValidSettingKey(key)) {
          console.warn(`Skipping invalid UI configuration key: ${key}`);
          continue;
        }

        // 验证值是否安全
        if (!isValidSettingValue(value)) {
          console.warn(
            `Skipping invalid UI configuration value ${key}: type=${typeof value}`,
          );
          continue;
        }

        // 标准化键名（处理旧版本兼容性）
        const normalizedKey = normalizeSettingKey(key);

        await this.set(normalizedKey, value);
        const globalField = LEGACY_GLOBAL_SETTING_FIELDS[normalizedKey as keyof typeof LEGACY_GLOBAL_SETTING_FIELDS];
        if (globalField) legacyGlobalSettings[globalField] = value;

        // 如果键名被转换了，显示转换信息
        if (normalizedKey !== key) {
          console.log(
            `Imported UI configuration (legacy key converted): ${key} -> ${normalizedKey} = ${value}`,
          );
        } else {
          console.log(`Imported UI configuration: ${normalizedKey} = ${value}`);
        }
      } catch (error) {
        console.warn(`Failed to import UI setting ${key}:`, error);
        failedSettings.push({ key, error: error as Error });
      }
    }

    // Old backups must also update the current snapshot, otherwise it masks the imported legacy keys.
    // A v1 snapshot is authoritative over mirrored legacy values, regardless of property order.
    const legacySnapshot = parseGlobalSettingsSnapshot(JSON.stringify(legacyGlobalSettings));
    if (importedGlobalSettings || legacySnapshot) {
      try {
        const current = parseGlobalSettingsSnapshot(await this.get(GLOBAL_SETTINGS_STORAGE_KEY, ''));
        await this.set(GLOBAL_SETTINGS_STORAGE_KEY, JSON.stringify({
          ...current, ...legacySnapshot, ...importedGlobalSettings,
        }));
        // Language/bootstrap consumers still read these compatibility keys.
        // Mirror only explicitly imported fields, with the same v1 priority.
        for (const [legacyKey, field] of Object.entries(LEGACY_GLOBAL_SETTING_FIELDS)) {
          const value = importedGlobalSettings?.[field];
          if (value !== undefined) await this.set(legacyKey, value);
        }
      } catch (error) {
        // Do not report a successful restore when the authoritative UI snapshot was not written.
        throw new ImportExportError('Failed to import global settings', await this.getDataType(), error as Error);
      }
    }

    if (failedSettings.length > 0) {
      console.warn(`Failed to import ${failedSettings.length} UI settings`);
      // 不抛出错误，允许部分成功的导入
    }
  }

  /**
   * 获取数据类型标识
   */
  async getDataType(): Promise<string> {
    return "userSettings";
  }

  /**
   * 验证偏好设置数据格式
   */
  async validateData(data: any): Promise<boolean> {
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      return false;
    }

    return Object.entries(data).every(
      ([key, value]) =>
        typeof key === "string" &&
        (typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean"),
    );
  }

  /**
   * 获取带前缀的键名
   * @param key 原始键名
   * @returns 带前缀的键名
   * @private
   */
  private getPrefKey(key: string): string {
    return `${this.PREFIX}${key}`;
  }
}

/**
 * 创建偏好设置服务
 * @param storageProvider 存储提供器
 * @returns 偏好设置服务实例
 */
export function createPreferenceService(
  storageProvider: IStorageProvider,
): IPreferenceService {
  return new PreferenceService(storageProvider);
}
