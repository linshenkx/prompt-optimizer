import { v4 as randomUUID } from 'uuid'
import {
  BROWSER_BRIDGE_MAX_BYTES, BROWSER_BRIDGE_PROTOCOL, BrowserBridgeError, publicBrowserError,
  type BrowserAccess,
} from '@prompt-optimizer/core/bridge-protocol'
import type { BrowserBridgeHost, BrowserSourceSession, ComparisonExecutionSource } from '@prompt-optimizer/core'

export interface PageAuthorization { port: number; ticket: string; access: BrowserAccess }

function captureAuthorization(): PageAuthorization | undefined {
  if (typeof window === 'undefined') return
  const [path, query] = window.location.hash.slice(1).split('?')
  const params = new URLSearchParams(query)
  const value = params.get('poBridge')
  if (!value) return
  params.delete('poBridge')
  const rest = params.toString()
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}#${path}${rest ? '?' + rest : ''}`)
  const match = /^(\d{1,5})\.([A-Za-z0-9_-]{43})\.(read|compare)$/.exec(value)
  if (!match || Number(match[1]) < 1 || Number(match[1]) > 65535) return
  return { port: Number(match[1]), ticket: match[2], access: match[3] as BrowserAccess }
}

let initialBrowserAuthorization = captureAuthorization()
export function takeBrowserAuthorization() {
  const authorization = captureAuthorization() ?? initialBrowserAuthorization
  initialBrowserAuthorization = undefined
  return authorization
}

export function browserLabel(): string {
  const agent = navigator.userAgent
  return /Firefox\//.test(agent) ? 'Firefox' : /Edg\//.test(agent) ? 'Edge' : /Chrome\//.test(agent) ? 'Chromium' : 'Browser'
}

export function connectBrowserPage(host: BrowserBridgeHost, authorization: PageAuthorization, label: string, productVersion: string,
  changed: (state: 'connecting' | 'connected' | 'disconnected', error?: string) => void) {
  let socket: WebSocket | undefined
  let session: BrowserSourceSession | undefined
  let stopped = false
  let authorizedSourceId: string | undefined
  let chain = Promise.resolve()
  const pageId = randomUUID()
  const close = () => {
    if (stopped) return
    stopped = true
    clearTimeout(deadline)
    session?.dispose()
    session = undefined
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'revoke' }))
    socket?.close()
    window.removeEventListener('pagehide', close)
    changed('disconnected')
  }
  const fail = (code: string) => { close(); changed('disconnected', code) }
  const send = (value: unknown) => {
    if (stopped || socket?.readyState !== WebSocket.OPEN) return
    const json = JSON.stringify(value)
    if (new TextEncoder().encode(json).byteLength > BROWSER_BRIDGE_MAX_BYTES) throw new BrowserBridgeError('RESULT_STORAGE_LIMIT')
    socket.send(json)
  }

  async function handle(message: Record<string, unknown>, contextId: string) {
    if (stopped) return
    if (message.type === 'authorized') {
      if (message.access !== authorization.access || typeof message.sourceId !== 'string') throw new BrowserBridgeError('AUTHORIZATION_FAILED')
      authorizedSourceId = message.sourceId
      clearTimeout(deadline)
      changed('connected')
      return
    }
    if (!authorizedSourceId || message.type !== 'request' || typeof message.id !== 'string' || typeof message.name !== 'string' ||
      !message.input || typeof message.input !== 'object' || Array.isArray(message.input)) throw new BrowserBridgeError('INVALID_MESSAGE')
    try {
      const input = message.input as Record<string, unknown>
      let result: unknown
      if (message.name === '__ping') result = { ready: true }
      else if (message.name === 'open') {
        const source = input.executionSource as ComparisonExecutionSource
        if (!source || source.kind !== 'browser' || source.sourceId !== authorizedSourceId || source.sourceEpoch !== pageId ||
          source.label !== label || !/^[a-f0-9-]{36}$/.test(source.connectionGeneration) || input.contextId !== contextId ||
          !['read', 'compare'].includes(input.access as string) || (input.access === 'compare' && authorization.access !== 'compare')) {
          throw new BrowserBridgeError('AUTHORIZATION_FAILED')
        }
        session?.dispose()
        session = host.open(source, input.access as BrowserAccess, contextId)
        result = { ready: true }
      } else if (message.name === 'close') {
        session?.dispose(); session = undefined
        result = { closed: true }
      } else {
        if (!session) throw new BrowserBridgeError('CONNECTION_CLOSED')
        result = await session.call(message.name, input)
      }
      send({ type: 'reply', id: message.id, result })
    } catch (error) {
      const code = publicBrowserError(error)
      send({ type: 'reply', id: message.id, error: code })
      if (code === 'SOURCE_CONTEXT_CHANGED') fail(code)
    }
  }

  const deadline = setTimeout(() => fail('BRIDGE_CONNECT_FAILED'), 8_000)
  changed('connecting')
  if (window.top !== window.self) { fail('AUTHORIZATION_TOP_LEVEL_REQUIRED'); return { close } }
  window.addEventListener('pagehide', close)
  void host.contextId().then(contextId => {
    if (stopped) return
    socket = new WebSocket(`ws://127.0.0.1:${authorization.port}/bridge`)
    socket.onopen = () => send({ type: 'authorize', protocol: BROWSER_BRIDGE_PROTOCOL, ticket: authorization.ticket, access: authorization.access,
      identity: { contextId, pageId, browser: browserLabel(), label, productVersion } })
    socket.onmessage = event => {
      chain = chain.then(async () => {
        if (typeof event.data !== 'string' || new TextEncoder().encode(event.data).byteLength > BROWSER_BRIDGE_MAX_BYTES) throw new BrowserBridgeError('INVALID_MESSAGE')
        await handle(JSON.parse(event.data) as Record<string, unknown>, contextId)
      }).catch(() => fail('INVALID_MESSAGE'))
    }
    socket.onclose = () => { if (!stopped) fail('BRIDGE_DISCONNECTED') }
    socket.onerror = () => fail('BRIDGE_CONNECT_FAILED')
  }).catch(error => fail(publicBrowserError(error)))
  return { close }
}
