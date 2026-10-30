import { describe, expect, it } from 'vitest'
import type { TextModelConfig } from '@prompt-optimizer/core'
import { hasLocalServiceAddress, normalizeLocalServiceAddress } from '../../../src/utils/local-model-discovery'

describe('local service address identity', () => {
  it.each([
    'http://localhost:3425/v1', 'http://127.0.0.1:3425/v1/', 'http://[::1]:3425/',
    ' http://LOCALHOST:3425 ', 'http://127.1:3425',
  ])('normalizes equivalent loopback URL %s', value => {
    expect(normalizeLocalServiceAddress(value)).toBe('http://localhost:3425')
  })
  it.each(['http://localhost:3426/v1', 'https://localhost:3425/v1', 'http://localhost:3425/gateway/v1'])('preserves distinct connection %s', value => {
    expect(normalizeLocalServiceAddress(value)).not.toBe('http://localhost:3425')
  })
  it.each(['', 'invalid', null, undefined, 'file:///localhost:3425'])('ignores invalid addresses %s', value => {
    expect(normalizeLocalServiceAddress(value)).toBe('')
  })
  it('matches any existing model at the address, even disabled and on another provider', () => {
    const models = [{ enabled: false, providerId: 'openai-compatible', modelId: 'other', connectionConfig: { baseURL: 'http://localhost:3425/v1' } }] as TextModelConfig[]
    expect(hasLocalServiceAddress(models, 'http://127.0.0.1:3425')).toBe(true)
    expect(hasLocalServiceAddress(models, 'http://127.0.0.1:11434')).toBe(false)
  })
})
