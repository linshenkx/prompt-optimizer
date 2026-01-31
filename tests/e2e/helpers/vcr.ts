/**
 * E2E 测试 VCR (Video Cassette Recorder)
 *
 * 为 E2E 测试提供 LLM API 请求的录制和回放功能
 *
 * 工作原理：
 * - 拦截真实的 LLM API 请求（OpenAI, DeepSeek 等）
 * - 首次运行：调用真实 API 并保存响应为 fixture
 * - 后续运行：直接回放 fixture，无需真实 API 调用
 *
 * @module tests/e2e/helpers/vcr
 */

import { type Page, type Route } from '@playwright/test'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as crypto from 'crypto'

/**
 * LLM API 提供商
 */
type LLMProvider = 'openai' | 'deepseek' | 'anthropic' | 'gemini' | 'zhipu' | 'modelscope' | 'siliconflow'

/**
 * VCR 模式
 */
export type VCRMode = 'auto' | 'record' | 'replay' | 'live'

/**
 * VCR 配置
 */
interface VCRConfig {
  mode: VCRMode
  fixtureDir: string
}

/**
 * VCR Fixture
 */
interface VCRInteraction {
  provider: LLMProvider
  url: string
  method: string
  requestBody: any
  requestHash: string

  /** Raw response body as UTF-8 text (SSE or JSON). */
  rawBody: string

  /** Response headers captured at record time (subset). */
  responseHeaders: Record<string, string>

  /**
   * Parsed response body (for debugging only).
   * For SSE responses this is the reconstructed final JSON.
   */
  responseBody: any

  duration: number
  status: number
}

interface VCRFixture {
  testName: string
  testCase: string

  /**
   * 支持同一个测试用例内的多次 LLM 请求。
   * 录制时追加 interactions，回放时基于 requestHash 匹配并消费对应条目。
   */
  interactions: VCRInteraction[]

  // --- legacy fields for backward compatibility (single interaction) ---
  provider?: LLMProvider
  url?: string
  requestBody?: any
  responseBody?: any
  rawSSE?: string // legacy only
  duration?: number
}

/**
 * E2E VCR 类
 */
class E2EVCR {
  private config: VCRConfig
  private currentTestName: string = ''
  private currentTestCase: string = ''
  private recordingEnabled: boolean = false

  // Replay-only: per testCase, track how many interactions have been consumed per requestHash.
  private replayConsumedByHash: Map<string, number> = new Map()

  constructor(config: VCRConfig) {
    this.config = config
  }

  /**
   * 设置当前测试上下文
   */
  async setTestContext(testName: string, testCase: string) {
    this.currentTestName = testName
    this.currentTestCase = testCase
    this.recordingEnabled = await this.shouldRecord()
    this.replayConsumedByHash = new Map()

    // In explicit record mode, always start from a clean fixture file to avoid mixing old interactions.
    if (this.config.mode === 'record') {
      try {
        await fs.rm(this.getFixturePath(), { force: true })
      } catch {
        // ignore
      }
    }

    const modeSymbol = this.getModeSymbol()
    console.log(`[VCR] ${modeSymbol} Test: ${testName} - ${testCase}`)
  }

  /**
   * 获取模式符号
   */
  private getModeSymbol(): string {
    const { mode } = this.config
    if (mode === 'live') return '🔴 Live'
    if (mode === 'record') return '🎬 Record'
    if (mode === 'replay') return '♻️  Replay'
    if (this.recordingEnabled) return '🎬 Auto-Record'
    return '♻️  Auto-Replay'
  }

  /**
   * 判断是否应该录制
   */
  private async shouldRecord(): Promise<boolean> {
    const { mode } = this.config
    if (mode === 'live') return false
    if (mode === 'record') return true
    if (mode === 'replay') return false

    // auto 模式：检查 fixture 是否存在
    return !(await this.fixtureExists())
  }

  /**
   * 检查 fixture 是否存在
   */
  private async fixtureExists(): Promise<boolean> {
    const fixturePath = this.getFixturePath()
    try {
      await fs.access(fixturePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * 获取 fixture 路径
   */
  private getFixturePath(): string {
    const sanitizedTestName = this.sanitizeFilename(this.currentTestName)
    const sanitizedTestCase = this.sanitizeFilename(this.currentTestCase)
    return path.join(
      this.config.fixtureDir,
      sanitizedTestName,
      `${sanitizedTestCase}.json`
    )
  }

  /**
   * 清理文件名（保留中文、字母、数字）
   */
  private sanitizeFilename(name: string): string {
    // Windows 路径会包含反斜杠，正则字符类里会把 "\\" 当作普通字符保留
    // 这会导致 fixture 目录名与预期不一致（例如 optimize\pro-multi.spec.ts）。
    // 先统一将路径分隔符替换为 '-' 再进行过滤。
    return name
      .replace(/\\/g, '-')
      .replace(/[^\u4e00-\u9fa5a-z0-9]/gi, '-') // 保留中文、字母、数字
      .replace(/-+/g, '-') // 合并多个连字符
      .replace(/^-|-$/g, '') // 移除首尾连字符
      .toLowerCase()
  }

  /**
   * 识别 LLM 提供商
   */
  private identifyProvider(url: string): LLMProvider | null {
    if (url.includes('api.openai.com')) return 'openai'
    if (url.includes('api.deepseek.com')) return 'deepseek'
    if (url.includes('api.anthropic.com')) return 'anthropic'
    if (url.includes('generativelanguage.googleapis.com')) return 'gemini'
    if (url.includes('open.bigmodel.cn')) return 'zhipu'
    if (url.includes('modelscope.cn')) return 'modelscope'
    if (url.includes('api.siliconflow.cn')) return 'siliconflow'
    return null
  }

  /**
   * 保存 fixture
   */
  private stableStringify(value: any): string {
    if (value === null || value === undefined) return String(value)

    if (Array.isArray(value)) {
      return `[${value.map((v) => this.stableStringify(v)).join(',')}]`
    }

    if (typeof value === 'object') {
      const keys = Object.keys(value).sort()
      const entries = keys.map((k) => `${JSON.stringify(k)}:${this.stableStringify((value as any)[k])}`)
      return `{${entries.join(',')}}`
    }

    return JSON.stringify(value)
  }

  private computeRequestHash(provider: LLMProvider, url: string, method: string, requestBody: any): string {
    // Normalize url: for some providers, query params (e.g. cache busters) should not affect matching.
    const normalizedUrl = url.split('?')[0]

    // Image2Image requests can embed huge base64 strings; avoid hashing raw bytes.
    // The hash only needs to distinguish interactions within a test run.
    const normalizedBody = (() => {
      if (!requestBody || typeof requestBody !== 'object') return requestBody
      const cloned = JSON.parse(JSON.stringify(requestBody))
      const b64 = cloned?.inputImage?.b64
      if (typeof b64 === 'string' && b64.length > 0) {
        cloned.inputImage.b64 = `__b64_len_${b64.length}__`
      }
      return cloned
    })()

    const payload = `${provider}|${method}|${normalizedUrl}|${this.stableStringify(normalizedBody)}`
    return crypto.createHash('sha256').update(payload).digest('hex')
  }

  private normalizeFixture(fixture: VCRFixture | null): VCRFixture {
    if (fixture && Array.isArray((fixture as any).interactions)) {
      // Backward compat: older multi-interaction fixtures stored rawSSE.
      const interactions = (fixture as any).interactions as any[]
      for (const it of interactions) {
        if (typeof it.rawBody === 'undefined' && typeof it.rawSSE !== 'undefined') {
          it.rawBody = it.rawSSE
          it.responseHeaders = it.responseHeaders || { 'content-type': 'text/event-stream' }
          delete it.rawSSE
        }
      }
      return fixture
    }

    // Legacy single-interaction fixtures: normalize into interactions[].
    if (fixture && (fixture as any).rawSSE) {
      const legacyProvider = (fixture as any).provider as LLMProvider
      const legacyUrl = (fixture as any).url as string
      const legacyRequestBody = (fixture as any).requestBody
      const legacyMethod = 'POST'
      const legacyRequestHash = this.computeRequestHash(legacyProvider, legacyUrl, legacyMethod, legacyRequestBody)

      const rawBody = String((fixture as any).rawSSE || '')

      return {
        testName: fixture.testName,
        testCase: fixture.testCase,
        interactions: [
          {
            provider: legacyProvider,
            url: legacyUrl,
            method: legacyMethod,
            requestBody: legacyRequestBody,
            requestHash: legacyRequestHash,
            rawBody,
            responseHeaders: { 'content-type': 'text/event-stream' },
            responseBody: (fixture as any).responseBody,
            duration: Number((fixture as any).duration ?? 0),
            status: 200,
          },
        ],
      }
    }

    return {
      testName: this.currentTestName,
      testCase: this.currentTestCase,
      interactions: [],
    }
  }

  private async writeFixture(fixture: VCRFixture): Promise<void> {
    const fixturePath = this.getFixturePath()

    await fs.mkdir(path.dirname(fixturePath), { recursive: true })
    await fs.writeFile(fixturePath, JSON.stringify(fixture, null, 2), 'utf-8')

    const relativePath = path.relative(process.cwd(), fixturePath)
    console.log(`[VCR] ✅ Fixture saved: ${relativePath}`)
  }

  async saveFixture(
    provider: LLMProvider,
    url: string,
    requestBody: any,
    responseBody: any,
    duration: number,
    rawBody: string,
    responseHeaders: Record<string, string>,
    method: string,
    status: number
  ): Promise<void> {
    if (!this.recordingEnabled) return

    const requestHash = this.computeRequestHash(provider, url, method, requestBody)

    const existing = this.normalizeFixture(await this.loadFixture())
    const fixture: VCRFixture = {
      testName: existing.testName || this.currentTestName,
      testCase: existing.testCase || this.currentTestCase,
      interactions: [...existing.interactions],
    }

    const sanitizedBody = (() => {
      try {
        // Keep the fixture small: drop huge base64 payloads.
        if (requestBody && typeof requestBody === 'object') {
          const cloned = JSON.parse(JSON.stringify(requestBody))
          const b64 = cloned?.inputImage?.b64
          if (typeof b64 === 'string' && b64.length > 0) {
            cloned.inputImage.b64 = `__b64_len_${b64.length}__`
          }
          return cloned
        }
      } catch {
        // ignore
      }
      return requestBody
    })()

    fixture.interactions.push({
      provider,
      url,
      method,
      requestBody: sanitizedBody,
      requestHash,
      rawBody,
      responseHeaders,
      responseBody,
      duration,
      status,
    })

    try {
      await this.writeFixture(fixture)
    } catch (error) {
      console.error(`[VCR] ❌ Failed to save fixture:`, error)
    }
  }

  /**
   * 加载 fixture
   */
  async loadFixture(): Promise<VCRFixture | null> {
    const fixturePath = this.getFixturePath()

    try {
      const content = await fs.readFile(fixturePath, 'utf-8')
      const fixture: VCRFixture = JSON.parse(content)

      const relativePath = path.relative(process.cwd(), fixturePath)
      const count = Array.isArray((fixture as any).interactions) ? (fixture as any).interactions.length : 1
      console.log(`[VCR] ♻️  Replaying fixture (${count} interaction(s)): ${relativePath}`)

      return fixture
    } catch {
      return null
    }
  }

  private async loadFixtureNormalized(): Promise<VCRFixture> {
    const raw = await this.loadFixture()
    return this.normalizeFixture(raw)
  }

  private findReplayInteraction(fixture: VCRFixture, requestHash: string): VCRInteraction | null {
    const consumedCount = this.replayConsumedByHash.get(requestHash) ?? 0
    const candidates = fixture.interactions.filter((it) => it.requestHash === requestHash)
    const matched = candidates[consumedCount] ?? null
    if (!matched) return null

    this.replayConsumedByHash.set(requestHash, consumedCount + 1)
    return matched
  }

  /**
   * 设置路由拦截
   */
  async setupRoutes(page: Page) {
    const { mode } = this.config

    // live 模式：不拦截
    if (mode === 'live') {
      return
    }

    // 拦截所有 LLM API 提供商的请求
    const apiPatterns = [
      /https:\/\/api\.openai\.com\/.*/,
      /https:\/\/api\.deepseek\.com\/.*/,
      /https:\/\/api\.anthropic\.com\/.*/,
      /https:\/\/generativelanguage\.googleapis\.com\/.*/,
      /https:\/\/open\.bigmodel\.cn\/.*/,
      /https:\/\/.*\.modelscope\.cn\/.*/,
      /https:\/\/api\.siliconflow\.cn\/.*/,
    ]

    for (const pattern of apiPatterns) {
      await page.route(pattern, async (route: Route) => {
        const request = route.request()
        const url = request.url()
        const method = request.method()

        // 只拦截 POST 请求
        if (method !== 'POST') {
          await route.continue()
          return
        }

        const provider = this.identifyProvider(url)
        if (!provider) {
          await route.continue()
          return
        }

        try {
          const requestBody = await request.postData()

          if (this.recordingEnabled) {
            // record 模式：调用真实 API 并保存
            const startTime = Date.now()
            const response = await route.fetch()
            const endTime = Date.now()

            const responseBody = await response.text()

            // 录制时如果返回 4xx/5xx，直接跳过保存 fixture，避免把错误响应录进去
            if (response.status() >= 400) {
              const headers = { ...response.headers() }
              // route.fetch() 已经解码了 body；若保留 content-encoding/content-length 等头会导致浏览器二次解码/长度不匹配
              delete (headers as any)['content-encoding']
              delete (headers as any)['content-length']
              delete (headers as any)['transfer-encoding']

              await route.fulfill({
                status: response.status(),
                headers: {
                  ...headers,
                  'access-control-allow-origin': '*',
                  'access-control-allow-headers': '*',
                },
                body: responseBody
              })
              return
            }

            // 图像生成等非 SSE：直接按原始响应回放（避免强行合成 SSE 破坏语义）
            const contentType = response.headers()['content-type'] || ''
            const isImageResponse = /\bimage\//i.test(contentType)
            const isSSE = /\btext\/event-stream\b/i.test(contentType)

            if (!isSSE && (isImageResponse || /\/images\//i.test(url))) {
              await this.saveFixture(
                provider,
                url,
                JSON.parse(requestBody || '{}'),
                null,
                endTime - startTime,
                responseBody,
                { 'content-type': contentType || 'application/octet-stream' },
                method,
                response.status()
              )

              const headers = { ...response.headers() }
              delete (headers as any)['content-encoding']
              delete (headers as any)['content-length']
              delete (headers as any)['transfer-encoding']

              await route.fulfill({
                status: response.status(),
                headers: {
                  ...headers,
                  'access-control-allow-origin': '*',
                  'access-control-allow-headers': '*',
                },
                body: responseBody
              })
              return
            }

            const hasSSE = /(^|\n)\s*data:\s*/.test(responseBody)

            let rawSSE = responseBody
            let responseJson: any = null

            if (hasSSE) {
              // 解析 SSE 响应，提取完整内容（OpenAI 兼容格式）
              const lines = responseBody
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.startsWith('data:'))

              let fullContent = ''
              let lastChunk: any = null

              for (const line of lines) {
                const jsonStr = line.replace(/^data:\s*/, '').trim()
                if (!jsonStr || jsonStr === '[DONE]') continue

                try {
                  const chunk = JSON.parse(jsonStr)
                  lastChunk = chunk
                  if (chunk.choices && chunk.choices[0] && chunk.choices[0].delta) {
                    fullContent += chunk.choices[0].delta.content || ''
                  }
                } catch {
                  // 忽略解析错误
                }
              }

              if (lastChunk) {
                responseJson = {
                  ...lastChunk,
                  choices: [{
                    ...lastChunk.choices?.[0],
                    message: {
                      role: 'assistant',
                      content: fullContent
                    }
                  }]
                }
              }
            } else {
              // 非 SSE 响应：尝试解析为 JSON，并合成一份可回放的 SSE
              // 目的：让回放模式不依赖真实 API 的流式实现细节
              try {
                const parsed = JSON.parse(responseBody)
                responseJson = parsed

                const content =
                  parsed?.choices?.[0]?.message?.content ??
                  parsed?.choices?.[0]?.delta?.content ??
                  parsed?.content ??
                  ''

                const created = parsed?.created ?? Math.floor(Date.now() / 1000)
                const id = parsed?.id ?? `vcr_${created}`
                const model = parsed?.model ?? 'unknown'

                const baseChunk = {
                  id,
                  object: 'chat.completion.chunk',
                  created,
                  model,
                  choices: [{
                    index: 0,
                    delta: { role: 'assistant', content: '' },
                    logprobs: null,
                    finish_reason: null,
                  }]
                }

                const contentChunk = {
                  id,
                  object: 'chat.completion.chunk',
                  created,
                  model,
                  choices: [{
                    index: 0,
                    delta: { content: String(content) },
                    logprobs: null,
                    finish_reason: null,
                  }]
                }

                const endChunk = {
                  id,
                  object: 'chat.completion.chunk',
                  created,
                  model,
                  choices: [{
                    index: 0,
                    delta: {},
                    logprobs: null,
                    finish_reason: 'stop',
                  }]
                }

                rawSSE =
                  `data: ${JSON.stringify(baseChunk)}\n\n` +
                  `data: ${JSON.stringify(contentChunk)}\n\n` +
                  `data: ${JSON.stringify(endChunk)}\n\n` +
                  `data: [DONE]\n\n`
              } catch {
                throw new Error('[VCR] LLM API 返回非流式响应，且无法解析为 JSON')
              }
            }

            await this.saveFixture(
              provider,
              url,
              JSON.parse(requestBody || '{}'),
              responseJson,
              endTime - startTime,
              rawSSE,
              {
                'content-type': hasSSE ? 'text/event-stream' : (response.headers()['content-type'] || 'application/json'),
              },
              method,
              response.status()
            )

            // 返回真实响应（补齐 CORS，避免浏览器端 fetch 被拦）
            const headers = { ...response.headers() }
            // route.fetch() 已经解码了 body；若保留 content-encoding/content-length 等头会导致浏览器二次解码/长度不匹配
            delete (headers as any)['content-encoding']
            delete (headers as any)['content-length']
            delete (headers as any)['transfer-encoding']

            // 对于 stream=true 的请求，确保 content-type 为 SSE
            if (hasSSE) {
              headers['content-type'] = 'text/event-stream'
            }

            await route.fulfill({
              status: response.status(),
              headers: {
                ...headers,
                'access-control-allow-origin': '*',
                'access-control-allow-headers': '*',
              },
              body: responseBody
            })
          } else {
            // replay 模式：使用 fixture（支持同一个测试内多次请求，通过 requestHash 精准匹配）
            const fixture = await this.loadFixtureNormalized()
            const parsedRequestBody = JSON.parse(requestBody || '{}')
            const requestHash = this.computeRequestHash(provider, url, method, parsedRequestBody)
            const interaction = this.findReplayInteraction(fixture, requestHash)

            if (interaction) {
              // 直接返回原始 SSE 文本（格式完全一致）
              const contentType = interaction.responseHeaders?.['content-type'] || 'application/json'
              const isSSE = /text\/event-stream/i.test(contentType)

              await route.fulfill({
                status: interaction.status || 200,
                headers: {
                  'content-type': contentType,
                  ...(isSSE
                    ? {
                        'cache-control': 'no-cache',
                        'connection': 'keep-alive',
                      }
                    : {}),
                  // 关键：避免浏览器端 fetch 因 CORS 直接失败
                  'access-control-allow-origin': '*',
                  'access-control-allow-headers': '*',
                },
                body: interaction.rawBody || ''
              })
            } else {
              if (mode === 'replay') {
                // replay 模式：没有 fixture 则失败
                const errorMsg =
                  `[VCR] ❌ Fixture not found for test: ${this.currentTestName} - ${this.currentTestCase}\n` +
                  `Request hash: ${requestHash} (${provider} ${method} ${url.split('?')[0]})\n` +
                  `Run with E2E_VCR_MODE=record to create it.`

                console.error(errorMsg)
                await route.abort()
              } else {
                // auto 模式：降级到真实 API
                console.log(
                  `[VCR] ⚠️  No fixture for requestHash=${requestHash} (${provider} ${method} ${url.split('?')[0]}), calling real API`,
                )
                await route.continue()
              }
            }
          }
        } catch (error) {
          console.error(`[VCR] Error:`, error)
          await route.continue()
        }
      })
    }
  }
}

/**
 * 获取 VCR 实例（每次调用创建新实例，支持并行测试）
 */
export function getVCR(): E2EVCR {
  const mode = (process.env.E2E_VCR_MODE as VCRMode) || 'auto'
  const fixtureDir = process.env.E2E_VCR_FIXTURE_DIR || 'tests/e2e/fixtures/vcr'

  return new E2EVCR({ mode, fixtureDir })
}

/**
 * 为测试设置 VCR
 */
export async function setupVCRForTest(page: Page, testName: string, testCase: string) {
  const vcr = getVCR()
  await vcr.setTestContext(testName, testCase)
  await vcr.setupRoutes(page)
}
