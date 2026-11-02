import type { ImageRef } from '../image/types'
import { v4 as uuidv4 } from 'uuid'

export interface ArenaContestant {
  id: string
  kind: 'text' | 'image'
  configKey: string
  modelId: string
}
/** Persisted provenance deliberately excludes connection credentials. */
export interface ArenaEffectiveConfig {
  providerId: string
  modelId: string
  connection: Record<string, unknown>
  parameters: Record<string, unknown>
}
export interface ArenaResult {
  runId: string
  fingerprint: string
  prompt: string
  inputs: ImageRef[]
  model: ArenaContestant
  effective?: ArenaEffectiveConfig
  status: 'running' | 'success' | 'error' | 'cancelled'
  output: { result: string; reasoning: string; status?: 'streaming' | 'complete' | 'cancelled' | 'capacity' | 'failed' }
  images: ImageRef[]
  error?: string
  startedAt: number
}
export interface ArenaState {
  schemaVersion: 1
  prompt: string
  images: ImageRef[]
  contestants: ArenaContestant[]
  results: Record<string, ArenaResult>
  lastActiveAt: number
}
export const createArenaContestant = (base?: ArenaContestant): ArenaContestant => ({
  id: uuidv4(), kind: base?.kind || 'text', configKey: base?.configKey || '',
  modelId: base?.modelId || '',
})
export const createArenaState = (): ArenaState => ({
  schemaVersion: 1, prompt: '', images: [], contestants: [createArenaContestant(), createArenaContestant()],
  results: {}, lastActiveAt: Date.now(),
})
const record = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)
const refs = (x: unknown): x is ImageRef[] => Array.isArray(x) && x.every(i => record(i) && i._type === 'image-ref' && typeof i.id === 'string' && !!i.id)
const contestant = (x: unknown): x is ArenaContestant => record(x) && typeof x.id === 'string' && /^[\w-]{1,100}$/.test(x.id) &&
  (x.kind === 'text' || x.kind === 'image') && typeof x.configKey === 'string' && typeof x.modelId === 'string'
const effective = (x: unknown) => record(x) && typeof x.providerId === 'string' && typeof x.modelId === 'string' && record(x.connection) && record(x.parameters)
export const isArenaState = (x: unknown): x is ArenaState => {
  if (!record(x) || x.schemaVersion !== 1 || typeof x.prompt !== 'string' || !refs(x.images) ||
    !Array.isArray(x.contestants) || x.contestants.length < 1 || !x.contestants.every(contestant) ||
    new Set(x.contestants.map(c => c.id)).size !== x.contestants.length || !record(x.results) ||
    typeof x.lastActiveAt !== 'number' || !Number.isFinite(x.lastActiveAt)) return false
  const contestants = x.contestants
  return Object.entries(x.results).every(([id, r]) => record(r) && contestants.some(c => c.id === id) &&
    typeof r.runId === 'string' && typeof r.fingerprint === 'string' && typeof r.prompt === 'string' && refs(r.inputs) &&
    contestant(r.model) && r.model.id === id && record(r.output) && typeof r.output.result === 'string' && typeof r.output.reasoning === 'string' &&
    (r.output.status === undefined || ['streaming', 'complete', 'cancelled', 'capacity', 'failed'].includes(String(r.output.status))) &&
    // Accept the old queued status only to recover interrupted sessions.
    (r.effective === undefined || effective(r.effective)) && refs(r.images) && ['queued', 'running', 'success', 'error', 'cancelled'].includes(String(r.status)) &&
    typeof r.startedAt === 'number' && Number.isFinite(r.startedAt) && (r.error === undefined || typeof r.error === 'string'))
}
/** Drop retired controls while preserving saved inputs and historical outputs. */
export const normalizeArenaState = (value: ArenaState): ArenaState => {
  const model = ({ id, kind, configKey, modelId }: ArenaContestant): ArenaContestant => ({ id, kind, configKey, modelId })
  return {
    schemaVersion: 1, prompt: value.prompt, images: value.images, lastActiveAt: value.lastActiveAt,
    contestants: value.contestants.map(model),
    results: Object.fromEntries(Object.entries(value.results).map(([id, result]) => [id, {
      ...result, model: model(result.model),
      ...(['queued', 'running'].includes(result.status) ? { status: 'error' as const, error: 'arena.interrupted' } : {}),
    }])),
  }
}
const stable = (value: unknown): unknown => Array.isArray(value) ? value.map(stable) : record(value)
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value
export const arenaFingerprint = (prompt: string, images: ImageRef[], model: ArenaContestant, effective?: ArenaEffectiveConfig): string =>
  JSON.stringify(stable({ prompt, images, model, effective }))
