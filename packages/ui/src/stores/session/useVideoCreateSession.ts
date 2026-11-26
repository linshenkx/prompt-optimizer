import { computed, ref, shallowRef, watch } from 'vue'
import { defineStore } from 'pinia'
import { v4 as uuid } from 'uuid'
import {
  createDefaultVideoCreateState, createSeedanceService, isVideoParams, readVideoSession, videoReferenceError, VIDEO_CREATE_SESSION_KEY,
  ARK_VIDEO_BASE_URL, seedancePromptText, videoRunKey, videoRunVariant, videoTokenRate,
  type PromptRecord, type ImageInputRef, type VideoImageRef, type VideoParams, type VideoRun, type VideoService, type VideoVariantId,
} from '@prompt-optimizer/core'
import { getPiniaServices } from '../../plugins/pinia'
import { persistImagePayloadAsAssetId } from '../../utils/image-asset-storage'
import { pauseImageStorageGc, queueImageStorageMaintenance } from './imageStorageMaintenance'
import { createSessionSnapshotWriter, hasSessionConflict, readSessionSnapshot, runSessionWrite, type SessionWritePermit } from './sessionPersistence'

export { createDefaultVideoCreateState }
export type { VideoCreateSessionState } from '@prompt-optimizer/core'
export { VIDEO_CREATE_SESSION_KEY }
const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v))
export const isVideoExtension = () => typeof location !== 'undefined' && ['chrome-extension:', 'moz-extension:'].includes(location.protocol)
export function getVideoService(): VideoService {
  const preferences = getPiniaServices()?.preferenceService
  if (!preferences || isVideoExtension()) throw new Error('video.error.unavailable')
  return window.electronAPI?.video ?? createSeedanceService(preferences)
}
export const useVideoCreateSession = defineStore('video-create-session', () => {
  const state = ref(createDefaultVideoCreateState())
  const history = shallowRef<PromptRecord[]>([])
  const historyReady = ref(false)
  let historyRequest = 0
  const refreshHistory = async () => {
    const request = ++historyRequest
    historyReady.value = false
    const records = await getPiniaServices()?.historyManager?.getRecords() ?? []
    if (request !== historyRequest) return
    const videoChains = new Set(records.filter(r => r.type === 'videoOptimize').map(r => r.chainId))
    history.value = records.filter(r => videoChains.has(r.chainId))
    historyReady.value = true
  }
  const historyById = computed(() => new Map(history.value.map(record => [record.id, record])))
  const currentVersion = computed(() => {
    const { currentVersionId, originalPrompt, optimizedPrompt, lastGeneratedPrompt } = state.value
    if (currentVersionId !== undefined) return currentVersionId ? historyById.value.get(currentVersionId) : undefined
    // Older sessions had no record ID. Only attach a chain when the saved text identifies it uniquely.
    const saved = (lastGeneratedPrompt || optimizedPrompt).trim()
    if (!saved) return undefined
    const matches = history.value.filter(r => r.originalPrompt.trim() === originalPrompt.trim() && r.optimizedPrompt.trim() === saved)
    return matches.length === 1 ? matches[0] : undefined
  })
  watch(currentVersion, record => {
    if (record) {
      if (state.value.currentVersionId === undefined) state.value.currentVersionId = record.id
      state.value.currentChainId = record.chainId
    }
  })
  const versions = computed(() => {
    const chainId = currentVersion.value?.chainId ?? state.value.currentChainId
    return chainId ? history.value.filter(record => record.chainId === chainId).sort((a, b) => a.version - b.version) : []
  })
  const draftParams = computed(() => {
    const recorded = currentVersion.value?.metadata?.videoParams
    return state.value.draftParams ?? (isVideoParams(recorded) ? recorded : undefined)
  })
  const updateParams = (change: Partial<VideoParams>) => {
    const draft = state.value
    // Older pasted drafts have no recorded settings. Remember the settings the user is changing.
    if (draft.optimizedPrompt.trim() && !draftParams.value) draft.draftParams = { ...draft.params }
    Object.assign(draft.params, change)
  }
  const submittingKey = ref<string>()
  const submitting = computed(() => !!submittingKey.value)
  const queryingKeys = ref(new Set<string>())
  const querying = computed(() => queryingKeys.value.size > 0)
  const isQuerying = (run: VideoRun) => queryingKeys.value.has(videoRunKey(run))
  const displayStatus = (run: VideoRun) =>
    run.status === 'submitting' && submittingKey.value !== videoRunKey(run) ? 'unknown' : run.status
  const optimizing = ref(false)
  const iterating = ref(false)
  const busy = computed(() => submitting.value || optimizing.value || iterating.value)
  const activeRuns = computed(() => state.value.runs.filter(r => ['submitting','unknown','queued','running'].includes(r.status)))
  const activeRun = computed(() => activeRuns.value[0])
  const activeFor = (id: VideoVariantId) => activeRuns.value.find(run => videoRunVariant(run) === id)
  const writer = createSessionSnapshotWriter(() => ({ ...state.value }))
  const imageLeases = new Set<() => void>()
  const reset = () => { state.value = createDefaultVideoCreateState() }

  const restoreSession = async () => {
    const service = getPiniaServices()?.preferenceService
    if (!service || busy.value || querying.value) return
    const before = JSON.stringify(state.value)
    const raw = await readSessionSnapshot<unknown>(service, VIDEO_CREATE_SESSION_KEY, null)
    if (busy.value || querying.value || before !== JSON.stringify(state.value)) return
    if (raw) state.value = readVideoSession(typeof raw === 'string' ? JSON.parse(raw) : raw)
    else reset()
    writer.restored(service, VIDEO_CREATE_SESSION_KEY)
  }
  const saveSession = async (permit?: SessionWritePermit) => {
    const service = getPiniaServices()?.preferenceService
    if (!service) return false
    const captured = writer.capture()
    const value = { ...copy(state.value), lastActiveAt: Date.now() }
    const leases = [...imageLeases]
    return runSessionWrite(service, async () => {
      await writer.write(service, VIDEO_CREATE_SESSION_KEY, value, captured)
      for (const release of leases) { imageLeases.delete(release); release() }
    }, permit, 'video-create')
  }
  const addImages = async (images: { name: string; payload: ImageInputRef }[]) => {
    const release = pauseImageStorageGc()
    try {
      const refs = await queueImageStorageMaintenance(async () => Promise.all(images.map(async ({ name, payload }) => {
        const id = await persistImagePayloadAsAssetId({ payload: { ...payload, mimeType: payload.mimeType || 'image/png' },
          storageService: getPiniaServices()?.imageStorageService, sourceType: 'uploaded' })
        if (!id) throw new Error('video.error.references')
        return { _type: 'image-ref', id, name, role: 'character' } as VideoImageRef
      })))
      if (refs.length + state.value.images.length > 4) throw new Error('video.error.references')
      state.value.images.push(...refs)
    } catch (error) { release(); throw error }
    imageLeases.add(release)
    if (!await saveSession()) throw new Error('video.error.save')
  }
  const resolveImages = async (refs: VideoImageRef[]) => Promise.all(refs.map(async ref => {
    const asset = await getPiniaServices()?.imageStorageService?.getImage(ref.id)
    if (!asset) throw new Error('video.error.missingImage')
    return { role: ref.role, b64: asset.data, mimeType: asset.metadata.mimeType }
  }))
  const prepareRun = (model: string, configId?: string, baseURL?: string,
    variantId: VideoVariantId = 'b', prompt = state.value.optimizedPrompt, modelName?: string) => {
    const { columns, images, params } = state.value
    const error = videoReferenceError(images.map(i => i.role))
    if (error) throw new Error(`video.error.${error}`)
    if (!prompt.trim()) throw new Error('video.error.prompt')
    return copy({ localId: uuid(), variantId, source: columns[variantId].source, prompt, submittedPrompt: seedancePromptText(prompt, images),
      model, modelName, configId, baseURL,
      cnyPerMillionTokens: videoTokenRate(model, baseURL ?? (configId ? undefined : ARK_VIDEO_BASE_URL)),
      images, params, status: 'submitting', submittedAt: Date.now() } satisfies VideoRun)
  }
  const submit = async (draft: VideoRun) => {
    const variant = videoRunVariant(draft)
    const key = videoRunKey(draft)
    if (submitting.value || activeFor(variant) || state.value.runs.some(run => videoRunKey(run) === key)) return
    submittingKey.value = key
    try {
      const service = getVideoService()
      const references = (await resolveImages(draft.images)).map(i => ({ role: i.role, url: `data:${i.mimeType};base64,${i.b64}` }))
      const column = state.value.columns[variant]
      const previousSelection = column.selectedRunKey
      const previousConfigId = column.configId
      if (!column.configId && draft.configId) column.configId = draft.configId
      delete column.selectedRunKey
      state.value.runs.unshift(copy(draft))
      const run = state.value.runs[0]
      try {
        if (!await saveSession()) throw new Error('video.error.save')
      } catch (error) {
        state.value.runs = state.value.runs.filter(item => videoRunKey(item) !== key)
        column.configId = previousConfigId
        column.selectedRunKey = previousSelection
        throw error
      }
      try {
        run.id = await service.create({ model: run.model, configId: run.configId, baseURL: run.baseURL, params: copy(run.params), prompt: run.prompt, references })
        run.status = 'queued'
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause)
        run.status = /Ark HTTP 4(?!08)\d\d|video\.error\.(?:key|request|frames|references|configMissing|configChanged)/.test(message) ? 'failed' : 'unknown'
        run.error = message
      }
      try {
        if (!await saveSession()) throw new Error('video.error.save')
      } catch (error) {
        // A second window may edit the draft while the provider accepts the paid task.
        // Retain the returned ID without overwriting that window's draft or clearing its conflict.
        const prefs = getPiniaServices()?.preferenceService
        if (run.id && prefs?.compareAndSet && hasSessionConflict(prefs, VIDEO_CREATE_SESSION_KEY)) {
          const latest = await prefs.get(VIDEO_CREATE_SESSION_KEY, null as typeof state.value | null)
          const pending = latest?.runs?.find(item => videoRunKey(item) === key && !item.id)
          if (latest && pending) {
            const runs = latest.runs.map(item => item === pending ? { ...item, id: run.id, status: run.status } : item)
            await prefs.compareAndSet(VIDEO_CREATE_SESSION_KEY, latest, { ...latest, runs })
          }
        }
        throw error
      }
    } finally { submittingKey.value = undefined }
  }
  const refresh = async (run: VideoRun) => {
    if (!run.id || isQuerying(run)) return
    queryingKeys.value.add(videoRunKey(run))
    try {
      const result = await getVideoService().query(run.id, run.configId, run.baseURL)
      Object.assign(run, result)
      if (!await saveSession()) throw new Error('video.error.save')
    } finally { queryingKeys.value.delete(videoRunKey(run)) }
  }
  const cancel = async (run: VideoRun) => {
    if (!run.id || run.status !== 'queued' || isQuerying(run)) return
    queryingKeys.value.add(videoRunKey(run))
    try {
      await getVideoService().cancel(run.id, run.configId, run.baseURL)
      run.status = 'cancelled'
      if (!await saveSession()) throw new Error('video.error.save')
    } finally { queryingKeys.value.delete(videoRunKey(run)) }
  }
  const updateTemplate = (id: string | null) => { state.value.selectedTemplateId = id }
  const updateIterateTemplate = (id: string | null) => { state.value.selectedIterateTemplateId = id }
  const applyPrompt = (brief: string, prompt: string, params?: unknown, currentVersionId: string | null = null, currentChainId: string | null = null) => {
    Object.assign(state.value, { originalPrompt: brief, optimizedPrompt: prompt, currentVersionId, currentChainId, lastGeneratedPrompt: currentVersionId ? prompt : '',
      evaluation: null, images: [], draftParams: isVideoParams(params) && prompt.trim() ? { ...params } : undefined,
      ...(isVideoParams(params) ? { params: copy(params) } : {}) })
  }
  return { state, versions, currentVersion, historyById, historyReady, draftParams, updateParams, refreshHistory, reset, updateTemplate, updateIterateTemplate, applyPrompt, saveSession, restoreSession, addImages, resolveImages, prepareRun, submit, refresh, cancel,
    activeRun, activeRuns, activeFor, displayStatus, isQuerying, busy, optimizing, iterating, querying, submitting }
})
export type VideoCreateSessionApi = ReturnType<typeof useVideoCreateSession>
