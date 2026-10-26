import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TextAdapterRegistry } from '../../../src/services/llm/adapters/registry'
import { resolveTextModelParameterDefinitions } from '../../../src/services/model/metadata-resolver'
import type { ParameterDefinition } from '../../../src/services/model/types'

const savedDefinitions: ParameterDefinition[] = [
  { name: 'max_tokens', type: 'integer', maxValue: 64000 },
  { name: 'vendor_knob', type: 'number', minValue: 0, maxValue: 10 },
]

describe('parameter definition compatibility', () => {
  let registry: TextAdapterRegistry
  beforeEach(() => { registry = new TextAdapterRegistry() })
  afterEach(() => { vi.restoreAllMocks() })

  const catalogRegistry = new TextAdapterRegistry()
  const providers = catalogRegistry.getAllProviders()
    .filter(provider => provider.id !== 'openai-compatible' && provider.defaultBaseURL &&
      catalogRegistry.getStaticModels(provider.id).length > 0)

  it.each(providers)('uses current definitions for a known $id model without losing extra definitions', provider => {
    const model = registry.getStaticModels(provider.id)[0]
    const before = JSON.stringify(savedDefinitions)
    const definitions = resolveTextModelParameterDefinitions({
      providerId: provider.id, modelId: model.id, registry, savedDefinitions,
      connectionConfig: { baseURL: `${provider.defaultBaseURL}/`, accountId: 'fixture-account' },
    })

    for (const current of model.parameterDefinitions) {
      expect(definitions.find(definition => definition.name === current.name)).toEqual(current)
    }
    expect(definitions.find(definition => definition.name === 'vendor_knob')).toEqual(savedDefinitions[1])
    expect(new Set(definitions.map(definition => definition.name)).size).toBe(definitions.length)
    expect(JSON.stringify(savedDefinitions)).toBe(before)
  })

  it.each(['https://private-gateway.example/v1', 'https://api.openai.com.evil.example/v1',
    'https://api.openai.com/custom/v1'])('keeps snapshot definitions at an unrecognized endpoint %s', baseURL => {
    expect(resolveTextModelParameterDefinitions({
      providerId: 'openai', modelId: registry.getStaticModels('openai')[0].id,
      registry, savedDefinitions, connectionConfig: { baseURL },
    })).toBe(savedDefinitions)
  })

  it('keeps compatible gateway snapshots even when IDs match a convenience catalog', () => {
    expect(resolveTextModelParameterDefinitions({
      providerId: 'openai-compatible', modelId: registry.getStaticModels('openai-compatible')[0].id,
      registry, savedDefinitions, connectionConfig: {},
    })).toBe(savedDefinitions)
  })

  it('keeps private and removed model definitions without using guessed defaults', () => {
    expect(resolveTextModelParameterDefinitions({
      providerId: 'openai', modelId: 'private-model', registry, savedDefinitions, connectionConfig: {},
    })).toBe(savedDefinitions)
  })

  it.each(['ollama', 'chrome-built-in'])('keeps snapshots for %s without a matching managed definition', providerId => {
    expect(resolveTextModelParameterDefinitions({
      providerId, modelId: 'saved-local-model', registry, savedDefinitions, connectionConfig: {},
    })).toBe(savedDefinitions)
  })

  it('recognizes declared regional endpoints', () => {
    const definitions = resolveTextModelParameterDefinitions({
      providerId: 'minimax', modelId: 'MiniMax-M2.7', registry, savedDefinitions,
      connectionConfig: { baseURL: 'https://api.minimaxi.com/v1/' },
    })
    expect(definitions.find(definition => definition.name === 'max_tokens')?.maxValue).toBe(1000000)
  })

  it('keeps snapshots if registry lookup fails', () => {
    vi.spyOn(registry, 'getAdapter').mockImplementation(() => { throw new Error('Unavailable') })
    expect(resolveTextModelParameterDefinitions({
      providerId: 'openai', modelId: 'saved-model', registry, savedDefinitions, connectionConfig: {},
    })).toBe(savedDefinitions)
  })
})
