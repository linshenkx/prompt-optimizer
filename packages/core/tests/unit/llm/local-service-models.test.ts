import { describe, expect, it, vi } from 'vitest'
import { fetchLocalServiceModels, type LocalServiceModelRequest } from '../../../src/services/llm/local-service-models'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const input: LocalServiceModelRequest = { kind: 'lmstudio', baseURL: 'http://localhost:1234/v1/' }
describe('explicit local model fetching', () => {
  it('preserves LM Studio instance IDs and excludes embedding/decision models', async () => {
    const request = vi.fn<typeof fetch>(async () => json({ models: [
      { type: 'llm', key: 'downloaded', display_name: 'Local model', loaded_instances: [{ id: 'instance' }] },
      { type: 'vlm', key: 'vision', loaded_instances: [] },
      { type: 'embedding', key: 'embed' }, { type: 'decision', key: 'decision' },
    ] }))
    expect(await fetchLocalServiceModels(input, { fetch: request })).toEqual([
      { value: 'instance', label: 'Local model' }, { value: 'vision', label: 'vision' },
    ])
    expect(request).toHaveBeenCalledWith('http://localhost:1234/api/v1/models', expect.not.objectContaining({ headers: expect.anything() }))
  })
  it('falls back to the legacy LM Studio catalog only on 404', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(json({}, 404)).mockResolvedValueOnce(json({ data: [{ id: 'old', type: 'vlm' }] }))
    expect(await fetchLocalServiceModels(input, { fetch: request })).toEqual([{ value: 'old', label: 'old' }])
    expect(request.mock.calls.map(([url]) => url)).toEqual(['http://localhost:1234/api/v1/models', 'http://localhost:1234/api/v0/models'])
  })
  it.each([401, 403, 500])('surfaces HTTP %s without a fallback catalog', async status => {
    const request = vi.fn<typeof fetch>(async () => json({}, status))
    await expect(fetchLocalServiceModels(input, { fetch: request })).rejects.toThrow(`HTTP ${status}`)
    expect(request).toHaveBeenCalledOnce()
  })
  it.each([
    ['ollama', undefined, '/api/tags', { models: [{ name: 'qwen' }, { name: 'qwen' }] }, 'qwen'],
    ['magpie', undefined, '/v1/models', { data: [{ id: 'gateway/model' }] }, 'gateway/model'],
    ['cliproxyapi', 'openai-compatible', '/v1/models', { object: 'list', data: [{ id: 'cli/model' }] }, 'cli/model'],
    ['litellm', 'openai-compatible', '/v1/models', { object: 'list', data: [{ id: 'lite/model' }] }, 'lite/model'],
    ['llamacpp', 'openai-compatible', '/v1/models', { object: 'list', data: [{ id: 'local.gguf' }] }, 'local.gguf'],
    ['cc-switch', 'openai-compatible', '/v1/models', { models: [{ slug: 'codex/model' }] }, 'codex/model'],
    ['cc-switch', 'anthropic', '/v1/models?limit=1000', { data: [{ id: 'claude/model' }] }, 'claude/model'],
  ] as const)('reads %s catalog with %s protocol and only the entered key', async (kind, providerId, endpoint, body, id) => {
    const request = vi.fn<typeof fetch>(async () => json(body))
    expect(await fetchLocalServiceModels({ ...input, kind, providerId, apiKey: ' user-test-key ' }, { fetch: request })).toEqual([{ value: id, label: id }])
    expect(request).toHaveBeenCalledWith('http://localhost:1234' + endpoint, expect.objectContaining({
      headers: providerId === 'anthropic' ? { 'x-api-key': 'user-test-key' } : { Authorization: 'Bearer user-test-key' }, credentials: 'omit', redirect: 'error',
    }))
  })
  it('returns an empty catalog without inserting static models', async () => {
    expect(await fetchLocalServiceModels({ ...input, kind: 'cc-switch' }, { fetch: async () => json({ models: [] }) })).toEqual([])
  })
  it('forwards validated custom headers only on explicit catalog requests', async () => {
    const request = vi.fn<typeof fetch>(async () => json({ models: [] }))
    await fetchLocalServiceModels({ ...input, customHeaders: { 'X-Local-Route': 'test' } }, { fetch: request })
    expect(request.mock.calls[0][1]?.headers).toEqual({ 'X-Local-Route': 'test' })
    await expect(fetchLocalServiceModels({ ...input, customHeaders: { Cookie: 'forbidden' } }, { fetch: request })).rejects.toThrow('Invalid custom request headers')
    expect(request).toHaveBeenCalledOnce()
  })
  it.each([{}, { models: [null] }, { models: [{ type: 'llm', key: '' }] }])('rejects malformed catalogs: %j', async body => {
    await expect(fetchLocalServiceModels(input, { fetch: async () => json(body) })).rejects.toThrow('Invalid local model catalog')
  })
  it.each(['https://example.com/v1', 'http://user:secret@localhost:1234', 'file:///tmp', 'http://localhost:1234/proxy', 'http://localhost:1234?key=secret'])('rejects unsafe local addresses before sending credentials: %s', async baseURL => {
    const request = vi.fn()
    await expect(fetchLocalServiceModels({ ...input, baseURL, apiKey: 'private' }, { fetch: request })).rejects.toThrow()
    expect(request).not.toHaveBeenCalled()
  })
  it('bounds model reads with cancellation', async () => {
    await expect(fetchLocalServiceModels(input, { timeoutMs: 5, fetch: (_url, options) => new Promise((_resolve, reject) => {
      options!.signal!.addEventListener('abort', () => reject(new Error('aborted')))
    }) })).rejects.toThrow('aborted')
  })
})
