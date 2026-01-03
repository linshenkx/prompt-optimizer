/**
 * VCR 系统单元测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { VCR, getVCR, withVCR } from '../../../tests/utils/vcr'
import type { LLMRequest, StreamChunk } from '../../../tests/utils/vcr'
import { StreamSimulator } from '../../../tests/utils/stream-simulator'
import { existsSync, unlinkSync } from 'fs'
import { join } from 'path'

describe('VCR 类', () => {
  const testFixtureDir = join(process.cwd(), 'test-fixtures-temp')
  const testRequest: LLMRequest = {
    provider: 'test',
    model: 'test-model',
    messages: [{ role: 'user', content: 'test message' }],
    stream: false
  }

  let vcr: VCR

  beforeEach(() => {
    vcr = new VCR({
      fixtureDir: testFixtureDir,
      mode: 'auto',
      enableRealLLM: false
    })
  })

  afterEach(() => {
    // 清理测试 fixtures
    const fixturePath = vcr['getFixturePath']('test', 'test-scenario')
    if (existsSync(fixturePath)) {
      unlinkSync(fixturePath)
    }
  })

  describe('构造函数', () => {
    it('应该使用默认配置', () => {
      const defaultVCR = new VCR()
      expect(defaultVCR).toBeDefined()
    })

    it('应该使用自定义配置', () => {
      const customVCR = new VCR({
        fixtureDir: './custom-fixtures',
        mode: 'record'
      })
      expect(customVCR).toBeDefined()
    })
  })

  describe('intercept 方法', () => {
    it('off 模式应该直接调用真实函数', async () => {
      const offVCR = new VCR({ mode: 'off' })
      const realFn = vi.fn().mockResolvedValue({ result: 'real' })

      const result = await offVCR.intercept('test-scenario', testRequest, realFn)

      expect(realFn).toHaveBeenCalledOnce()
      expect(result).toEqual({ result: 'real' })
    })

    it('auto 模式且 fixture 不存在应该录制（如果启用真实 LLM）', async () => {
      const vcrWithReal = new VCR({
        fixtureDir: testFixtureDir,
        mode: 'auto',
        enableRealLLM: true
      })

      const realFn = vi.fn().mockResolvedValue({
        content: 'test response',
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
      })

      const result = await vcrWithReal.intercept('test-scenario', testRequest, realFn)

      expect(realFn).toHaveBeenCalledOnce()
      expect(result).toEqual({
        content: 'test response',
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
      })

      // 验证 fixture 已保存
      const fixturePath = vcrWithReal['getFixturePath']('test', 'test-scenario')
      expect(existsSync(fixturePath)).toBe(true)

      // 清理
      if (existsSync(fixturePath)) {
        unlinkSync(fixturePath)
      }
    })

    it('auto 模式且 fixture 不存在但未启用真实 LLM 应该抛出错误', async () => {
      const realFn = vi.fn().mockResolvedValue({ result: 'real' })

      await expect(
        vcr.intercept('test-scenario', testRequest, realFn)
      ).rejects.toThrow('Real LLM is disabled')
    })
  })

  describe('getFixturePath 方法', () => {
    it('应该生成正确的 fixture 路径', () => {
      const path = vcr['getFixturePath']('openai', 'test-scenario')
      expect(path).toContain('openai')
      expect(path).toContain('test-scenario.json')
    })
  })

  describe('listFixtures 方法', () => {
    it('空目录应该返回空数组', () => {
      const fixtures = vcr.listFixtures()
      expect(fixtures).toEqual([])
    })
  })
})

describe('StreamSimulator 类', () => {
  const chunks: StreamChunk[] = [
    { content: 'Hello', timestamp: 0 },
    { content: ' ', timestamp: 50 },
    { content: 'World', timestamp: 100 },
    { content: '!', timestamp: 150 }
  ]

  describe('构造函数', () => {
    it('应该使用默认配置', () => {
      const simulator = new StreamSimulator(chunks)
      expect(simulator).toBeDefined()
    })

    it('应该使用自定义配置', () => {
      const simulator = new StreamSimulator(chunks, { timeScale: 0.5 })
      expect(simulator).toBeDefined()
    })
  })

  describe('getFullContent 方法', () => {
    it('应该拼接所有 chunks', () => {
      const simulator = new StreamSimulator(chunks)
      const content = simulator.getFullContent()
      expect(content).toBe('Hello World!')
    })
  })

  describe('getTotalDuration 方法', () => {
    it('应该返回总时长', () => {
      const simulator = new StreamSimulator(chunks)
      const duration = simulator.getTotalDuration()
      expect(duration).toBe(150)
    })

    it('空 chunks 应该返回 0', () => {
      const simulator = new StreamSimulator([])
      expect(simulator.getTotalDuration()).toBe(0)
    })
  })

  describe('getChunkCount 方法', () => {
    it('应该返回 chunks 数量', () => {
      const simulator = new StreamSimulator(chunks)
      expect(simulator.getChunkCount()).toBe(4)
    })
  })

  describe('generate 方法', () => {
    it('应该异步生成所有 chunks', async () => {
      const simulator = new StreamSimulator(chunks, { timeScale: 0.01 })
      const generatedChunks: StreamChunk[] = []

      for await (const chunk of simulator.generate()) {
        generatedChunks.push(chunk)
      }

      expect(generatedChunks).toEqual(chunks)
    })

    it('应该正确应用时间缩放', async () => {
      const simulator = new StreamSimulator(chunks, { timeScale: 0.5 })
      const startTime = Date.now()

      for await (const _ of simulator.generate()) {
        // 等待所有 chunks
      }

      const duration = Date.now() - startTime
      // 原始 150ms，缩放后应该是 ~75ms
      expect(duration).toBeGreaterThan(50)
      expect(duration).toBeLessThan(150)
    })
  })

  describe('generateCallback 方法', () => {
    it('应该使用回调函数处理 chunks', async () => {
      const simulator = new StreamSimulator(chunks, { timeScale: 0.01 })
      const results: string[] = []

      await simulator.generateCallback(
        (chunk) => {
          results.push(chunk.content)
        },
        () => {
          results.push('DONE')
        }
      )

      expect(results).toEqual(['Hello', ' ', 'World', '!', 'DONE'])
    })

    it('应该处理错误', async () => {
      const simulator = new StreamSimulator(chunks, { timeScale: 0.01 })
      const error = new Error('Test error')

      let caughtError: Error | null = null

      await simulator.generateCallback(
        () => {
          throw error
        },
        () => {},
        (err) => {
          caughtError = err
        }
      )

      expect(caughtError).toEqual(error)
    })
  })
})

describe('getVCR 单例函数', () => {
  it('应该返回同一个实例', () => {
    const vcr1 = getVCR()
    const vcr2 = getVCR()
    expect(vcr1).toBe(vcr2)
  })
})

describe('withVCR 便捷函数', () => {
  it('应该正确调用 VCR.intercept', async () => {
    const testRequest: LLMRequest = {
      provider: 'test',
      model: 'test-model',
      messages: [{ role: 'user', content: 'test' }],
      stream: false
    }

    const realFn = vi.fn().mockResolvedValue({ result: 'mock' })

    // 使用 off 模式避免真实录制
    const result = await withVCR(
      'test-scenario',
      testRequest,
      realFn,
      { mode: 'off' }
    )

    expect(realFn).toHaveBeenCalledOnce()
    expect(result).toEqual({ result: 'mock' })
  })
})

describe('性能测试', () => {
  it('流式响应应该在合理时间内完成', async () => {
    const chunks: StreamChunk[] = Array.from({ length: 100 }, (_, i) => ({
      content: `chunk-${i}`,
      timestamp: i * 10
    }))

    const simulator = new StreamSimulator(chunks, { timeScale: 0.01 })
    const startTime = Date.now()

    let count = 0
    for await (const _ of simulator.generate()) {
      count++
    }

    const duration = Date.now() - startTime

    expect(count).toBe(100)
    // 原始 990ms，缩放后应该是 ~10ms
    expect(duration).toBeLessThan(100)
  })
})
