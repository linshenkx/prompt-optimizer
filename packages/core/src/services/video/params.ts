import type { VideoCapabilityMode, VideoInputContext, VideoModelSpec, VideoParamDefinition, VideoParams, VideoParamValue, VideoReferenceRole } from './types'

export type VideoCompatibility = { compatible: true } | {
  compatible: false
  kind: 'unsupported' | 'missing-input' | 'invalid-input'
  reasonKey: string
  params?: Record<string, number>
}
export function checkVideoInputCompatibility(spec: Pick<VideoModelSpec, 'capabilities'>, mode: VideoCapabilityMode,
  images: VideoInputContext['images']): VideoCompatibility {
  const caps = spec.capabilities
  const unsupported = (key: string, params?: Record<string, number>): VideoCompatibility =>
    ({ compatible: false, kind: 'unsupported', reasonKey: 'video.error.' + key, params })
  const missing = (key: string): VideoCompatibility =>
    ({ compatible: false, kind: 'missing-input', reasonKey: 'video.error.' + key })
  const invalid = (key: string): VideoCompatibility =>
    ({ compatible: false, kind: 'invalid-input', reasonKey: 'video.error.' + key })
  if (mode === 'text2video') {
    if (!caps.text2video) return unsupported('noTextToVideo')
    if (images.length) return invalid('request')
  } else if (mode === 'frames') {
    const first = images.filter(image => image.role === 'first_frame').length
    const last = images.filter(image => image.role === 'last_frame').length
    if (!caps.firstFrame) return unsupported('noFirstFrame')
    if (last && !caps.firstLastFrame) return unsupported('noLastFrame')
    if (first > 1 || last > 1 || images.length !== first + last) return invalid('frames')
    if (!first) return missing('firstFrameRequired')
  } else {
    if (!caps.maxReferenceImages) return unsupported('noReferences')
    if (images.some(image => image.role !== 'reference_image')) return invalid('references')
    if (!images.length) return missing('referencesRequired')
    if (images.length > caps.maxReferenceImages) return unsupported('tooManyReferences', { max: caps.maxReferenceImages })
  }
  return { compatible: true }
}

export function inferVideoCapabilityMode(images: readonly { role: VideoReferenceRole }[]): VideoCapabilityMode {
  if (!images.length) return 'text2video'
  return images.some(image => image.role === 'reference_image') ? 'references' : 'frames'
}

function resolveValue(def: VideoParamDefinition, value: VideoParamValue): VideoParamValue {
  if (def.kind === 'enum') return typeof value !== 'boolean' && def.options.includes(value) ? value : def.defaultValue
  if (def.kind === 'boolean') return typeof value === 'boolean' ? value : def.defaultValue
  if (typeof value !== 'number' || !Number.isFinite(value)) return def.defaultValue
  const steps = Math.round((value - def.min) / def.step)
  const maximumSteps = Math.floor((def.max - def.min) / def.step)
  return def.min + Math.min(maximumSteps, Math.max(0, steps)) * def.step
}

function reconcile(definitions: readonly VideoParamDefinition[], draft: VideoParams): VideoParams {
  return Object.fromEntries(definitions.map(def => [def.key, resolveValue(def, draft[def.key])]))
}

export function resolveVideoParams(spec: VideoModelSpec, draft: VideoParams, context: VideoInputContext) {
  const base = reconcile(spec.params, draft)
  const definitions = spec.resolveParams?.(base, context) ?? spec.params
  return { definitions, params: reconcile(definitions, base) }
}

function signature(def: VideoParamDefinition): string {
  if (def.kind === 'enum') return JSON.stringify([def.kind, [...def.options].sort()])
  if (def.kind === 'int-range') return JSON.stringify([def.kind, def.min, def.max, def.step])
  return def.kind
}

export function partitionVideoColumnParams<T extends string>(
  columns: readonly { variantId: T; definitions: readonly VideoParamDefinition[] }[],
  splitParams: readonly string[],
) {
  const comparable = (columns[0]?.definitions ?? []).filter(def =>
    columns.every(column => column.definitions.some(candidate => candidate.key === def.key && signature(candidate) === signature(def))))
  const shared = comparable.filter(def => !splitParams.includes(def.key))
  const sharedKeys = new Set(shared.map(def => def.key))
  return {
    shared,
    perColumn: Object.fromEntries(columns.map(({ variantId, definitions }) =>
      [variantId, definitions.filter(def => !sharedKeys.has(def.key))])) as Partial<Record<T, VideoParamDefinition[]>>,
    mergeableSplitKeys: comparable.filter(def => splitParams.includes(def.key)).map(def => def.key),
  }
}

export function totalVideoCosts(costs: readonly (import('./types').VideoCostEstimate | null | undefined)[]) {
  const totals = new Map<import('./types').VideoCostEstimate['currency'], number>()
  for (const cost of costs) {
    if (cost) totals.set(cost.currency, (totals.get(cost.currency) ?? 0) + cost.amount)
  }
  return totals
}
