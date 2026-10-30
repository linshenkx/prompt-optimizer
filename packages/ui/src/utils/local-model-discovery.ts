import { canAutoEnableChromeBuiltInConfig, CHROME_BUILT_IN_PROVIDER_ID, CHROME_BUILT_IN_MODEL_ID,
  checkChromeBuiltInAvailability, type LocalServiceResult, type TextModelConfig } from '@prompt-optimizer/core'

export type DiscoveredLocalService = LocalServiceResult | {
  kind: 'chrome-built-in'; name: string; baseURL: ''; status: 'ready'
  models: { id: string; name: string }[]
  availability: 'available' | 'downloadable' | 'downloading'
}

// Keep the persisted built-in identity, but don't show its untouched disabled
// placeholder alongside the discovery shortcut. Explicitly disabled entries stay.
export const isChromeBuiltInPlaceholder = (model: TextModelConfig) => canAutoEnableChromeBuiltInConfig(model)

export function hasDiscoveredService(models: TextModelConfig[], service: DiscoveredLocalService) {
  if (service.kind === 'chrome-built-in') {
    return models.some(model => (model.providerId === CHROME_BUILT_IN_PROVIDER_ID
      || model.providerMeta?.id === CHROME_BUILT_IN_PROVIDER_ID) && !isChromeBuiltInPlaceholder(model))
  }
  return hasLocalServiceAddress(models, service.baseURL)
}

export async function discoverChromeBuiltIn(): Promise<DiscoveredLocalService | undefined> {
  const { availability } = await checkChromeBuiltInAvailability()
  if (!['available', 'downloadable', 'downloading'].includes(availability)) return
  return {
    kind: 'chrome-built-in', name: 'Chrome AI', baseURL: '', status: 'ready',
    availability: availability as 'available' | 'downloadable' | 'downloading',
    models: [{ id: CHROME_BUILT_IN_MODEL_ID, name: 'Gemini Nano' }],
  }
}


export function normalizeLocalServiceAddress(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return ''
  try {
    const url = new URL(value.trim())
    if (!['http:', 'https:'].includes(url.protocol)) return ''
    if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) url.hostname = 'localhost'
    // Both the service root and its OpenAI-compatible /v1 address denote the same connection.
    const path = url.pathname.replace(/\/+$/, '')
    return `${url.origin}${path === '/v1' ? '' : path}${url.search}`
  } catch { return '' }
}

export function hasLocalServiceAddress(models: TextModelConfig[], address: string) {
  const normalized = normalizeLocalServiceAddress(address)
  return !!normalized && models.some(model => normalizeLocalServiceAddress(model.connectionConfig?.baseURL) === normalized)
}
