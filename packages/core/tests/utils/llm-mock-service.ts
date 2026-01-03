/**
 * LLM Mock 服务
 *
 * 集成 MSW（Mock Service Worker）提供 LLM API mocking：
 * - 拦截真实的 fetch/XMLHttpRequest 调用
 * - 基于 VCR fixtures 返回预录制的响应
 * - 模拟流式响应
 * - 模拟错误场景
 *
 * @module tests/utils/llm-mock-service
 */

import { http, HttpResponse, delay } from 'msw'
import type { HttpHandler } from 'msw'
import { getVCR, type LLMRequest, type LLMResponse } from './vcr.js'
import { createStreamFromFixture } from './stream-simulator.js'
import { createHash } from 'crypto'

/**
 * LLM 提供商配置
 */
interface LLMProviderConfig {
  baseURL: string
  endpoints: {
    chat: string
    completions?: string
  }
  headers?: Record<string, string>
}

/**
 * 支持的 LLM 提供商
 */
const LLM_PROVIDERS: Record<string, LLMProviderConfig> = {
  openai: {
    baseURL: 'https://api.openai.com/v1',
    endpoints: {
      chat: '/chat/completions',
      completions: '/completions'
    }
  },
  deepseek: {
    baseURL: 'https://api.deepseek.com/v1',
    endpoints: {
      chat: '/chat/completions'
    }
  },
  gemini: {
    baseURL: 'https://generativelanguage.googleapis.com/v1beta',
    endpoints: {
      chat: '/models/gemini-pro:generateContent'
    }
  },
  anthropic: {
    baseURL: 'https://api.anthropic.com/v1',
    endpoints: {
      chat: '/messages'
    }
  }
}

/**
 * 错误场景类型
 */
export type ErrorScenario =
  | 'timeout'
  | 'rate_limit'
  | 'network_error'
  | 'server_error_500'
  | 'invalid_api_key'
  | 'insufficient_quota'

/**
 * LLM Mock 服务选项
 */
export interface LLMMockServiceOptions {
  /**
   * 是否使用 VCR fixtures
   * @default true
   */
  useVCR?: boolean

  /**
   * 错误场景模拟（用于测试错误处理）
   */
  errorScenario?: ErrorScenario | null

  /**
   * 基础延迟（毫秒）
   * @default 100
   */
  baseDelay?: number

  /**
   * 是否启用详细日志
   * @default false
   */
  debug?: boolean
}

/**
 * LLM Mock 服务类
 */
export class LLMMockService {
  private options: Required<LLMMockServiceOptions>

  constructor(options: LLMMockServiceOptions = {}) {
    this.options = {
      useVCR: options.useVCR ?? true,
      errorScenario: options.errorScenario ?? null,
      baseDelay: options.baseDelay ?? 100,
      debug: options.debug ?? false
    }
  }

  /**
   * 生成 MSW handlers
   */
  getHandlers(): HttpHandler[] {
    const handlers: HttpHandler[] = []

    // 为每个提供商生成 handlers
    for (const [provider, config] of Object.entries(LLM_PROVIDERS)) {
      handlers.push(...this.createProviderHandlers(provider, config))
    }

    return handlers
  }

  /**
   * 为特定提供商创建 handlers
   */
  private createProviderHandlers(provider: string, config: LLMProviderConfig): HttpHandler[] {
    const handlers: HttpHandler[] = []

    // Chat completions endpoint
    handlers.push(
      http.post(`${config.baseURL}${config.endpoints.chat}`, async ({ request }) => {
        this.log(`[LLM Mock] Intercepted ${provider} chat request`)

        // 错误场景模拟
        if (this.options.errorScenario) {
          return this.simulateError(this.options.errorScenario)
        }

        // 解析请求（提供商原始格式）
        const rawBody = await request.json()
        const normalizedRequest = this.normalizeRequest(provider, rawBody)
        const wantsStream = Boolean((rawBody as any)?.stream ?? normalizedRequest.stream)

        // 尝试从 VCR 获取响应
        if (this.options.useVCR) {
          try {
            const scenarioName = this.deriveScenarioName(normalizedRequest)
            const vcr = getVCR()
            const fixture = await vcr.intercept(scenarioName, normalizedRequest, async () => {
              // 如果没有 fixture，返回默认 mock 响应
              return this.getDefaultMockResponse(provider, normalizedRequest)
            })

            // 模拟延迟
            await delay(this.options.baseDelay)

            // 如果是流式响应，返回 SSE 格式
            if (wantsStream) {
              return this.createStreamingResponse(fixture as unknown as LLMResponse)
            }

            // 否则返回 JSON
            return HttpResponse.json(this.transformToAPIFormat(provider, fixture as unknown as LLMResponse))
          } catch (error) {
            this.log(`[LLM Mock] VCR error: ${(error as Error).message}`)
            if (process.env.VCR_MODE === 'replay') {
              throw error
            }
            // 降级到默认 mock
            return HttpResponse.json(
              this.transformToAPIFormat(provider, this.getDefaultMockResponse(provider, normalizedRequest))
            )
          }
        }

        // 不使用 VCR，直接返回默认 mock
        await delay(this.options.baseDelay)
        return HttpResponse.json(
          this.transformToAPIFormat(provider, this.getDefaultMockResponse(provider, normalizedRequest))
        )
      })
    )

    return handlers
  }

  /**
   * 从请求推导场景名称
   */
  private deriveScenarioName(request: LLMRequest): string {
    const userMessage = request.messages.find(m => m.role === 'user')
    const contentPreview = userMessage?.content.slice(0, 30) || ''

    const readable =
      contentPreview
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'req'

    const hashPayload = JSON.stringify({
      provider: request.provider,
      model: request.model,
      stream: request.stream ?? false,
      temperature: request.temperature,
      max_tokens: request.max_tokens,
      messages: request.messages
    })
    const hash = createHash('sha1').update(hashPayload).digest('hex').slice(0, 12)
    return `${readable}-${hash}`
  }

  /**
   * 将提供商 API 请求归一化为内部 LLMRequest（用于 fixture key 和默认 mock）
   */
  private normalizeRequest(provider: string, raw: unknown): LLMRequest {
    const base: LLMRequest = {
      provider,
      model: 'unknown',
      messages: []
    }

    if (!raw || typeof raw !== 'object') return base

    const body = raw as Record<string, any>

    // OpenAI / DeepSeek / Anthropic（messages: {role, content}[]）
    if (Array.isArray(body.messages)) {
      base.model = typeof body.model === 'string' ? body.model : base.model
      base.stream = Boolean(body.stream)
      base.temperature = typeof body.temperature === 'number' ? body.temperature : undefined
      base.max_tokens = typeof body.max_tokens === 'number' ? body.max_tokens : undefined
      base.messages = body.messages
        .filter((m: any) => m && typeof m === 'object' && typeof m.role === 'string')
        .map((m: any) => ({
          role: m.role,
          content:
            typeof m.content === 'string'
              ? m.content
              : Array.isArray(m.content)
                ? m.content.map((c: any) => c?.text ?? '').join('')
                : ''
        }))
      return base
    }

    // Gemini（contents: [{parts:[{text}]}]）
    if (provider === 'gemini' && Array.isArray(body.contents)) {
      base.model = typeof body.model === 'string' ? body.model : base.model
      base.stream = Boolean(body.stream)
      base.messages = body.contents
        .map((c: any) => {
          const parts = Array.isArray(c?.parts) ? c.parts : []
          const text = parts.map((p: any) => p?.text ?? '').join('')
          return { role: c?.role ?? 'user', content: text }
        })
        .filter((m: any) => typeof m.content === 'string')
      return base
    }

    return base
  }

  /**
   * 获取默认 mock 响应
   */
  private getDefaultMockResponse(provider: string, request: LLMRequest): LLMResponse {
    const userMessage = request.messages.find(m => m.role === 'user')

    return {
      type: 'single',
      content: `[Mock Response] 基于 "${userMessage?.content}" 的优化结果。这是一个模拟响应，用于测试目的。`,
      model: request.model,
      usage: {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30
      },
      finish_reason: 'stop'
    }
  }

  /**
   * 转换为 API 特定格式
   */
  private transformToAPIFormat(provider: string, response: LLMResponse): any {
    const content = response.content ?? (response as any).finalResult?.content ?? ''
    const model = response.model ?? (response as any).finalResult?.model
    const usage = response.usage ?? (response as any).finalResult?.usage
    const finishReason = response.finish_reason ?? (response as any).finalResult?.finish_reason ?? 'stop'

    // OpenAI 格式
    if (provider === 'openai' || provider === 'deepseek') {
      return {
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content
            },
            finish_reason: finishReason
          }
        ],
        usage
      }
    }

    // Gemini 格式
    if (provider === 'gemini') {
      return {
        candidates: [
          {
            content: {
              parts: [{ text: content }]
            },
            finishReason: finishReason.toUpperCase()
          }
        ],
        usageMetadata: usage
      }
    }

    // Anthropic 格式（最小实现）
    if (provider === 'anthropic') {
      return {
        id: `msg_${Date.now()}`,
        type: 'message',
        role: 'assistant',
        model,
        content: [{ type: 'text', text: content }],
        stop_reason: finishReason,
        usage
      }
    }

    // 默认使用 OpenAI 格式
    return response
  }

  /**
   * 创建流式响应（SSE 格式）
   */
  private createStreamingResponse(fixture: LLMResponse): Response {
    const content = fixture.content ?? (fixture as any).finalResult?.content ?? ''
    const model = fixture.model ?? (fixture as any).finalResult?.model

    // 使用 StreamSimulator 生成流；非流式 fixture 则退化为单 chunk
    const simulator =
      createStreamFromFixture(fixture, { timeScale: 0.1 }) ||
      createStreamFromFixture(
        { type: 'streaming', chunks: [{ content, timestamp: 0 }] },
        { timeScale: 0.1 }
      )!

    // 创建 SSE 流
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()

        try {
          for await (const chunk of simulator.generate()) {
            // SSE 格式
            const sseData = JSON.stringify({
              id: `chatcmpl-${Date.now()}`,
              object: 'chat.completion.chunk',
              created: Math.floor(Date.now() / 1000),
              model,
              choices: [
                {
                  index: 0,
                  delta: { content: chunk.content },
                  finish_reason: null
                }
              ]
            })

            controller.enqueue(encoder.encode(`data: ${sseData}\n\n`))
          }

          // 发送结束 chunk
          const endChunk = JSON.stringify({
            choices: [{ finish_reason: 'stop' }]
          })
          controller.enqueue(encoder.encode(`data: ${endChunk}\n\n`))
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))

          controller.close()
        } catch (error) {
          controller.error(error)
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    })
  }

  /**
   * 模拟错误场景
   */
  private simulateError(scenario: ErrorScenario): Response {
    this.log(`[LLM Mock] Simulating error: ${scenario}`)

    switch (scenario) {
      case 'timeout':
        // 不返回响应，让请求超时
        return new Response(null, { status: 408 })

      case 'rate_limit':
        return HttpResponse.json(
          {
            error: {
              message: 'Rate limit exceeded. Please try again later.',
              type: 'rate_limit_error',
              code: 'rate_limit_exceeded'
            }
          },
          { status: 429 }
        )

      case 'network_error':
        return HttpResponse.error()

      case 'server_error_500':
        return HttpResponse.json(
          {
            error: {
              message: 'Internal server error',
              type: 'server_error',
              code: 'internal_error'
            }
          },
          { status: 500 }
        )

      case 'invalid_api_key':
        return HttpResponse.json(
          {
            error: {
              message: 'Invalid API key provided',
              type: 'invalid_request_error',
              code: 'invalid_api_key'
            }
          },
          { status: 401 }
        )

      case 'insufficient_quota':
        return HttpResponse.json(
          {
            error: {
              message: 'Insufficient quota',
              type: 'insufficient_quota',
              code: 'insufficient_quota'
            }
          },
          { status: 429 }
        )

      default:
        return HttpResponse.json(
          { error: { message: 'Unknown error' } },
          { status: 500 }
        )
    }
  }

  /**
   * 日志输出
   */
  private log(message: string): void {
    if (this.options.debug) {
      console.log(message)
    }
  }
}

/**
 * 创建 LLM Mock 服务实例（便捷函数）
 *
 * @example
 * ```typescript
 * // Vitest
 * const llmMock = createLLMMockService({ debug: true })
 * const server = setupServer(...llmMock.getHandlers())
 *
 * beforeAll(() => server.listen())
 * afterEach(() => server.resetHandlers())
 * afterAll(() => server.close())
 * ```
 */
export function createLLMMockService(options?: LLMMockServiceOptions): LLMMockService {
  return new LLMMockService(options)
}

/**
 * 预定义的 handlers（可直接用于 MSW）
 *
 * @example
 * ```typescript
 * import { llmHandlers } from './tests/utils/llm-mock-service'
 *
 * const server = setupServer(...llmHandlers)
 * ```
 */
export const llmHandlers = createLLMMockService().getHandlers()

/**
 * 测试工具：启用特定错误场景
 *
 * @example
 * ```typescript
 * const { cleanup } = withLLMErrorScenario('rate_limit')
 * // ... 执行测试
 * cleanup()
 * ```
 */
export function withLLMErrorScenario(scenario: ErrorScenario): {
  service: LLMMockService
  cleanup: () => void
} {
  const service = new LLMMockService({ errorScenario: scenario })

  return {
    service,
    cleanup: () => {
      // 清理逻辑（如果需要）
    }
  }
}
