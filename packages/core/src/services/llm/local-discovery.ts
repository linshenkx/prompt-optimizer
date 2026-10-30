/** Read-only discovery of known loopback LLM services. No arbitrary URL or port scan. */
export type LocalServiceKind = typeof LOCAL_SERVICE_KINDS[number]
export type LocalDiscoveryPorts = Partial<Record<LocalServiceKind, number>>
export const LOCAL_SERVICE_KINDS = ['ollama', 'magpie', 'lmstudio', 'cc-switch', 'cliproxyapi', 'litellm', 'llamacpp'] as const
export type LocalDiscoveryStatus = 'ready' | 'unavailable' | 'timeout' | 'unauthorized' | 'incompatible'
export interface LocalServiceResult {
  kind: LocalServiceKind
  name: string
  baseURL: string
  status: LocalDiscoveryStatus
  models: { id: string; name: string }[]
  providerId?: 'anthropic' | 'openai-compatible'
  requestStyle?: 'responses' | 'chat_completions'
}

export function validateLocalDiscoveryPorts(ports: LocalDiscoveryPorts = {}): LocalDiscoveryPorts {
  if (!ports || typeof ports !== 'object' || Array.isArray(ports)) throw new Error('Invalid local service ports')
  const result: LocalDiscoveryPorts = {}
  for (const kind of LOCAL_SERVICE_KINDS) {
    const port = ports[kind]
    if (port === undefined) continue
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid local service port')
    result[kind] = port
  }
  return result
}

class ProbeError extends Error {
  constructor(public status: LocalDiscoveryStatus, public httpStatus?: number) { super(status) }
}

export async function discoverLocalServices(
  ports: LocalDiscoveryPorts = {},
  options: { signal?: AbortSignal; fetch?: typeof fetch; timeoutMs?: number } = {},
): Promise<LocalServiceResult[]> {
  const validated = validateLocalDiscoveryPorts(ports)
  const request = options.fetch ?? globalThis.fetch
  const defaults: Record<LocalServiceKind, number[]> = {
    ollama: [11434], magpie: [3425], lmstudio: [1234], 'cc-switch': [15721], cliproxyapi: [8317],
    litellm: [4000], llamacpp: [9931, 8080],
  }
  // Unverified services are paused. Keep known kinds for persisted metadata,
  // but do not probe them, including when a custom port is supplied.
  const candidates = LOCAL_SERVICE_KINDS.filter((kind): boolean => !['lmstudio', 'cc-switch'].includes(kind)).flatMap(kind =>
    (validated[kind] === undefined ? defaults[kind] : [validated[kind]!]).map(port => ({ kind, port })))
  return Promise.all(candidates.map(async ({ kind, port }) => {
    const names = { ollama: 'Ollama', magpie: 'Magpie', lmstudio: 'LM Studio', 'cc-switch': 'CC Switch', cliproxyapi: 'CLIProxyAPI', litellm: 'LiteLLM', llamacpp: 'llama.cpp' }
    const origin = `http://${kind === 'ollama' ? 'localhost' : '127.0.0.1'}:${port}`
    const result: LocalServiceResult = {
      kind, name: names[kind], baseURL: `${origin}/v1`, status: 'unavailable', models: [],
    }
    const controller = new AbortController()
    const abort = () => controller.abort()
    options.signal?.addEventListener('abort', abort, { once: true })
    if (options.signal?.aborted) abort()
    let timedOut = false
    const timeout = setTimeout(() => { timedOut = true; abort() }, options.timeoutMs ?? 3000)
    const requestAt = (path: string) => request(`${origin}${path}`, {
        signal: controller.signal, credentials: 'omit', redirect: 'error', cache: 'no-store',
      })
    const get = async (path: string, text = false) => {
      const response = await requestAt(path)
      if (response.status === 401 || response.status === 403) {
        // Magpie's CORS guard also protects /api/hello. Its branded JSON error
        // identifies it without a key; a generic 401 or a port alone cannot.
        // Source: yetone/magpie, internal/gateway/cors.go (corsGuard).
        if (kind === 'magpie' && path === '/api/hello' && response.status === 401) {
          const body = await response.json().catch(() => null)
          const message = body?.error?.message
          if (body?.error?.type === 'authentication_error' && typeof message === 'string'
            && message.startsWith('a web page or browser extension calls magpie with a gateway key: ')
            && message.includes("magpie's Gateway page")) return { name: 'magpie' }
        }
        throw new ProbeError('unauthorized', response.status)
      }
      if (!response.ok) throw new ProbeError('incompatible', response.status)
      try { return text ? await response.text() : await response.json() } catch (error) {
        if (controller.signal.aborted) throw error
        throw new ProbeError('incompatible')
      }
    }
    try {
      if (kind === 'magpie') {
        const hello = await get('/api/hello')
        if (hello?.name !== 'magpie') throw new ProbeError('incompatible')
        // Discovery is independent of authenticated catalog access. The editor
        // asks for a gateway key and fetches models only at the user's request.
      } else if (kind === 'ollama') {
        if ((await get('/', true)).trim() !== 'Ollama is running') throw new ProbeError('incompatible')
      } else if (kind === 'lmstudio') {
        // The same identity endpoint used by LM Studio's official SDK.
        if ((await get('/lmstudio-greeting'))?.lmstudio !== true) throw new ProbeError('incompatible')
      } else if (kind === 'cliproxyapi') {
        // Public root response in CLIProxyAPI's server_routes.go; never probe
        // management APIs or authenticate just to discover the service.
        const hello = await get('/')
        if (hello?.message !== 'CLI Proxy API Server' || !Array.isArray(hello.endpoints)
          || !['POST /v1/chat/completions', 'GET /v1/models'].every(endpoint => hello.endpoints.includes(endpoint))) {
          throw new ProbeError('incompatible')
        }
        result.providerId = 'openai-compatible'
        result.requestStyle = 'chat_completions'
      } else if (kind === 'litellm') {
        // /health may perform real upstream inference. Only use the public
        // process-liveness probe plus the default branded Swagger document.
        if (await get('/health/liveliness') !== "I'm alive!") throw new ProbeError('incompatible')
        const page = await get('/', true)
        if (!/<title>\s*LiteLLM API\s*-\s*Swagger UI\s*<\/title>/i.test(page)
          || !page.includes('SwaggerUIBundle')) throw new ProbeError('incompatible')
        result.providerId = 'openai-compatible'
        result.requestStyle = 'chat_completions'
      } else if (kind === 'llamacpp') {
        const response = await requestAt('/health')
        const health = await response.json().catch(() => null)
        if (!(response.ok && health?.status === 'ok')
          && !(response.status === 503 && health?.error?.type === 'unavailable_error'
            && health.error.message === 'Loading model')) throw new ProbeError('incompatible')
        // Server is normally hidden by browser CORS. Fall back to a strict
        // props schema, then the public UI manifest when props requires a key.
        let identified = response.headers.get('Server') === 'llama.cpp'
        if (!identified) {
          try {
            const props = await get('/props')
            identified = typeof props?.build_info === 'string' && !!props.build_info.trim()
              && Number.isInteger(props.total_slots) && props.total_slots > 0
              && typeof props.default_generation_settings?.n_ctx === 'number'
              && typeof props.chat_template === 'string' && typeof props.model_path === 'string'
          } catch (error) {
            if (!(error instanceof ProbeError) || !['unauthorized', 'incompatible'].includes(error.status)) throw error
          }
        }
        if (!identified) {
          const manifest = await get('/manifest.webmanifest')
          identified = ['llama-ui', 'llama.cpp'].includes(manifest?.name)
            && manifest?.description === 'Local AI chat interface powered by llama.cpp'
        }
        if (!identified) throw new ProbeError('incompatible')
        result.providerId = 'openai-compatible'
        result.requestStyle = 'chat_completions'
      } else {
        // CC Switch has no branded hello endpoint. Validate both independent
        // read-only response schemas without fetching its model catalog.
        const health = await get('/health')
        if (health?.status !== 'healthy' || typeof health.timestamp !== 'string') throw new ProbeError('incompatible')
        const state = await get('/status')
        if (state?.running !== true || state.port !== port || typeof state.address !== 'string'
          || !['active_connections', 'total_requests', 'success_requests', 'failed_requests', 'uptime_seconds', 'failover_count']
            .every(key => typeof state[key] === 'number' && Number.isFinite(state[key]))
          || !Array.isArray(state.active_targets)
          || state.active_targets.some((target: { app_type?: unknown; provider_id?: unknown; provider_name?: unknown } | null) => !target
            || typeof target.app_type !== 'string' || typeof target.provider_id !== 'string' || typeof target.provider_name !== 'string')) {
          throw new ProbeError('incompatible')
        }
        result.providerId = 'openai-compatible'
        result.requestStyle = 'responses'
        const targets = state.active_targets.map((target: { app_type: string }) => target.app_type.toLowerCase())
        if (targets.includes('claude') && !targets.includes('codex')) {
          result.providerId = 'anthropic'
          result.baseURL = origin
          delete result.requestStyle
        }
      }
      result.status = 'ready'
    } catch (error) {
      result.models = []
      result.status = timedOut ? 'timeout' : error instanceof ProbeError ? error.status : 'unavailable'
    } finally {
      clearTimeout(timeout)
      options.signal?.removeEventListener('abort', abort)
    }
    return result
  }))
}
