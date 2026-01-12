/**
 * 流式响应模拟器
 *
 * 用于模拟 LLM API 的流式响应行为，包括：
 * - 按时序逐个返回 chunks
 * - 模拟网络延迟
 * - 模拟网络抖动
 * - 支持 AsyncGenerator 接口
 *
 * @module tests/utils/stream-simulator
 */

import type { StreamChunk } from './vcr.js'
import { Readable } from 'stream'

/**
 * 流式响应模拟器选项
 */
export interface StreamSimulatorOptions {
  /**
   * 时间缩放因子（加速/减速测试）
   * - 1.0: 正常速度
   * - 0.5: 加速 2 倍
   * - 2.0: 减速 2 倍
   * @default 1.0
   */
  timeScale?: number

  /**
   * 是否添加随机网络抖动（0-1 之间的概率）
   * @default 0
   */
  jitterProbability?: number

  /**
   * 抖动最大延迟（毫秒）
   * @default 100
   */
  jitterMaxDelay?: number
}

/**
 * 流式响应模拟器
 */
export class StreamSimulator {
  private chunks: StreamChunk[]
  private timeScale: number
  private jitterProbability: number
  private jitterMaxDelay: number

  constructor(
    chunks: StreamChunk[],
    options: StreamSimulatorOptions = {}
  ) {
    this.chunks = chunks
    this.timeScale = options.timeScale ?? 1.0
    this.jitterProbability = options.jitterProbability ?? 0
    this.jitterMaxDelay = options.jitterMaxDelay ?? 100
  }

  /**
   * 生成流式响应（AsyncGenerator）
   *
   * @example
   * ```typescript
   * const simulator = new StreamSimulator(chunks)
   * for await (const chunk of simulator.generate()) {
   *   console.log(chunk.content)
   * }
   * ```
   */
  async *generate(): AsyncGenerator<StreamChunk> {
    let lastTimestamp = 0

    for (const chunk of this.chunks) {
      // 计算延迟（考虑时间缩放）
      const delay = (chunk.timestamp - lastTimestamp) * this.timeScale

      if (delay > 0) {
        // 应用延迟
        await this.sleep(delay)

        // 随机添加网络抖动
        if (Math.random() < this.jitterProbability) {
          const jitterDelay = Math.random() * this.jitterMaxDelay
          await this.sleep(jitterDelay)
        }
      }

      yield chunk
      lastTimestamp = chunk.timestamp
    }
  }

  /**
   * 生成回调式流（兼容旧式 API）
   *
   * @example
   * ```typescript
   * const simulator = new StreamSimulator(chunks)
   * simulator.generateCallback((chunk) => {
   *   console.log(chunk.content)
   * })
   * ```
   */
  async generateCallback(
    callback: (chunk: StreamChunk) => void,
    onComplete?: () => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    try {
      for await (const chunk of this.generate()) {
        callback(chunk)
      }
      onComplete?.()
    } catch (error) {
      onError?.(error as Error)
    }
  }

  /**
   * 转换为 ReadableStream（Web Streams API）
   *
   * @example
   * ```typescript
   * const simulator = new StreamSimulator(chunks)
   * const stream = simulator.toReadableStream()
   *
   * const response = new Response(stream)
   * ```
   */
  toReadableStream(): ReadableStream<StreamChunk> {
    return new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of this.generate()) {
            controller.enqueue(chunk)
          }
          controller.close()
        } catch (error) {
          controller.error(error)
        }
      }
    })
  }

  /**
   * 转换为 Node.js Readable stream
   */
  toNodeReadableStream(): NodeJS.ReadableStream {
    const simulatorIterator = this.generate()[Symbol.asyncIterator]()

    return new Readable({
      async read(this: Readable) {
        const { value, done } = await simulatorIterator.next()
        if (done) {
          this.push(null) // EOF
          return
        }

        this.push(JSON.stringify(value) + '\n')
      }
    })
  }

  /**
   * 等待指定毫秒数
   */
  private sleep(ms: number): Promise<void> {
    if (ms <= 0) return Promise.resolve()
    if (ms < 1) return Promise.resolve()
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 获取完整内容（所有 chunks 拼接）
   */
  getFullContent(): string {
    return this.chunks.map(chunk => chunk.content).join('')
  }

  /**
   * 获取总时长
   */
  getTotalDuration(): number {
    if (this.chunks.length === 0) return 0
    return this.chunks[this.chunks.length - 1].timestamp
  }

  /**
   * 获取 chunks 数量
   */
  getChunkCount(): number {
    return this.chunks.length
  }
}

/**
 * 创建流式响应模拟器的便捷函数
 *
 * @example
 * ```typescript
 * const simulator = createStreamSimulator(chunks, { timeScale: 0.5 })
 * for await (const chunk of simulator.generate()) {
 *   console.log(chunk.content)
 * }
 * ```
 */
export function createStreamSimulator(
  chunks: StreamChunk[],
  options?: StreamSimulatorOptions
): StreamSimulator {
  return new StreamSimulator(chunks, options)
}

/**
 * 从 fixture 创建流式模拟器
 *
 * @example
 * ```typescript
 * const simulator = createStreamFromFixture(fixture)
 * for await (const chunk of simulator.generate()) {
 *   console.log(chunk.content)
 * }
 * ```
 */
export function createStreamFromFixture(
  fixture:
    | { response: { type: 'streaming'; chunks?: StreamChunk[] } }
    | { type: 'streaming'; chunks?: StreamChunk[] },
  options?: StreamSimulatorOptions
): StreamSimulator | null {
  const response = 'response' in fixture ? fixture.response : fixture
  if (response.type !== 'streaming' || !response.chunks) return null
  return new StreamSimulator(response.chunks, options)
}

/**
 * 批量测试辅助：验证流式响应的完整性
 *
 * @example
 * ```typescript
 * const isValid = await validateStreamResponse(chunks, 'expected content')
 * if (!isValid) {
 *   console.error('Stream response validation failed')
 * }
 * ```
 */
export async function validateStreamResponse(
  chunks: StreamChunk[],
  expectedContent: string,
  options?: StreamSimulatorOptions
): Promise<boolean> {
  const simulator = new StreamSimulator(chunks, options)
  const actualContent = simulator.getFullContent()

  return actualContent === expectedContent
}

/**
 * 性能测试：测量流式响应的生成速度
 *
 * @example
 * ```typescript
 * const stats = await measureStreamPerformance(chunks)
 * console.log(`Total duration: ${stats.actualDuration}ms`)
 * console.log(`Chunks per second: ${stats.chunksPerSecond}`)
 * ```
 */
export async function measureStreamPerformance(
  chunks: StreamChunk[],
  options?: StreamSimulatorOptions
): Promise<{
  actualDuration: number
  expectedDuration: number
  chunksPerSecond: number
  averageChunkDelay: number
}> {
  const startTime = Date.now()
  const simulator = new StreamSimulator(chunks, options)

  let chunkCount = 0
  for await (const _chunk of simulator.generate()) {
    chunkCount++
  }

  const actualDuration = Date.now() - startTime
  const expectedDuration = simulator.getTotalDuration() * (options?.timeScale ?? 1.0)

  return {
    actualDuration,
    expectedDuration,
    chunksPerSecond: (chunkCount / actualDuration) * 1000,
    averageChunkDelay: actualDuration / chunkCount
  }
}
