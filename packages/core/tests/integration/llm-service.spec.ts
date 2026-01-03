import { describe, test, expect, beforeAll } from 'vitest'
import type { Message } from '../../src/services/llm/types'
import { RequestConfigError } from '../../src/services/llm/errors'
import { withVCR } from '../utils/vcr'
import {
  createRealLLMTestContext,
  hasAvailableProvider,
  printAvailableProviders,
  type RealLLMTestContext
} from '../helpers/real-llm'

/**
 * LLM 服务集成测试
 *
 * 测试策略：
 * - 使用 real-llm 工具类自动获取可用的 LLM 提供商
 * - 使用 VCR 录制真实 API 响应
 * - 支持多提供商（根据本地环境变量自动选择）
 * - 验证流式响应处理
 * - 验证错误处理
 *
 * 运行方式：
 * - 默认：使用 VCR 回放已录制的 fixtures
 * - 录制：RUN_REAL_API=1 pnpm test:record（需要配置 API Key）
 * - 真实：RUN_REAL_API=1 pnpm test:real（需要配置 API Key）
 */

const RUN_REAL_API = process.env.RUN_REAL_API === '1' || process.env.ENABLE_REAL_LLM === 'true'

describe('LLM Service Integration', () => {
  let context: RealLLMTestContext | undefined

  beforeAll(async () => {
    // 打印可用提供商信息（便于调试）
    if (RUN_REAL_API) {
      printAvailableProviders()
    }

    // 创建测试上下文
    context = await createRealLLMTestContext()
  })

  describe('Basic functionality', () => {
    test('should have available provider when API keys are configured', () => {
      if (!RUN_REAL_API) {
        console.log('⏭️  Skipping: RUN_REAL_API not enabled')
        return
      }

      if (!hasAvailableProvider()) {
        console.log('⏭️  Skipping: No API keys configured')
        return
      }

      expect(context).toBeDefined()
      expect(context?.llmService).toBeDefined()
      expect(context?.modelManager).toBeDefined()
      expect(context?.modelKey).toBeTruthy()
    })
  })

  describe.skipIf(!RUN_REAL_API || !hasAvailableProvider())('Multi-provider support', () => {
    const testMessage: Message[] = [
      {
        role: 'user',
        content: 'Hello, please respond with just "test successful"'
      }
    ]

    test('Provider works with VCR (non-streaming)', async () => {
      if (!context) {
        console.log('⏭️  No context available, skipping')
        return
      }

      const response = await withVCR(
        'llm-basic-hello',
        {
          provider: context.provider.providerId,
          messages: testMessage,
          stream: false
        },
        async () => {
          return await context!.llmService.sendMessageStructured(
            testMessage,
            context!.modelKey
          )
        }
      )

      expect(response).toBeDefined()
      expect(response.content).toBeTruthy()
      expect(typeof response.content).toBe('string')
      expect(response.content.length).toBeGreaterThan(0)

      console.log(`✅ Response from ${context.provider.providerName}:`, response.content.substring(0, 50))
    }, 30000)

    test('sendMessage (legacy format) works correctly', async () => {
      if (!context) {
        console.log('⏭️  No context available, skipping')
        return
      }

      const response = await withVCR(
        'llm-legacy-format',
        {
          provider: context.provider.providerId,
          messages: testMessage,
          stream: false
        },
        async () => {
          return await context!.llmService.sendMessage(
            testMessage,
            context!.modelKey
          )
        }
      )

      expect(response).toBeTruthy()
      expect(typeof response).toBe('string')
      expect(response.length).toBeGreaterThan(0)
    }, 30000)
  })

  describe.skipIf(!RUN_REAL_API || !hasAvailableProvider())('Streaming response', () => {
    test('Stream tokens are correctly accumulated', async () => {
      if (!context) {
        console.log('⏭️  No context available, skipping')
        return
      }

      const messages: Message[] = [
        {
          role: 'user',
          content: 'Count from 1 to 5, one number per line'
        }
      ]

      let tokens: string[] = []
      let fullContent = ''
      let completeResponse: any = null

      await withVCR(
        'llm-stream-counting',
        {
          provider: context.provider.providerId,
          messages,
          stream: true
        },
        async () => {
          await context!.llmService.sendMessageStream(messages, context!.modelKey, {
            onToken: (token) => {
              tokens.push(token)
              fullContent += token
            },
            onComplete: (response) => {
              completeResponse = response
            },
            onError: (error) => {
              throw error
            }
          })
        }
      )

      expect(tokens.length).toBeGreaterThan(0)
      expect(fullContent).toBeTruthy()

      if (completeResponse) {
        expect(completeResponse.content).toBe(fullContent)
      }

      console.log(`✅ Received ${tokens.length} tokens, total length: ${fullContent.length}`)
    }, 30000)
  })

  describe('Error handling', () => {
    test('Invalid provider throws RequestConfigError', async () => {
      if (!context) {
        console.log('⏭️  No context available, skipping')
        return
      }

      const messages: Message[] = [{ role: 'user', content: 'test' }]

      await expect(async () => {
        await context!.llmService.sendMessageStructured(messages, 'invalid-provider-12345')
      }).rejects.toThrow(RequestConfigError)
    })

    test('Empty messages array throws RequestConfigError', async () => {
      if (!context) {
        console.log('⏭️  No context available, skipping')
        return
      }

      await expect(async () => {
        await context!.llmService.sendMessageStructured([], context!.modelKey)
      }).rejects.toThrow(RequestConfigError)
    })

    test('Invalid message format throws RequestConfigError', async () => {
      if (!context) {
        console.log('⏭️  No context available, skipping')
        return
      }

      const invalidMessages = [
        { role: 'invalid-role', content: 'test' }
      ] as Message[]

      await expect(async () => {
        await context!.llmService.sendMessageStructured(invalidMessages, context!.modelKey)
      }).rejects.toThrow(RequestConfigError)
    })

    test('Message with missing content throws RequestConfigError', async () => {
      if (!context) {
        console.log('⏭️  No context available, skipping')
        return
      }

      const invalidMessages = [
        { role: 'user' } as any
      ]

      await expect(async () => {
        await context!.llmService.sendMessageStructured(invalidMessages, context!.modelKey)
      }).rejects.toThrow(RequestConfigError)
    })
  })

  describe.skipIf(!RUN_REAL_API || !hasAvailableProvider())('Response formatting', () => {
    test('Non-streaming response has correct structure', async () => {
      if (!context) {
        console.log('⏭️  No context available, skipping')
        return
      }

      const messages: Message[] = [{ role: 'user', content: 'Say hello' }]

      const response = await withVCR(
        'llm-response-structure',
        {
          provider: context.provider.providerId,
          messages,
          stream: false
        },
        async () => {
          return await context!.llmService.sendMessageStructured(messages, context!.modelKey)
        }
      )

      // 验证响应结构
      expect(response).toHaveProperty('content')
      expect(response.content).toBeTruthy()

      // 验证基本属性
      expect(typeof response.content).toBe('string')
      expect(response.content.length).toBeGreaterThan(0)

      console.log('✅ Response structure validated')
    }, 30000)
  })

  describe.skipIf(!RUN_REAL_API || !hasAvailableProvider())('Context and conversation', () => {
    test('Multi-turn conversation works correctly', async () => {
      if (!context) {
        console.log('⏭️  No context available, skipping')
        return
      }

      const conversation: Message[] = [
        { role: 'user', content: 'My name is Alice' },
        { role: 'assistant', content: 'Hello Alice! Nice to meet you.' },
        { role: 'user', content: 'What is my name?' }
      ]

      const response = await withVCR(
        'llm-multi-turn-conversation',
        {
          provider: context.provider.providerId,
          messages: conversation,
          stream: false
        },
        async () => {
          return await context!.llmService.sendMessageStructured(conversation, context!.modelKey)
        }
      )

      expect(response.content).toBeTruthy()
      // 验证模型能够记住上下文（回复应包含 "Alice"）
      expect(response.content.toLowerCase()).toContain('alice')

      console.log('✅ Multi-turn conversation validated')
    }, 30000)
  })
})
