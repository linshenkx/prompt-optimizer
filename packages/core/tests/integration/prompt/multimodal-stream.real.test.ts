import { describe, it, expect } from 'vitest'
import { PromptService } from '../../../src/services/prompt/service'
import { createImageUnderstandingService } from '../../../src/services/image-understanding/service'
import { TextAdapterRegistry } from '../../../src/services/llm/adapters/registry'
import { DashScopeAdapter } from '../../../src/services/llm/adapters/dashscope-adapter'
import { GeminiAdapter } from '../../../src/services/llm/adapters/gemini-adapter'
import type { TextModelConfig } from '../../../src/services/model/types'
import type { OptimizationRequest } from '../../../src/services/prompt/types'
import type { LLMResponse } from '../../../src/services/llm/types'

const RUN_REAL_API = process.env.RUN_REAL_API === '1'

const RED_SQUARE_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAHFSURBVHhe7dKxCYBQAMRQx/n7z+Mu2ttKIHB5cM3VuZ5Mu75HthTAuAIYVwDjCmBcAYwrgHEFMK4AxhXAuAIYVwDjCmBcAYwrgHEFMK4AxhXAuAIYVwDjCmBcAYwrgHF4APc57cdoBSAfrQDkoxWAfLQCkI9WAPLRCkA+WgHIRysA+WgFIB+tAOSjFYB8tAKQj1YA8tEKQD5aAchHKwD5aAUgH60A5KMVgHy0ApCPVgDy0QpAPloByEcrAPloBSAfrQDkoxWAfLQCkI9WAPLRCkA+WgHIRysA+WgFIB+tAOSjFYB8tAKQj1YA8tEKQD5aAchHKwD5aAUgH60A5KMVgHy0ApCPVgDy0QpAPloByEcrAPloBSAfrQDkoxWAfLQCkI9WAPLRCkA+WgHIRysA+WgFIB+tAOSjFYB8tAKQj1YA8tEKQD5aAchHKwD5aAUgH60A5KMVgHy0ApCPVgDy0QpAPloByEcrAPloBSAfrQDkoxWAfLQCkI9WAPLRCkA+WgHIR8MDiFsBjCuAcQUwrgDGFcC4AhhXAOMKYFwBjCuAcQUwrgDGFcC4AhhXAOMKYFwBjCuAcQUwrgDGFcC4AhhXAONe+nijQBXMXy8AAAAASUVORK5CYII='

const BLUE_CIRCLE_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAKzSURBVHhe7ZJBbhwxDAT9nLwpb89fEuiwcNCGsbaXlNjqKqAucxq26u0vRPOmHyALAgiHAMIhgHAIIBwCCIcAwiGAcAggHAIIhwDCIYBwCCAcAgiHAMIhgHAIIBwCCIcAwiGAcK4O4NfvP2XeylUB6KN1egtXBKCPs1N3bAPQh5igI5YB6PDTdMIqAB16si5YBKDjOjmd0QHomM5OZWwAOuANTmRkADrcTU5jXAA62I1OYlQAOtTtTmBEADpMkqchgAGe5HgAOkaiJzkagA6R7CmOBaAD4JkIjgSgh+O7u9kegB6MH90JAQx0J1sD0EPxc3dBAEPdxbYA9EB87g4IYLA72BKAHoZft5v2APQg/L6dEICBnRCAgZ20BqCH4M/tggBM7KItAD0AX7cDAjCyAwIwsgMCMLKDlgD0x7HOagjAzGoIwMxqCMDMagjAzGoIwMxqCMDMagjAzGoIwMxqygPQH8ZaqykPYKE/jXVWQwBmVkMAZlZDAGZWQwBmVkMAZlZDAGZWQwBmVkMAZlbTEsBCfxxftwMCMLIDAjCyAwIwsoO2ABZ6AP7cLgjAxC5aA1joIfh9OyEAAzshAAM7aQ9goQfh1+2GAIbbzZYAFnoYPncH2wJY6IH4ubsggKHuYmsACz0UP7oTAhjoTrYHsNCD8d3dHAlgoYfj/sdfHAtgoQMke4qjASx0iERPQgADPMnxABY6SJKnGRHAQodJcAJjAnigI93oJMYFsNDBbnIaIwNY6HA3OJGxASx0QGenMjqABzqmk9OxCOCBjjtZF6wCeKBjT9MJywAWOvoEHbEN4H/0IXbqzhUBPNDH6fQWrgpA0Ud7xVu5OgB4DgGEQwDhEEA4BBAOAYRDAOEQQDgEEA4BhEMA4RBAOAQQDgGEQwDhEEA4BBAOAYRDAOEQQDj/APHiuc08oXK7AAAAAElFTkSuQmCC'

type RealVisionProvider = {
  label: string
  modelKey: string
  config: TextModelConfig
}

function pickRealVisionProvider(): RealVisionProvider | null {
  const dashscopeApiKey =
    process.env.DASHSCOPE_API_KEY || process.env.VITE_DASHSCOPE_API_KEY

  if (dashscopeApiKey) {
    const adapter = new DashScopeAdapter()
    const modelId = process.env.REAL_QWEN_VISION_MODEL || 'qwen3.5-27b'

    return {
      label: `dashscope/${modelId}`,
      modelKey: 'real-qwen-vision',
      config: {
        id: 'real-qwen-vision',
        name: `Qwen Vision (${modelId})`,
        enabled: true,
        providerMeta: adapter.getProvider(),
        modelMeta: adapter.buildDefaultModel(modelId),
        connectionConfig: {
          apiKey: dashscopeApiKey,
          baseURL: process.env.REAL_QWEN_VISION_BASE_URL || adapter.getProvider().defaultBaseURL,
        },
        paramOverrides: {
          temperature: 0.1,
          max_tokens: 300,
        },
      },
    }
  }

  const geminiApiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY
  if (geminiApiKey) {
    const adapter = new GeminiAdapter()
    const modelId = process.env.REAL_GEMINI_VISION_MODEL || 'gemini-2.5-flash'

    return {
      label: `gemini/${modelId}`,
      modelKey: 'real-gemini-vision',
      config: {
        id: 'real-gemini-vision',
        name: `Gemini Vision (${modelId})`,
        enabled: true,
        providerMeta: adapter.getProvider(),
        modelMeta: adapter.buildDefaultModel(modelId),
        connectionConfig: {
          apiKey: geminiApiKey,
          baseURL: process.env.REAL_GEMINI_VISION_BASE_URL || adapter.getProvider().defaultBaseURL,
        },
        paramOverrides: {
          temperature: 0.1,
          maxOutputTokens: 300,
          thinkingBudget: 0,
          includeThoughts: false,
        },
      },
    }
  }

  return null
}

const REAL_PROVIDER = pickRealVisionProvider()

function createPromptServiceHarness(provider: RealVisionProvider) {
  const modelManager = {
    getModel: async (modelKey: string) => {
      if (modelKey !== provider.modelKey) {
        return null
      }
      return provider.config
    },
  }

  const llmService = {
    sendMessage: async () => {
      throw new Error('Text-only route should not be used for multimodal optimizePrompt')
    },
    sendMessageStream: async () => {
      throw new Error('Text-only stream route should not be used for multimodal optimizePromptStream')
    },
  }

  const templateManager = {
    getTemplate: async (templateId: string) => {
      if (templateId === 'multimodal-single-image-test-template') {
        return {
          id: templateId,
          content: [
            {
              role: 'system',
              content:
                '你是多模态图像小词。图片已随请求附带，请直接观察图片，不要假设图片内容来自文本。输出自然语言，不要 JSON，不要 Markdown。必须写出至少一个可见视觉事实（颜色或形状）。',
            },
            {
              role: 'user',
              content:
                '用户想做的修改：{{originalPrompt}}\n请先简短说明你看到了什么，再给出一段更清晰的图生图编辑指令。',
            },
          ],
          metadata: {
            templateType: 'image2imageOptimize',
            version: '1.0.0',
            lastModified: Date.now(),
            language: 'zh',
          },
        }
      }

      if (templateId === 'multimodal-multiimage-test-template') {
        return {
          id: templateId,
          content: [
            {
              role: 'system',
              content:
                '你是多图小词。多张图片已随请求附带，请按顺序理解它们。只输出三行纯文本：第一行以“图1:”开头，第二行以“图2:”开头，第三行以“融合指令:”开头。第三行必须同时出现“图1”和“图2”。不要输出 JSON 或 Markdown。',
            },
            {
              role: 'user',
              content:
                '核心需求：{{originalPrompt}}\n请先分别概括图1和图2的视觉特征，再基于这两张图重写融合编辑指令。',
            },
          ],
          metadata: {
            templateType: 'multiimageOptimize',
            version: '1.0.0',
            lastModified: Date.now(),
            language: 'zh',
          },
        }
      }

      return null
    },
  }

  const historyManager = {
    addRecord: async () => undefined,
  }

  return new PromptService(
    modelManager as any,
    llmService as any,
    templateManager as any,
    historyManager as any,
    createImageUnderstandingService({ registry: new TextAdapterRegistry() }),
  )
}

async function collectStreamResult(
  promptService: PromptService,
  request: OptimizationRequest,
): Promise<{ tokenCount: number; content: string; reasoning: string; finalResponse?: LLMResponse }> {
  let tokenCount = 0
  let content = ''
  let reasoning = ''
  let finalResponse: LLMResponse | undefined

  await promptService.optimizePromptStream(request, {
    onToken: (token) => {
      tokenCount += 1
      content += token
    },
    onReasoningToken: (token) => {
      reasoning += token
    },
    onComplete: (response) => {
      finalResponse = response
    },
    onError: (error) => {
      throw error
    },
  })

  return { tokenCount, content, reasoning, finalResponse }
}

function includesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text))
}

describe.skipIf(!RUN_REAL_API || !REAL_PROVIDER)(
  'PromptService multimodal optimizePromptStream real API',
  () => {
    const promptService = createPromptServiceHarness(REAL_PROVIDER!)

    it(
      `streams single-image optimize through real multimodal provider (${REAL_PROVIDER?.label})`,
      async () => {
        const result = await collectStreamResult(promptService, {
          optimizationMode: 'user',
          targetPrompt: '让这张图的编辑指令更清晰，并强调主体视觉特征',
          templateId: 'multimodal-single-image-test-template',
          modelKey: REAL_PROVIDER!.modelKey,
          inputImages: [
            {
              b64: RED_SQUARE_PNG_BASE64,
              mimeType: 'image/png',
            },
          ],
        })

        const finalContent = result.finalResponse?.content || result.content
        expect(result.tokenCount).toBeGreaterThan(0)
        expect(finalContent.length).toBeGreaterThan(0)
        expect(
          includesAny(finalContent, [/红/i, /red/i, /方块/i, /正方形/i, /square/i]),
        ).toBe(true)
      },
      120000,
    )

    it(
      `streams multi-image optimize through real multimodal provider (${REAL_PROVIDER?.label})`,
      async () => {
        const result = await collectStreamResult(promptService, {
          optimizationMode: 'user',
          targetPrompt: '把图1的主体融合到图2的画面气质里，同时保留主体识别度',
          templateId: 'multimodal-multiimage-test-template',
          modelKey: REAL_PROVIDER!.modelKey,
          inputImages: [
            {
              b64: RED_SQUARE_PNG_BASE64,
              mimeType: 'image/png',
            },
            {
              b64: BLUE_CIRCLE_PNG_BASE64,
              mimeType: 'image/png',
            },
          ],
        })

        const finalContent = result.finalResponse?.content || result.content
        expect(result.tokenCount).toBeGreaterThan(0)
        expect(finalContent.length).toBeGreaterThan(0)
        expect(finalContent).toContain('图1')
        expect(finalContent).toContain('图2')
        expect(
          includesAny(finalContent, [/红/i, /red/i, /方块/i, /正方形/i, /square/i]),
        ).toBe(true)
        expect(
          includesAny(finalContent, [/蓝/i, /blue/i, /圆/i, /圆形/i, /circle/i]),
        ).toBe(true)
      },
      120000,
    )
  },
)
