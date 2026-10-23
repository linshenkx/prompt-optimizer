import type { IStorageProvider } from './types';

/**
 * 内存存储提供者
 * 用于 Node.js 环境（如 Electron 主进程）和测试环境
 * 数据仅存储在内存中，应用重启后会丢失
 */
export class MemoryStorageProvider implements IStorageProvider {
  private storage = new Map<string, string>();

  async compareAndSetItem(key: string, expected: string | null, value: string | null): Promise<boolean> {
    if ((this.storage.get(key) ?? null) !== expected) return false;
    if (value === null) this.storage.delete(key);
    else this.storage.set(key, value);
    return true;
  }

  /**
   * 获取存储项
   * @param key 存储键
   * @returns 存储值或null
   */
  async getItem(key: string): Promise<string | null> {
    const value = this.storage.get(key);
    return value !== undefined ? value : null;
  }

  /**
   * 设置存储项
   * @param key 存储键
   * @param value 存储值
   */
  async setItem(key: string, value: string): Promise<void> {
    this.storage.set(key, value);
  }

  /**
   * 删除存储项
   * @param key 存储键
   */
  async removeItem(key: string): Promise<void> {
    this.storage.delete(key);
  }

  /**
   * 清空所有存储项
   */
  async clearAll(): Promise<void> {
    this.storage.clear();
  }

  /**
   * 更新数据
   * @param key 存储键
   * @param modifier 修改函数
   */
  async updateData<T>(key: string, modifier: (currentValue: T | null) => T): Promise<void> {
    const currentValue = await this.getItem(key);
    const parsedValue = currentValue ? JSON.parse(currentValue) : null;
    const newValue = modifier(parsedValue);
    await this.setItem(key, JSON.stringify(newValue));
  }

  /**
   * 批量更新
   * @param operations 操作数组
   */
  async batchUpdate(operations: Array<{
    key: string;
    operation: 'set' | 'remove';
    value?: string;
  }>): Promise<void> {
    for (const op of operations) {
      if (op.operation === 'set' && op.value !== undefined) {
        await this.setItem(op.key, op.value);
      } else if (op.operation === 'remove') {
        await this.removeItem(op.key);
      }
    }
  }

  /**
   * 获取存储能力
   * @returns 存储能力信息
   */
  getCapabilities() {
    return {
      supportsAtomic: true,
      supportsBatch: true,
      maxStorageSize: undefined // 内存存储没有固定限制
    };
  }

  /**
   * 获取存储项数量
   * @returns 存储项数量
   */
  get size(): number {
    return this.storage.size;
  }

  /**
   * 检查是否包含指定键
   * @param key 存储键
   * @returns 是否包含该键
   */
  has(key: string): boolean {
    return this.storage.has(key);
  }

  /**
   * 获取所有存储键
   * @returns 所有键的数组
   */
  getAllKeys(): string[] {
    return Array.from(this.storage.keys());
  }
}
