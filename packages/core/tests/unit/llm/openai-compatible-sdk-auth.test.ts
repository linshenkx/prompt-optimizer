import { afterEach, describe, expect, it, vi } from 'vitest'
import { OpenAICompatibleAdapter } from '../../../src/services/llm/adapters/openai-compatible-adapter'
import type { TextModelConfig } from '../../../src/services/llm/types'

// Exercise the real SDK constructor and request builder: mocking OpenAI itself
// would hide its rejection of empty credentials before the transport is called.
describe('OpenAI-compatible authentication with the real SDK', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it.each(['', undefined, '  ', 'user-supplied-key'])(
    'sends only user-supplied authentication for key %j', async (apiKey) => {
      vi.stubEnv('OPENAI_API_KEY', 'environment-key-must-not-leak')
      const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
        id: 'chatcmpl-test', object: 'chat.completion', created: 1, model: 'local-model',
        choices: [{ index: 0, message: { role: 'assistant', content: 'connected' }, finish_reason: 'stop' }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      vi.stubGlobal('fetch', transport)
      const adapter = new OpenAICompatibleAdapter()
      const config: TextModelConfig = {
        id: 'local-test', name: 'Local test', enabled: true,
        providerMeta: adapter.getProvider(), modelMeta: adapter.buildDefaultModel('local-model'),
        connectionConfig: { baseURL: 'http://127.0.0.1:9931/v1', apiKey, requestStyle: 'chat_completions' },
        paramOverrides: {},
      }

      await expect(adapter.sendMessage([{ role: 'user', content: 'hi' }], config)).resolves.toMatchObject({ content: 'connected' })
      expect(transport).toHaveBeenCalledTimes(1)
      const [url, request] = transport.mock.calls[0]
      expect(String(url)).toBe('http://127.0.0.1:9931/v1/chat/completions')
      expect(new Headers(request?.headers).get('authorization')).toBe(
        apiKey?.trim() ? `Bearer ${apiKey}` : null,
      )
      expect(config.connectionConfig.apiKey).toBe(apiKey)
    },
  )
})
