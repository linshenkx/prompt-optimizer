import { getBuiltinModelIds, getDefaultTextModels } from '../../../src/services/model/defaults'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

describe('model defaults provider env mapping', () => {
  const originalAnthropicApiKey = process.env.VITE_ANTHROPIC_API_KEY

  beforeEach(() => {
    delete process.env.VITE_ANTHROPIC_API_KEY
  })

  afterAll(() => {
    if (originalAnthropicApiKey === undefined) {
      delete process.env.VITE_ANTHROPIC_API_KEY
      return
    }
    process.env.VITE_ANTHROPIC_API_KEY = originalAnthropicApiKey
  })

  it('should include anthropic in builtin model ids', () => {
    const builtinModelIds = getBuiltinModelIds()
    expect(builtinModelIds).toContain('anthropic')
  })

  it('should include anthropic config and keep it disabled when api key is empty', () => {
    const models = getDefaultTextModels()

    expect(models.anthropic).toBeDefined()
    expect(models.anthropic.providerMeta.id).toBe('anthropic')
    expect(models.anthropic.enabled).toBe(false)
  })

  it('should enable anthropic when VITE_ANTHROPIC_API_KEY is provided', () => {
    process.env.VITE_ANTHROPIC_API_KEY = 'test-anthropic-key'

    const models = getDefaultTextModels()

    expect(models.anthropic.enabled).toBe(true)
    expect(models.anthropic.connectionConfig.apiKey).toBe('test-anthropic-key')
  })
})
