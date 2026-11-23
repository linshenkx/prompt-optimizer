import type { BrowserAccess } from '@prompt-optimizer/core/bridge-protocol'

export interface PageAuthorization { port: number; ticket: string; access: BrowserAccess; registeredLabel?: string }

function captureAuthorization(): PageAuthorization | undefined {
  if (typeof window === 'undefined') return
  const [path, query] = window.location.hash.slice(1).split('?')
  const params = new URLSearchParams(query)
  const value = params.get('poBridge')
  if (!value) return
  const registeredLabel = params.get('poBridgeLabel')
  params.delete('poBridge')
  params.delete('poBridgeLabel')
  const rest = params.toString()
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}#${path}${rest ? '?' + rest : ''}`)
  const match = /^(\d{1,5})\.([A-Za-z0-9_-]{43})\.(read|compare|business)$/.exec(value)
  if (!match || Number(match[1]) < 1 || Number(match[1]) > 65535) return
  return { port: Number(match[1]), ticket: match[2], access: match[3] as BrowserAccess,
    ...(registeredLabel && registeredLabel.length <= 100 ? { registeredLabel } : {}) }
}

let initialBrowserAuthorization = captureAuthorization()
export function takeBrowserAuthorization() {
  const authorization = captureAuthorization() ?? initialBrowserAuthorization
  initialBrowserAuthorization = undefined
  return authorization
}
