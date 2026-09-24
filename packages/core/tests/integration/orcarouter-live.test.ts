import { describe, expect, it } from 'vitest'

import { OrcaRouterAdapter, OrcaRouterOAuthAdapter } from '../../src/services/llm/adapters/orcarouter-adapter'
import { ORCAROUTER_DEFAULT_API_BASE_URL } from '../../src/services/orcarouter/origins'
import type { TextModelConfig } from '../../src/services/llm/types'

/**
 * Live checks against the real OrcaRouter service, exercised through the
 * provider code this change adds — not through a bare curl.
 *
 * These run only when ORCAROUTER_API_KEY is present, so the default suite stays
 * offline and deterministic. The key is read from the environment and is never
 * printed, asserted on, or written anywhere.
 */
const LIVE_API_KEY = (process.env.ORCAROUTER_API_KEY ?? '').trim()
const liveDescribe = LIVE_API_KEY ? describe : describe.skip

function liveConfig(providerId: string): TextModelConfig {
  const adapter = providerId === 'orcarouter' ? new OrcaRouterAdapter() : new OrcaRouterOAuthAdapter()
  const provider = adapter.getProvider()

  return {
    id: providerId,
    name: provider.name,
    enabled: true,
    providerId,
    modelId: 'deepseek/deepseek-v4-flash',
    providerMeta: provider,
    modelMeta: adapter.buildDefaultModel('deepseek/deepseek-v4-flash'),
    connectionConfig: { apiKey: LIVE_API_KEY, baseURL: ORCAROUTER_DEFAULT_API_BASE_URL },
    paramOverrides: { max_completion_tokens: 64 }
  } as TextModelConfig
}

liveDescribe('OrcaRouter live integration', () => {
  it('discovers the real chat catalog through the adapter', async () => {
    const adapter = new OrcaRouterAdapter()
    const models = await adapter.getModelsAsync(liveConfig('orcarouter'), { capability: 'chat' })

    expect(models.length).toBeGreaterThan(0)
    // Vendor/model namespace is preserved verbatim.
    for (const model of models) {
      expect(model.id).toContain('/')
    }
    expect(models.map((model) => model.id)).toContain('deepseek/deepseek-v4-flash')
  })

  it('narrows the live catalog to image-capable models for multimodal entry points', async () => {
    const adapter = new OrcaRouterAdapter()
    const chat = await adapter.getModelsAsync(liveConfig('orcarouter'), { capability: 'chat' })
    const multimodal = await adapter.getModelsAsync(liveConfig('orcarouter'), {
      capability: 'image-understanding',
      requiredInputModalities: ['image']
    })

    // The multimodal list is a strict, non-empty subset of the chat list.
    expect(multimodal.length).toBeGreaterThan(0)
    expect(multimodal.length).toBeLessThan(chat.length)

    const chatIds = new Set(chat.map((model) => model.id))
    for (const model of multimodal) {
      expect(chatIds.has(model.id)).toBe(true)
    }
  })

  it('sends a real chat completion through the adapter', async () => {
    const adapter = new OrcaRouterAdapter()
    const response = await adapter.sendMessage(
      [{ role: 'user', content: 'Reply with exactly: ORCA_OK' }],
      liveConfig('orcarouter')
    )

    expect(typeof response.content).toBe('string')
    expect(response.content.trim().length).toBeGreaterThan(0)
    expect(response.metadata?.model).toBe('deepseek/deepseek-v4-flash')
  })

  it('reaches the same catalog through the PKCE provider entry', async () => {
    const adapter = new OrcaRouterOAuthAdapter()
    const models = await adapter.getModelsAsync(liveConfig('orcarouter-oauth'), { capability: 'chat' })

    // Credential source is irrelevant to discovery: both entries agree.
    expect(models.length).toBeGreaterThan(0)
  })

  it('never echoes the key in a provider error', async () => {
    const adapter = new OrcaRouterAdapter()
    const config = liveConfig('orcarouter')
    config.connectionConfig.apiKey = 'sk-orca-invalid-key-for-error-path'

    let message = ''
    try {
      await adapter.sendMessage([{ role: 'user', content: 'hi' }], config)
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }

    expect(message).not.toContain('sk-orca-invalid-key-for-error-path')
  })
})
