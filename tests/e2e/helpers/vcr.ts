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

/**
 * LLM API 提供商
 */
type LLMProvider = 'openai' | 'deepseek' | 'anthropic' | 'gemini' | 'zhipu' | 'modelscope'

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
interface VCRFixture {
  testName: string
  testCase: string
  provider: LLMProvider
  url: string
  requestBody: any
  responseBody: any // 解析后的响应（用于调试，实际回放时使用 rawSSE）
  rawSSE: string // 原始 SSE 响应文本（回放时使用）
  recordedAt: string
  duration: number
}

/**
 * E2E VCR 类
 */
class E2EVCR {
  private config: VCRConfig
  private currentTestName: string = ''
  private currentTestCase: string = ''
  private recordingEnabled: boolean = false

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
    return name
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
    return null
  }

  /**
   * 保存 fixture
   */
  async saveFixture(
    provider: LLMProvider,
    url: string,
    requestBody: any,
    responseBody: any,
    duration: number,
    rawSSE: string
  ): Promise<void> {
    if (!this.recordingEnabled) return

    const fixture: VCRFixture = {
      testName: this.currentTestName,
      testCase: this.currentTestCase,
      provider,
      url,
      requestBody,
      responseBody,
      recordedAt: new Date().toISOString(),
      duration,
      rawSSE
    }

    const fixturePath = this.getFixturePath()

    try {
      await fs.mkdir(path.dirname(fixturePath), { recursive: true })
      await fs.writeFile(fixturePath, JSON.stringify(fixture, null, 2), 'utf-8')

      const relativePath = path.relative(process.cwd(), fixturePath)
      console.log(`[VCR] ✅ Fixture saved (${provider}): ${relativePath}`)
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
      console.log(`[VCR] ♻️  Replaying fixture (${fixture.provider}): ${relativePath}`)

      return fixture
    } catch (error) {
      return null
    }
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

            // LLM API 必须返回流式响应（SSE 格式）
            if (!responseBody.includes('data: ')) {
              throw new Error('[VCR] LLM API 返回非流式响应，不支持录制')
            }

            // 解析 SSE 响应，提取完整内容
            const lines = responseBody.split('\n').filter(line => line.trim().startsWith('data: '))
            let fullContent = ''

            for (const line of lines) {
              const jsonStr = line.replace(/^data:\s*/, '').trim()
              if (jsonStr === '[DONE]') continue

              try {
                const chunk = JSON.parse(jsonStr)
                if (chunk.choices && chunk.choices[0] && chunk.choices[0].delta) {
                  fullContent += chunk.choices[0].delta.content || ''
                }
              } catch {
                // 忽略解析错误
              }
            }

            // 构造解析后的响应对象（用于调试）
            const lastChunk = JSON.parse(lines[lines.length - 2].replace(/^data:\s*/, '').trim())
            const responseJson = {
              ...lastChunk,
              choices: [{
                ...lastChunk.choices[0],
                message: {
                  role: 'assistant',
                  content: fullContent
                }
              }]
            }

            await this.saveFixture(
              provider,
              url,
              JSON.parse(requestBody || '{}'),
              responseJson,
              endTime - startTime,
              responseBody
            )

            // 返回真实响应
            await route.fulfill({
              status: response.status(),
              headers: response.headers(),
              body: responseBody
            })
          } else {
            // replay 模式：使用 fixture
            const fixture = await this.loadFixture()

            if (fixture) {
              // 直接返回原始 SSE 文本（格式完全一致）
              await route.fulfill({
                status: 200,
                headers: {
                  'content-type': 'text/event-stream',
                  'cache-control': 'no-cache',
                  'connection': 'keep-alive',
                },
                body: fixture.rawSSE
              })
            } else {
              if (mode === 'replay') {
                // replay 模式：没有 fixture 则失败
                const errorMsg =
                  `[VCR] ❌ Fixture not found for test: ${this.currentTestName} - ${this.currentTestCase}\n` +
                  `Run with E2E_VCR_MODE=record to create it.`

                console.error(errorMsg)
                await route.abort()
              } else {
                // auto 模式：降级到真实 API
                console.log(`[VCR] ⚠️  No fixture, calling real API`)
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
