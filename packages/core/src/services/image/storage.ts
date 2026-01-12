import Dexie, { Table } from 'dexie'
import type {
  FullImageData,
  ImageMetadata,
  IImageStorageService,
  ImageStorageConfig
} from './types'

/**
 * 图像存储数据库（IndexedDB）
 * 使用独立的数据库，与主应用数据库分离
 *
 * 架构优化：将 metadata 和 data 拆分成两个表
 * - imageMetadata: 轻量级元数据，用于统计和查询
 * - imageData: 实际的 base64 数据，按需加载
 */
class ImageDB extends Dexie {
  imageMetadata!: Table<MetadataRecord, string>
  imageData!: Table<DataRecord, string>

  constructor() {
    super('PromptOptimizerImageDB')

    // Dexie 版本声明必须按升序（v1 -> v2），upgrade 回调挂在目标版本（v2）。
    // v1: 单表 images（metadata + base64 data）
    this.version(1).stores({
      images: 'id, createdAt, accessedAt, sizeBytes, source'
    })

    // v2: 拆分 metadata 和 data 表，提升统计性能；删除旧 images 表
    this.version(2)
      .stores({
        imageMetadata: 'id, createdAt, accessedAt, sizeBytes, source',
        imageData: 'id',
        images: null
      })
      .upgrade(async tx => {
        // 迁移旧数据到新表结构（分批处理，避免一次性加载大量 base64 导致内存尖峰）
        const oldImages = tx.table<ImageRecordV1>('images')
        const newMetadata = tx.table<MetadataRecord>('imageMetadata')
        const newData = tx.table<DataRecord>('imageData')

        let lastId: string | undefined
        const CHUNK_SIZE = 25

        while (true) {
          const chunk: ImageRecordV1[] = lastId
            ? await oldImages.where('id').above(lastId).limit(CHUNK_SIZE).toArray()
            : await oldImages.orderBy('id').limit(CHUNK_SIZE).toArray()
          if (chunk.length === 0) break

          await newMetadata.bulkPut(
            chunk.map((record: ImageRecordV1) => ({
              id: record.id,
              metadata: record.metadata,
              createdAt: record.createdAt,
              accessedAt: record.accessedAt,
              sizeBytes: record.sizeBytes,
              source: record.source
            }))
          )
          await newData.bulkPut(
            chunk.map((record: ImageRecordV1) => ({
              id: record.id,
              data: record.data
            }))
          )

          lastId = chunk[chunk.length - 1]?.id
        }
      })
  }
}

/**
 * v1 旧表结构（用于 v1 -> v2 迁移）
 */
interface ImageRecordV1 {
  id: string
  metadata: string
  data: string
  createdAt: number
  accessedAt: number
  sizeBytes: number
  source: 'generated' | 'uploaded'
}

/**
 * 元数据表记录（轻量级）
 */
interface MetadataRecord {
  id: string
  metadata: string          // JSON 序列化的 ImageMetadata
  createdAt: number
  accessedAt: number
  sizeBytes: number
  source: 'generated' | 'uploaded'
}

/**
 * 数据表记录（重量级，按需加载）
 */
interface DataRecord {
  id: string
  data: string              // base64 编码的图像数据
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: ImageStorageConfig = {
  maxCacheSize: 50 * 1024 * 1024,      // 50 MB
  maxAge: 7 * 24 * 60 * 60 * 1000,     // 7 天
  maxCount: 100,                       // 最多 100 张
  autoCleanupThreshold: 0.8            // 达到 80% 时触发清理
}

/**
 * 图像存储服务实现
 *
 * 核心功能：
 * 1. 图像的保存、读取、删除
 * 2. LRU 缓存清理策略
 * 3. 配额强制执行
 * 4. 存储统计信息（仅查询 metadata 表）
 */
export class ImageStorageService implements IImageStorageService {
  private readonly db: ImageDB
  private config: ImageStorageConfig

  constructor(config?: Partial<ImageStorageConfig>) {
    this.db = new ImageDB()
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * 保存图像到存储
   * @param data 完整图像数据
   * @returns 图像 ID
   */
  async saveImage(data: FullImageData): Promise<string> {
    const now = Date.now()

    // 准备元数据记录
    const metadataRecord: MetadataRecord = {
      id: data.metadata.id,
      metadata: JSON.stringify(data.metadata),
      createdAt: data.metadata.createdAt,
      accessedAt: now,  // 更新访问时间
      sizeBytes: data.metadata.sizeBytes,
      source: data.metadata.source
    }

    // 准备数据记录
    const dataRecord: DataRecord = {
      id: data.metadata.id,
      data: data.data
    }

    // 同时保存到两个表（事务确保一致性）
    await this.db.transaction('rw', this.db.imageMetadata, this.db.imageData, async () => {
      await this.db.imageMetadata.put(metadataRecord)
      await this.db.imageData.put(dataRecord)
    })

    // 检查是否需要自动清理
    await this.autoCleanupIfNeeded()

    return data.metadata.id
  }

  /**
   * 获取图像完整数据
   * @param id 图像 ID
   * @returns 完整图像数据，如果不存在则返回 null
   */
  async getImage(id: string): Promise<FullImageData | null> {
    // 同时查询两个表
    const [metadataRecord, dataRecord] = await Promise.all([
      this.db.imageMetadata.get(id),
      this.db.imageData.get(id)
    ])

    if (!metadataRecord || !dataRecord) {
      return null
    }

    // 更新访问时间（LRU）
    await this.db.imageMetadata.update(id, { accessedAt: Date.now() })

    // 反序列化
    return {
      metadata: JSON.parse(metadataRecord.metadata) as ImageMetadata,
      data: dataRecord.data
    }
  }

  /**
   * 获取图像元数据（不含实际图像数据）
   * @param id 图像 ID
   * @returns 图像元数据，如果不存在则返回 null
   */
  async getMetadata(id: string): Promise<ImageMetadata | null> {
    const record = await this.db.imageMetadata.get(id)

    if (!record) {
      return null
    }

    // 更新访问时间
    await this.db.imageMetadata.update(id, { accessedAt: Date.now() })

    return JSON.parse(record.metadata) as ImageMetadata
  }

  /**
   * 删除单个图像
   * @param id 图像 ID
   */
  async deleteImage(id: string): Promise<void> {
    await this.db.transaction('rw', this.db.imageMetadata, this.db.imageData, async () => {
      await this.db.imageMetadata.delete(id)
      await this.db.imageData.delete(id)
    })
  }

  /**
   * 批量删除图像
   * @param ids 图像 ID 数组
   */
  async deleteImages(ids: string[]): Promise<void> {
    await this.db.transaction('rw', this.db.imageMetadata, this.db.imageData, async () => {
      await this.db.imageMetadata.bulkDelete(ids)
      await this.db.imageData.bulkDelete(ids)
    })
  }

  /**
   * 清空所有图像
   */
  async clearAll(): Promise<void> {
    await this.db.transaction('rw', this.db.imageMetadata, this.db.imageData, async () => {
      await this.db.imageMetadata.clear()
      await this.db.imageData.clear()
    })
  }

  /**
   * 清理过期图像（基于 maxAge 配置，使用 accessedAt）
   * @returns 清理的图像数量
   */
  async cleanupOldImages(): Promise<number> {
    const now = Date.now()
    const maxAge = this.config.maxAge!
    const cutoffTime = now - maxAge

    // 查找过期图像（基于 accessedAt，而非 createdAt）
    const expiredImages = await this.db.imageMetadata
      .where('accessedAt')
      .below(cutoffTime)
      .primaryKeys()

    if (expiredImages.length === 0) {
      return 0
    }

    // 删除过期图像（两个表都要删除）
    await this.deleteImages(expiredImages)

    return expiredImages.length
  }

  /**
   * 强制执行配额限制
   * 按优先级删除：
   * 1. 过期图像（超过 maxAge，基于 accessedAt）
   * 2. 超过 maxCount 的部分（删除最旧的）
   * 3. 超过 maxCacheSize 的部分（删除最旧的）
   */
  async enforceQuota(): Promise<void> {
    const maxAge = this.config.maxAge!
    const maxCount = this.config.maxCount!
    const maxCacheSize = this.config.maxCacheSize!
    const now = Date.now()

    // 1. 清理过期图像（基于 accessedAt）
    const cutoffTime = now - maxAge
    const expiredImages = await this.db.imageMetadata
      .where('accessedAt')
      .below(cutoffTime)
      .primaryKeys()

    if (expiredImages.length > 0) {
      await this.deleteImages(expiredImages)
    }

    // 重新获取统计（只查询 metadata 表，性能优化）
    const updatedStats = await this.getStorageStats()

    // 2. 检查数量限制
    if (updatedStats.count > maxCount) {
      const excessCount = updatedStats.count - maxCount
      const oldestImages = await this.getOldestImages(excessCount)
      await this.deleteImages(oldestImages)
    }

    // 3. 检查大小限制
    if (updatedStats.totalBytes > maxCacheSize) {
      // 按最旧优先删除，直到总大小低于 90% 配额
      const targetSize = Math.floor(maxCacheSize * 0.9)
      let currentSize = updatedStats.totalBytes

      while (currentSize > targetSize) {
        const oldestImage = await this.getOldestMetadata()
        if (!oldestImage) break

        await this.deleteImage(oldestImage.id)
        currentSize -= oldestImage.sizeBytes
      }
    }
  }

  /**
   * 获取存储统计信息
   * 仅查询 metadata 表，不读取 base64 数据（性能优化）
   */
  async getStorageStats(): Promise<{
    count: number
    totalBytes: number
    oldestAt: number | null
    newestAt: number | null
  }> {
    // 只查询 metadata 表，避免读取大的 base64 数据
    const allMetadata = await this.db.imageMetadata.toArray()

    if (allMetadata.length === 0) {
      return {
        count: 0,
        totalBytes: 0,
        oldestAt: null,
        newestAt: null
      }
    }

    const count = allMetadata.length
    const totalBytes = allMetadata.reduce((sum, meta) => sum + meta.sizeBytes, 0)
    const oldestAt = Math.min(...allMetadata.map(meta => meta.accessedAt))
    const newestAt = Math.max(...allMetadata.map(meta => meta.accessedAt))

    return {
      count,
      totalBytes,
      oldestAt,
      newestAt
    }
  }

  /**
   * 列出所有图像元数据
   * 仅查询 metadata 表，不读取 base64 数据（性能优化）
   */
  async listAllMetadata(): Promise<ImageMetadata[]> {
    // 只查询 metadata 表
    const allMetadata = await this.db.imageMetadata.toArray()

    return allMetadata.map(record => JSON.parse(record.metadata) as ImageMetadata)
  }

  /**
   * 列出所有图像 ID
   * @returns 图像 ID 数组
   */
  async listAllIds(): Promise<string[]> {
    return await this.db.imageMetadata.toCollection().primaryKeys()
  }

  /**
   * 获取当前配置
   */
  getConfig(): ImageStorageConfig {
    return { ...this.config }
  }

  /**
   * 更新配置
   * @param config 部分配置更新
   */
  async updateConfig(config: Partial<ImageStorageConfig>): Promise<void> {
    this.config = { ...this.config, ...config }

    // 配置更新后立即执行清理
    await this.enforceQuota()
  }

  /**
   * 关闭数据库连接
   */
  async close(): Promise<void> {
    await this.db.close()
  }

  /**
   * 自动清理检查（在保存后调用）
   * 如果达到阈值，触发清理
   */
  private async autoCleanupIfNeeded(): Promise<void> {
    const threshold = this.config.autoCleanupThreshold!
    const maxCacheSize = this.config.maxCacheSize!
    const maxCount = this.config.maxCount!

    const stats = await this.getStorageStats()

    // 检查是否达到任一阈值
    const sizeThreshold = maxCacheSize * threshold
    const countThreshold = maxCount * threshold

    if (
      stats.totalBytes > sizeThreshold ||
      stats.count > countThreshold
    ) {
      await this.enforceQuota()
    }
  }

  /**
   * 获取最旧的 N 张图像 ID（按 accessedAt 排序）
   */
  private async getOldestImages(count: number): Promise<string[]> {
    const images = await this.db.imageMetadata
      .orderBy('accessedAt')
      .limit(count)
      .primaryKeys()

    return images
  }

  /**
   * 获取最旧的一张图像元数据（完整记录）
   */
  private async getOldestMetadata(): Promise<MetadataRecord | null> {
    const images = await this.db.imageMetadata
      .orderBy('accessedAt')
      .limit(1)
      .toArray()

    return images[0] || null
  }
}

/**
 * 创建图像存储服务实例
 */
export function createImageStorageService(
  config?: Partial<ImageStorageConfig>
): ImageStorageService {
  return new ImageStorageService(config)
}
