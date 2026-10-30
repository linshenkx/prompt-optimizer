import { describe, expect, it, vi } from 'vitest'
import { discoverLocalServices } from '../../../src/services/llm/local-discovery'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
describe('local service discovery', () => {
  it('recognizes Magpie without requesting its catalog or sending credentials', async () => {
    const request = vi.fn<typeof fetch>(async (url, options) => {
      expect(options).toMatchObject({ credentials: 'omit', redirect: 'error', cache: 'no-store' })
      if (new URL(String(url)).port === '11434') return new Response('Ollama is running')
      if (String(url).endsWith('/api/hello')) return json({ name: 'magpie', version: '1' })
      if (new URL(String(url)).port !== '4567') return json({}, 404)
      expect(options?.headers).toBeUndefined()
      return json({ data: [{ id: 'provider/model', display_name: 'My model' }] })
    })
    const found = await discoverLocalServices({ magpie: 4567 }, { fetch: request })
    expect(found.slice(0, 2).map(service => service.status)).toEqual(['ready', 'ready'])
    expect(found.every(service => service.models.length === 0)).toBe(true)
    expect(found[1]).toMatchObject({ baseURL: 'http://127.0.0.1:4567/v1', models: [] })
    expect(request.mock.calls.filter(([url]) => new URL(String(url)).port === '4567')).toEqual([
      [expect.stringContaining('/api/hello'), expect.not.objectContaining({ headers: expect.anything() })],
    ])
    expect(request).toHaveBeenCalledTimes(6)
  })

  it('does not guess Magpie identity from other successful JSON responses', async () => {
    const request = vi.fn<typeof fetch>(async () => json({ name: 'other', models: [] }))
    const found = await discoverLocalServices({}, { fetch: request })
    expect(found[0]).toMatchObject({ status: 'incompatible', models: [] })
    expect(found[1].status).toBe('incompatible')
    expect(request).toHaveBeenCalledTimes(6)
  })

  const magpieAuthError = {
    error: { type: 'authentication_error', message: "a web page or browser extension calls magpie with a gateway key: create one in magpie's Gateway page and send it as Authorization: Bearer <key> (or x-api-key)" },
  }
  it('identifies Magpie by its branded CORS authentication response without fetching models', async () => {
    const request = vi.fn<typeof fetch>(async () => json(magpieAuthError, 401))
    const found = await discoverLocalServices({}, { fetch: request })
    expect(found[1]).toMatchObject({ kind: 'magpie', status: 'ready', models: [] })
    expect(found.filter(service => service.status === 'ready')).toHaveLength(1)
    expect(request.mock.calls.filter(([url]) => new URL(String(url)).port === '3425')
      .every(([url, options]) => new URL(String(url)).pathname === '/api/hello' && !options?.headers)).toBe(true)
  })
  it.each([
    json({}, 401),
    json({ error: { type: 'authentication_error', message: 'Unauthorized' } }, 401),
    json({ error: { type: 'authentication_error', message: 'magpie' } }, 401),
    json({ error: { ...magpieAuthError.error, type: 'server_error' } }, 401),
    json(magpieAuthError, 403),
    new Response('Unauthorized', { status: 401 }),
  ])('does not recognize unrelated, malformed or forbidden responses', async response => {
    const found = await discoverLocalServices({}, { fetch: async () => response.clone() })
    expect(found[1]).toMatchObject({ status: 'unauthorized', models: [] })
  })

  it.each(['OK', 'Not Ollama is running', '{"version":"1.0"}', ''])('rejects non-Ollama root responses: %s', async body => {
    const found = await discoverLocalServices({}, { fetch: async () => new Response(body) })
    expect(found[0]).toMatchObject({ status: 'incompatible', models: [] })
  })

  it('distinguishes HTTP authorization failures from browser network failures', async () => {
    const found = await discoverLocalServices({}, { fetch: async url => {
      if (String(url).includes('localhost')) return json({}, 401)
      throw new TypeError('Failed to fetch')
    } })
    expect(found.slice(0, 2).map(service => service.status)).toEqual(['unauthorized', 'unavailable'])
  })

  it('aborts hanging requests at the deadline', async () => {
    const signals: AbortSignal[] = []
    const found = await discoverLocalServices({}, { timeoutMs: 10, fetch: (_url, options) => new Promise((_resolve, reject) => {
      signals.push(options!.signal!)
      options!.signal!.addEventListener('abort', () => reject(new Error('aborted')))
    }) })
    expect(found).toHaveLength(6)
    expect(found.every(service => service.status === 'timeout')).toBe(true)
    expect(signals.every(signal => signal.aborted)).toBe(true)
  })

  it('cancels requests when the caller closes discovery', async () => {
    const controller = new AbortController()
    const request = vi.fn<typeof fetch>((_url, options) => new Promise((_resolve, reject) => {
      options!.signal!.addEventListener('abort', () => reject(new Error('aborted')))
    }))
    const pending = discoverLocalServices({}, { signal: controller.signal, fetch: request })
    controller.abort()
    expect((await pending).every(service => service.status === 'unavailable')).toBe(true)
  })

  it.each([0, 65536, 1.5, '3425', '3425/path'])('rejects invalid ports before making requests: %s', async port => {
    const request = vi.fn()
    await expect(discoverLocalServices({ magpie: port as number }, { fetch: request })).rejects.toThrow('Invalid')
    expect(request).not.toHaveBeenCalled()
  })
})

const ccState = {
  running: true, address: '127.0.0.1', port: 15721, active_connections: 0, total_requests: 0,
  success_requests: 0, failed_requests: 0, uptime_seconds: 10, failover_count: 0, active_targets: [],
}
const probe = async (kind: 'lmstudio' | 'cc-switch' | 'cliproxyapi' | 'litellm' | 'llamacpp', responses: Record<string, unknown | Response>) => {
  const calls: string[] = []
  const found = await discoverLocalServices({}, { fetch: async url => {
    const address = new URL(String(url))
    if (address.port !== ({ lmstudio: '1234', 'cc-switch': '15721', cliproxyapi: '8317', litellm: '4000', llamacpp: '9931' }[kind])) return json({}, 404)
    const key = address.pathname + address.search
    calls.push(key)
    const response = responses[key]
    return response instanceof Response ? response : response === undefined ? json({}, 404) : json(response)
  } })
  return { service: found.find(item => item.kind === kind)!, calls }
}

describe('identity-only discovery', () => {
  const litePage = '<html><title>LiteLLM API - Swagger UI</title><script>const ui = SwaggerUIBundle({})</script></html>'
  const llamaProps = { build_info: 'b9000-test', total_slots: 1, default_generation_settings: { n_ctx: 4096 }, chat_template: 'test', model_path: 'test.gguf' }
  it('identifies LiteLLM without calling its active health check or model catalog', async () => {
    const { service, calls } = await probe('litellm', { '/health/liveliness': "I'm alive!", '/': new Response(litePage) })
    expect(service).toMatchObject({ name: 'LiteLLM', status: 'ready', models: [], providerId: 'openai-compatible' })
    expect(calls).toEqual(['/health/liveliness', '/'])
  })
  it.each([
    ['OK', litePage], ["I'm alive!", '<title>Other API - Swagger UI</title>SwaggerUIBundle'],
    ["I'm alive!", '<p>LiteLLM API - Swagger UI</p>SwaggerUIBundle'], ["I'm alive!", '<title>LiteLLM API - Swagger UI</title>'],
  ])('requires both LiteLLM fingerprints', async (alive, page) => {
    expect((await probe('litellm', { '/health/liveliness': alive, '/': new Response(page) })).service.status).toBe('incompatible')
  })
  it('identifies llama.cpp by exposed server header without fetching props or models', async () => {
    const { service, calls } = await probe('llamacpp', { '/health': new Response('{"status":"ok"}', { headers: { Server: 'llama.cpp' } }) })
    expect(service).toMatchObject({ name: 'llama.cpp', status: 'ready', models: [] })
    expect(calls).toEqual(['/health'])
  })
  it('identifies llama.cpp from props when the browser cannot see its server header', async () => {
    const { service, calls } = await probe('llamacpp', { '/health': { status: 'ok' }, '/props': llamaProps })
    expect(service.status).toBe('ready')
    expect(calls).toEqual(['/health', '/props'])
  })
  it('identifies protected llama.cpp through its public UI manifest without a key', async () => {
    const { service, calls } = await probe('llamacpp', { '/health': { status: 'ok' }, '/props': json({}, 401),
      '/manifest.webmanifest': { name: 'llama-ui', description: 'Local AI chat interface powered by llama.cpp' } })
    expect(service).toMatchObject({ status: 'ready', models: [] })
    expect(calls).toEqual(['/health', '/props', '/manifest.webmanifest'])
  })
  it.each([{}, { ...llamaProps, build_info: '' }, { ...llamaProps, total_slots: '1' }, { ...llamaProps, default_generation_settings: {} }, json({}, 401)])(
    'does not label generic health or unauthorized replies as llama.cpp', async props => {
      expect((await probe('llamacpp', { '/health': { status: 'ok' }, '/props': props })).service.status).not.toBe('ready')
    })
  it('recognizes a branded llama.cpp that is still loading its model', async () => {
    const response = new Response(JSON.stringify({ error: { type: 'unavailable_error', message: 'Loading model' } }), { status: 503, headers: { Server: 'llama.cpp' } })
    expect((await probe('llamacpp', { '/health': response })).service.status).toBe('ready')
  })
  it('checks current and legacy llama.cpp ports independently, with explicit overrides replacing both', async () => {
    const request = vi.fn<typeof fetch>(async (url, options) => {
      expect(options?.headers).toBeUndefined()
      const address = new URL(String(url))
      return address.pathname === '/health' && ['9931', '8080', '18080'].includes(address.port)
        ? new Response('{"status":"ok"}', { headers: { Server: 'llama.cpp' } }) : json({}, 404)
    })
    const defaults = await discoverLocalServices({}, { fetch: request })
    expect(defaults.filter(item => item.kind === 'llamacpp').map(item => [item.baseURL, item.status])).toEqual([
      ['http://127.0.0.1:9931/v1', 'ready'], ['http://127.0.0.1:8080/v1', 'ready'],
    ])
    request.mockClear()
    const custom = await discoverLocalServices({ llamacpp: 18080, litellm: 14000 }, { fetch: request })
    expect(custom.filter(item => item.kind === 'llamacpp')).toHaveLength(1)
    expect(custom.find(item => item.kind === 'llamacpp')?.baseURL).toBe('http://127.0.0.1:18080/v1')
    expect(custom.find(item => item.kind === 'litellm')?.baseURL).toBe('http://127.0.0.1:14000/v1')
    expect(request.mock.calls.some(([url]) => ['9931', '8080', '4000'].includes(new URL(String(url)).port))).toBe(false)
  })
  const cliHello = { message: 'CLI Proxy API Server', endpoints: ['POST /v1/chat/completions', 'POST /v1/completions', 'GET /v1/models'] }
  it('recognizes CLIProxyAPI from its public root without credentials or a catalog', async () => {
    const request = vi.fn<typeof fetch>(async url => new URL(String(url)).port === '8317' ? json(cliHello) : json({}, 404))
    const found = await discoverLocalServices({}, { fetch: request })
    expect(found.find(service => service.kind === 'cliproxyapi')).toMatchObject({
      name: 'CLIProxyAPI', status: 'ready', baseURL: 'http://127.0.0.1:8317/v1', models: [],
      providerId: 'openai-compatible', requestStyle: 'chat_completions',
    })
    const calls = request.mock.calls.filter(([url]) => new URL(String(url)).port === '8317')
    expect(calls).toHaveLength(1)
    expect(calls[0][0]).toBe('http://127.0.0.1:8317/')
    expect(calls[0][1]?.headers).toBeUndefined()
  })
  it.each([{}, { ...cliHello, message: 'Other gateway' }, { message: cliHello.message },
    { ...cliHello, endpoints: ['GET /v1/models'] }, { ...cliHello, endpoints: 'GET /v1/models' },
    json(cliHello, 401), new Response('<html>CLI Proxy API Server</html>'),
  ])('does not guess CLIProxyAPI identity from unrelated or protected responses', async body => {
    expect((await probe('cliproxyapi', { '/': body })).service.status).not.toBe('ready')
  })
  it('validates CLIProxyAPI port overrides before fetching', async () => {
    const request = vi.fn<typeof fetch>(async () => json(cliHello))
    await expect(discoverLocalServices({ cliproxyapi: 65536 }, { fetch: request })).rejects.toThrow('Invalid local service port')
    expect(request).not.toHaveBeenCalled()
    const found = await discoverLocalServices({ cliproxyapi: 18317 }, { fetch: request })
    expect(found.find(service => service.kind === 'cliproxyapi')?.baseURL).toBe('http://127.0.0.1:18317/v1')
  })
  it.each([undefined, 1234, 4321])('does not probe paused LM Studio even with port %s', async port => {
    const request = vi.fn<typeof fetch>(async () => json({ lmstudio: true }))
    const found = await discoverLocalServices(port === undefined ? {} : { lmstudio: port }, { fetch: request })
    expect(found.some(service => service.kind === 'lmstudio')).toBe(false)
    expect(request.mock.calls.some(([url]) => ['1234', '4321'].includes(new URL(String(url)).port))).toBe(false)
  })
  it.each([undefined, 15721, 45721])('does not probe paused CC Switch even with port %s', async port => {
    const request = vi.fn<typeof fetch>(async () => json(ccState))
    const found = await discoverLocalServices(port === undefined ? {} : { 'cc-switch': port }, { fetch: request })
    expect(found.some(service => service.kind === 'cc-switch')).toBe(false)
    expect(request.mock.calls.some(([url]) => ['15721', '45721'].includes(new URL(String(url)).port))).toBe(false)
  })
})
