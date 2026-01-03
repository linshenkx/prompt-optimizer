/**
 * VCR (Video Cassette Recorder) for LLM API testing
 *
 * 自动化录制-回放系统：
 * - 首次运行：调用真实 LLM API 并保存响应为 fixture
 * - 后续运行：自动回放 fixture（无需真实 API）
 * - 支持流式响应的完整时序模拟
 *
 * @module tests/utils/vcr
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * VCR 模式
 */
export type VCRMode = 'auto' | 'record' | 'replay' | 'off'

/**
 * LLM 请求接口
 */
export interface LLMRequest {
  provider: string
  model: string
  messages: Array<{ role: string; content: string }>
  stream?: boolean
  temperature?: number
  max_tokens?: number
  [key: string]: any
}

/**
 * 流式响应 chunk
 */
export interface StreamChunk {
  content: string
  timestamp: number
  [key: string]: any
}

/**
 * LLM 响应接口
 */
export interface LLMResponse {
  type: 'streaming' | 'single'
  chunks?: StreamChunk[]
  content?: string
  model?: string
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  finish_reason?: string
  [key: string]: any
}

/**
 * Fixture 元数据
 */
export interface FixtureMetadata {
  recordedAt: string
  scenarioName: string
  description?: string
  duration: number
  recordedBy: 'auto' | 'manual'
  tags?: string[]
}

/**
 * 完整 Fixture 文件
 */
export interface Fixture {
  request: LLMRequest
  response: LLMResponse
  metadata: FixtureMetadata
}

/**
 * VCR 配置选项
 */
export interface VCROptions {
  /**
   * Fixtures 存储目录
   * @default packages/core/tests/fixtures
   */
  fixtureDir?: string

  /**
   * VCR 模式
   * - auto: 自动检测（有 fixture 则回放，无则录制）
   * - record: 强制录制（覆盖已有 fixtures）
   * - replay: 强制回放（无 fixture 时失败）
   * - off: 禁用 VCR（始终调用真实 API）
   * @default process.env.VCR_MODE || 'auto'
   */
  mode?: VCRMode

  /**
   * 是否启用真实 LLM（录制模式需要）
   * @default process.env.ENABLE_REAL_LLM === 'true' || process.env.RUN_REAL_API === '1'
   */
  enableRealLLM?: boolean
}

/**
 * VCR 类
 */
export class VCR {
  private fixtureDir: string
  private mode: VCRMode
  private enableRealLLM: boolean

  constructor(options: VCROptions = {}) {
    // 默认 fixtures 目录
    const projectRoot = join(__dirname, '../../../')
    this.fixtureDir = options.fixtureDir || join(projectRoot, 'tests/fixtures')

    // 从环境变量读取模式
    const envMode = process.env.VCR_MODE as VCRMode
    this.mode = options.mode || envMode || 'auto'

    // 是否启用真实 LLM
    const envEnableReal =
      process.env.ENABLE_REAL_LLM === 'true' ||
      process.env.RUN_REAL_API === '1'
    this.enableRealLLM = options.enableRealLLM ?? envEnableReal
  }

  /**
   * 拦截并处理 LLM API 调用
   *
   * @param scenarioName - 场景名称（用于生成 fixture 文件名）
   * @param request - LLM 请求对象
   * @param realFn - 真实 API 调用函数
   * @returns Promise<LLMResponse>
   *
   * @example
   * ```typescript
   * const vcr = new VCR()
   * const response = await vcr.intercept('optimize-simple-prompt', request, () =>
   *   openai.chat.completions.create(request)
   * )
   * ```
   */
  async intercept<T = LLMResponse>(
    scenarioName: string,
    request: LLMRequest,
    realFn: () => Promise<T>
  ): Promise<T> {
    // 模式判断
    if (this.mode === 'off') {
      return realFn()
    }

    const fixturePath = this.getFixturePath(request.provider, scenarioName)

    // Replay 模式：强制回放
    if (this.mode === 'replay') {
      if (!existsSync(fixturePath)) {
        throw new Error(
          `Fixture not found: ${fixturePath}\n` +
          `Run with VCR_MODE=record to create it, or VCR_MODE=auto to auto-record.`
        )
      }
      return this.replayFixture(fixturePath) as T
    }

    // Record 模式：强制录制
    if (this.mode === 'record') {
      return this.recordAndSave(scenarioName, fixturePath, request, realFn)
    }

    // Auto 模式：自动检测
    if (existsSync(fixturePath)) {
      // Fixture 存在：回放
      return this.replayFixture(fixturePath) as T
    } else {
      // Fixture 不存在：录制
      console.log(`[VCR] Recording new fixture: ${scenarioName}`)
      return this.recordAndSave(scenarioName, fixturePath, request, realFn)
    }
  }

  /**
   * 回放 fixture
   */
  private replayFixture(fixturePath: string): LLMResponse {
    const fixture: Fixture = JSON.parse(readFileSync(fixturePath, 'utf-8'))

    // 如果是流式响应，需要模拟延迟
    if (fixture.response.type === 'streaming' && fixture.response.chunks) {
      return this.simulateStreamingResponse(fixture.response)
    }

    return fixture.response
  }

  /**
   * 录制并保存 fixture
   */
  private async recordAndSave<T>(
    scenarioName: string,
    fixturePath: string,
    request: LLMRequest,
    realFn: () => Promise<T>
  ): Promise<T> {
    // 检查是否启用真实 LLM
    if (!this.enableRealLLM) {
      throw new Error(
        `Real LLM is disabled. Cannot record fixture.\n` +
        `Set ENABLE_REAL_LLM=true to enable real API calls.\n` +
        `Or ensure fixture exists: ${fixturePath}`
      )
    }

    const startTime = Date.now()

    // 调用真实 API
    const result = await realFn()

    const duration = Date.now() - startTime

    // 构造 fixture
    const fixture: Fixture = {
      request,
      response: result as any,
      metadata: {
        recordedAt: new Date().toISOString(),
        scenarioName,
        duration,
        recordedBy: 'auto'
      }
    }

    // 确保目录存在
    const dir = dirname(fixturePath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }

    // 保存 fixture
    writeFileSync(fixturePath, JSON.stringify(fixture, null, 2), 'utf-8')
    console.log(`[VCR] Fixture saved: ${fixturePath}`)

    return result
  }

  /**
   * 模拟流式响应（包含延迟）
   */
  private simulateStreamingResponse(response: LLMResponse): LLMResponse {
    // 注意：这里只返回原始数据，实际的延迟模拟应该在调用方实现
    // 可以配合 StreamSimulator 类使用
    return response
  }

  /**
   * 获取 fixture 文件路径
   */
  private getFixturePath(provider: string, scenarioName: string): string {
    return join(this.fixtureDir, 'llm', provider.toLowerCase(), `${scenarioName}.json`)
  }

  /**
   * 删除指定 fixture
   */
  deleteFixture(provider: string, scenarioName: string): boolean {
    const fixturePath = this.getFixturePath(provider, scenarioName)
    if (existsSync(fixturePath)) {
      unlinkSync(fixturePath)
      console.log(`[VCR] Fixture deleted: ${fixturePath}`)
      return true
    }
    return false
  }

  /**
   * 列出所有 fixtures
   */
  listFixtures(provider?: string): string[] {
    const fixturesDir = provider
      ? join(this.fixtureDir, 'llm', provider.toLowerCase())
      : join(this.fixtureDir, 'llm')

    if (!existsSync(fixturesDir)) {
      return []
    }

    const files: string[] = []
    const scanDir = (dir: string) => {
      const entries = readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = join(dir, entry.name)
        if (entry.isDirectory()) {
          scanDir(fullPath)
        } else if (entry.isFile() && entry.name.endsWith('.json')) {
          files.push(fullPath)
        }
      }
    }

    scanDir(fixturesDir)
    return files
  }
}

/**
 * 全局 VCR 实例（单例）
 */
let globalVCR: VCR | null = null

/**
 * 获取全局 VCR 实例
 */
export function getVCR(options?: VCROptions): VCR {
  if (options && Object.keys(options).length > 0) {
    return new VCR(options)
  }

  if (!globalVCR) {
    globalVCR = new VCR()
  }

  return globalVCR
}

/**
 * 便捷函数：使用 VCR 拦截 LLM 调用
 *
 * @example
 * ```typescript
 * const response = await withVCR('optimize-prompt', request, () =>
 *   llmService.optimize(request)
 * )
 * ```
 */
export async function withVCR<T>(
  scenarioName: string,
  request: LLMRequest,
  realFn: () => Promise<T>,
  options?: VCROptions
): Promise<T> {
  const vcr = getVCR(options)
  return vcr.intercept(scenarioName, request, realFn)
}
