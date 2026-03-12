import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearCustomModelEnvCache,
  scanCustomModelEnvVars,
} from '../../../src/utils/environment'

const TEST_ENV_KEYS = [
  'VITE_CUSTOM_API_KEY_nvidia_test',
  'VITE_CUSTOM_API_BASE_URL_nvidia_test',
  'VITE_CUSTOM_API_MODEL_nvidia_test',
  'VITE_CUSTOM_API_PARAMS_nvidia_test',
  'VITE_CUSTOM_API_KEY_invalid_json_test',
  'VITE_CUSTOM_API_BASE_URL_invalid_json_test',
  'VITE_CUSTOM_API_MODEL_invalid_json_test',
  'VITE_CUSTOM_API_PARAMS_invalid_json_test',
  'VITE_CUSTOM_API_KEY_invalid_shape_test',
  'VITE_CUSTOM_API_BASE_URL_invalid_shape_test',
  'VITE_CUSTOM_API_MODEL_invalid_shape_test',
  'VITE_CUSTOM_API_PARAMS_invalid_shape_test',
  'VITE_CUSTOM_API_KEY_runtime_override_test',
  'VITE_CUSTOM_API_BASE_URL_runtime_override_test',
  'VITE_CUSTOM_API_MODEL_runtime_override_test',
  'VITE_CUSTOM_API_PARAMS_runtime_override_test',
]

function cleanupTestEnv() {
  TEST_ENV_KEYS.forEach((key) => {
    delete process.env[key]
  })
}

describe('scanCustomModelEnvVars', () => {
  beforeEach(() => {
    clearCustomModelEnvCache()
    cleanupTestEnv()
  })

  afterEach(() => {
    cleanupTestEnv()
    clearCustomModelEnvCache()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('should parse PARAMS and drop forbidden request keys', () => {
    process.env.VITE_CUSTOM_API_KEY_nvidia_test = 'nvapi-test-key'
    process.env.VITE_CUSTOM_API_BASE_URL_nvidia_test = 'https://integrate.api.nvidia.com/v1'
    process.env.VITE_CUSTOM_API_MODEL_nvidia_test = 'qwen/qwen3.5-397b-a17b'
    process.env.VITE_CUSTOM_API_PARAMS_nvidia_test = JSON.stringify({
      chat_template_kwargs: { enable_thinking: true },
      temperature: 0.6,
      timeout: 45000,
      model: 'should-not-win',
      messages: [{ role: 'user', content: 'blocked' }],
      stream: false,
    })

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const models = scanCustomModelEnvVars(false)

    expect(models.nvidia_test).toMatchObject({
      suffix: 'nvidia_test',
      apiKey: 'nvapi-test-key',
      baseURL: 'https://integrate.api.nvidia.com/v1',
      model: 'qwen/qwen3.5-397b-a17b',
      params: {
        chat_template_kwargs: { enable_thinking: true },
        temperature: 0.6,
        timeout: 45000,
      },
    })
    expect(models.nvidia_test.params).not.toHaveProperty('model')
    expect(models.nvidia_test.params).not.toHaveProperty('messages')
    expect(models.nvidia_test.params).not.toHaveProperty('stream')
    expect(
      warnSpy.mock.calls.some(([message]) =>
        String(message).includes('Ignored forbidden PARAMS keys for nvidia_test: model, messages, stream')
      )
    ).toBe(true)
  })

  it('should warn and ignore invalid PARAMS JSON without dropping the model', () => {
    process.env.VITE_CUSTOM_API_KEY_invalid_json_test = 'invalid-json-key'
    process.env.VITE_CUSTOM_API_BASE_URL_invalid_json_test = 'https://example.com/v1'
    process.env.VITE_CUSTOM_API_MODEL_invalid_json_test = 'test-model'
    process.env.VITE_CUSTOM_API_PARAMS_invalid_json_test = '{"temperature":0.5'

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const models = scanCustomModelEnvVars(false)

    expect(models.invalid_json_test).toMatchObject({
      suffix: 'invalid_json_test',
      apiKey: 'invalid-json-key',
      baseURL: 'https://example.com/v1',
      model: 'test-model',
    })
    expect(models.invalid_json_test.params).toBeUndefined()
    expect(
      warnSpy.mock.calls.some(([message]) =>
        String(message).includes('Failed to parse PARAMS for invalid_json_test:')
      )
    ).toBe(true)
  })

  it('should only accept PARAMS as a JSON object', () => {
    process.env.VITE_CUSTOM_API_KEY_invalid_shape_test = 'invalid-shape-key'
    process.env.VITE_CUSTOM_API_BASE_URL_invalid_shape_test = 'https://example.com/v1'
    process.env.VITE_CUSTOM_API_MODEL_invalid_shape_test = 'test-model'
    process.env.VITE_CUSTOM_API_PARAMS_invalid_shape_test = '["not","an","object"]'

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const models = scanCustomModelEnvVars(false)

    expect(models.invalid_shape_test).toBeDefined()
    expect(models.invalid_shape_test.params).toBeUndefined()
    expect(
      warnSpy.mock.calls.some(([message]) =>
        String(message).includes('Invalid PARAMS for invalid_shape_test: must be a JSON object')
      )
    ).toBe(true)
  })

  it('should prefer runtime_config over process.env for Docker runtime overrides', () => {
    process.env.VITE_CUSTOM_API_KEY_runtime_override_test = 'process-key'
    process.env.VITE_CUSTOM_API_BASE_URL_runtime_override_test = 'https://process.example.com/v1'
    process.env.VITE_CUSTOM_API_MODEL_runtime_override_test = 'process-model'
    process.env.VITE_CUSTOM_API_PARAMS_runtime_override_test = JSON.stringify({
      temperature: 0.1,
    })

    vi.stubGlobal('window', {
      runtime_config: {
        CUSTOM_API_KEY_runtime_override_test: 'runtime-key',
        CUSTOM_API_BASE_URL_runtime_override_test: 'https://runtime.example.com/v1',
        CUSTOM_API_MODEL_runtime_override_test: 'runtime-model',
        CUSTOM_API_PARAMS_runtime_override_test: '{"temperature":0.8,"top_p":0.95}',
      },
    })

    const models = scanCustomModelEnvVars(false)

    expect(models.runtime_override_test).toMatchObject({
      apiKey: 'runtime-key',
      baseURL: 'https://runtime.example.com/v1',
      model: 'runtime-model',
      params: {
        temperature: 0.8,
        top_p: 0.95,
      },
    })
  })
})
