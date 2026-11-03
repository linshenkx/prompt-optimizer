import { computed, ref, shallowRef, watch } from 'vue'
import { defineStore } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import {
  arenaFingerprint, createArenaState, createArenaContestant, isArenaState, normalizeArenaState, resolveRuntimeTextModel, resolveRuntimeImageModel, describeRuntimeModel,
  createImageUnderstandingService, ElectronImageUnderstandingServiceProxy, isRunningInElectron,
  type ArenaContestant, type ArenaResult, type ImageRef, type ImageInputRef, type StreamHandlers,
  type TextModelConfig, type ImageModelConfig,
} from '@prompt-optimizer/core'
import { getPiniaServices } from '../../plugins/pinia'
import { createSessionSnapshotWriter, readSessionSnapshot, runSessionWrite, type SessionWritePermit } from './sessionPersistence'
import { pauseImageStorageGc, queueImageStorageMaintenance } from './imageStorageMaintenance'
import { persistGeneratedImage, persistImagePayloadAsAssetId } from '../../utils/image-asset-storage'
import { beginOutputStream, getOutputDocument, restoredOutputStatus } from '../../utils/output-document'

const KEY = 'session/v1/arena'
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value))

/** Store-owned jobs survive navigation. Saved state contains references, never payloads or credentials. */
export const useArenaSession = defineStore('arena-session', () => {
  const state = ref(createArenaState())
  const saveError = ref('')
  const configurations = shallowRef<{ text: TextModelConfig[]; image: ImageModelConfig[] }>({ text: [], image: [] })
  let refreshVersion = 0
  const refreshConfigs = async () => {
    const services = getPiniaServices()
    if (!services) return
    const version = ++refreshVersion
    const [text, image] = await Promise.all([services.modelManager.getAllModels(), services.imageModelManager?.getAllConfigs() || []])
    if (version === refreshVersion) configurations.value = { text: text.filter(m => m.enabled), image: image.filter(m => m.enabled) }
  }
  const resolveConfig = (model: ArenaContestant) => {
    const services = getPiniaServices()
    if (model.kind === 'text') {
      const base = configurations.value.text.find(c => c.id === model.configKey)
      return base && services?.textAdapterRegistry ? resolveRuntimeTextModel(base, { modelId: model.modelId }, services.textAdapterRegistry) : undefined
    }
    const base = configurations.value.image.find(c => c.id === model.configKey)
    return base && services?.imageAdapterRegistry ? resolveRuntimeImageModel(base, { modelId: model.modelId }, services.imageAdapterRegistry) : undefined
  }
  let invalidSnapshot = false
  let hydrating = false
  const pendingGcResumes = new Set<() => void>()
  const controllers = new Map<string, AbortController>()
  const pendingJobs = ref(0)
  const running = computed(() => pendingJobs.value > 0)
  const lastActiveAt = computed(() => state.value.lastActiveAt)
  const writer = createSessionSnapshotWriter(() => ({ ...state.value }))
  // Call only with session access already held (lock order: access, then image queue).
  const persistSnapshot = async () => {
    const service = getPiniaServices()?.preferenceService
    if (!service || invalidSnapshot) return false
    const releasable = [...pendingGcResumes]
    try {
      await writer.write(service, KEY, state.value)
      saveError.value = ''
      for (const release of releasable) { pendingGcResumes.delete(release); release() }
      return true
    } catch (error) {
      saveError.value = String(error)
      return false
    }
  }
  const saveSession = (permit?: SessionWritePermit) => runSessionWrite(getPiniaServices()?.preferenceService, persistSnapshot, permit)

  const restoreSession = async () => {
    if (running.value) return
    const service = getPiniaServices()?.preferenceService
    if (!service) return
    const before = JSON.stringify(state.value)
    const raw = await readSessionSnapshot<unknown>(service, KEY, null)
    // Edits and even already-completed tasks during this read must survive hydration.
    if (running.value || before !== JSON.stringify(state.value)) return
    let value: unknown
    try { value = typeof raw === 'string' ? JSON.parse(raw) : raw } catch { value = undefined }
    if (value !== null && !isArenaState(value)) {
      invalidSnapshot = true
      saveError.value = 'arena.invalidSession'
      throw new Error('arena.invalidSession')
    }
    invalidSnapshot = false
    hydrating = true
    state.value = value ? normalizeArenaState(copy(value as ReturnType<typeof createArenaState>)) : createArenaState()
    for (const result of Object.values(state.value.results)) {
      result.output.status = restoredOutputStatus(result.output.status).status
    }
    writer.restored(service, KEY)
    hydrating = false
  }

  const isStale = (id: string) => {
    const model = state.value.contestants.find(c => c.id === id)
    const result = state.value.results[id]
    if (!result || !model) return false
    try {
      const config = resolveConfig(model)
      return !config || !result.effective || result.fingerprint !== arenaFingerprint(state.value.prompt, state.value.images, model, describeRuntimeModel(config))
    } catch { return true }
  }
  const resolveImages = async (refs: ImageRef[]): Promise<ImageInputRef[]> => Promise.all(refs.map(async image => {
    const stored = await getPiniaServices()?.imageStorageService?.getImage(image.id)
    if (!stored) throw new Error('arena.missingImage')
    return { b64: stored.data, mimeType: stored.metadata.mimeType }
  }))

  const writeInput = async (images: ImageInputRef[], prompt?: string) => runSessionWrite(getPiniaServices()?.preferenceService, () => queueImageStorageMaintenance(async () => {
    if (prompt !== undefined && running.value) throw new Error('arena.inputBusy')
    const release = pauseImageStorageGc()
    const storageService = getPiniaServices()?.imageStorageService
    const refs: ImageRef[] = []
    let attached = false
    try {
      for (const payload of images) {
        const id = await persistImagePayloadAsAssetId({ payload: { ...payload, mimeType: payload.mimeType || 'image/png' }, storageService, sourceType: 'uploaded' })
        if (!id) throw new Error('arena.missingImage')
        refs.push({ id, _type: 'image-ref' })
      }
      if (prompt !== undefined) {
        if (running.value) throw new Error('arena.inputBusy')
        state.value.prompt = prompt
        state.value.images = refs
      } else state.value.images.push(...refs)
      attached = true
      // Only a snapshot containing these references may release their lease.
      pendingGcResumes.add(release)
      return await persistSnapshot()
    } finally {
      // Failed uploads have no live references to protect. Failed snapshot writes do.
      if (!attached) { pendingGcResumes.delete(release); release() }
    }
  }))
  const addImages = (images: ImageInputRef[]) => writeInput(images)
  const replaceInput = (prompt: string, images: ImageInputRef[] = []) => writeInput(images, prompt)

  const busy = (id: string) => state.value.results[id]?.status === 'running'
  const cancellable = (id: string) => {
    const result = state.value.results[id]
    return result?.model.kind === 'text' && !(isRunningInElectron() && result.inputs.length)
  }
  const stop = (id: string) => {
    if (!busy(id) || !cancellable(id)) return
    const result = state.value.results[id]
    result.status = 'cancelled'
    getOutputDocument(result.output)?.interrupt()
    controllers.get(id)?.abort()
  }
  const run = async (id: string) => {
    const services = getPiniaServices()
    const original = state.value.contestants.find(c => c.id === id)
    if (!services || !original || busy(id)) return
    const model = copy(original)
    const result: ArenaResult = {
      runId: uuidv4(), fingerprint: '', prompt: state.value.prompt, inputs: copy(state.value.images), model,
      status: 'running', output: { result: '', reasoning: '' }, images: [], startedAt: Date.now(),
    }
    state.value.results[id] = result
    const live = state.value.results[id]
    const controller = new AbortController()
    controllers.set(id, controller)
    pendingJobs.value++
    const resumeGc = pauseImageStorageGc()
    const current = () => state.value.results[id]?.runId === result.runId && !controller.signal.aborted
    try {
      await (async () => {
        if (!current()) return
        live.status = 'running'
        if (!result.prompt.trim() || !model.modelId || !model.configKey) throw new Error('arena.incomplete')
        // Each request starts immediately and freezes its saved configuration in memory.
        const base = model.kind === 'text' ? await services.modelManager.getModel(model.configKey)
          : await services.imageModelManager?.getConfig(model.configKey)
        if (!current()) return
        if (!base?.enabled) throw new Error('arena.unavailable')
        let config: TextModelConfig | ImageModelConfig
        if (model.kind === 'text' && services.textAdapterRegistry) {
          config = resolveRuntimeTextModel(copy(base as TextModelConfig), { modelId: model.modelId }, services.textAdapterRegistry)
          configurations.value = { ...configurations.value, text: [...configurations.value.text.filter(c => c.id !== base.id), base as TextModelConfig] }
        } else if (model.kind === 'image' && services.imageAdapterRegistry) {
          config = resolveRuntimeImageModel(copy(base as ImageModelConfig), { modelId: model.modelId }, services.imageAdapterRegistry)
          configurations.value = { ...configurations.value, image: [...configurations.value.image.filter(c => c.id !== base.id), base as ImageModelConfig] }
        } else throw new Error('arena.unavailable')
        live.effective = describeRuntimeModel(config)
        live.fingerprint = arenaFingerprint(result.prompt, result.inputs, model, live.effective)
        const inputs = await resolveImages(result.inputs)
        if (!current()) return
        const stream = beginOutputStream(live.output, useArenaSession(), id)
        stream.signal.addEventListener('abort', () => {
          if (current() && stream.document.phase === 'cancelled') { live.status = 'cancelled'; controller.abort() }
        }, { once: true })
        try {
          if (model.kind === 'image') {
            if (!services.imageService) throw new Error('arena.unavailable')
            const request = { configId: model.configKey, modelId: model.modelId, configSnapshot: config as ImageModelConfig, prompt: result.prompt }
            const output = inputs.length > 1 ? await services.imageService.generateMultiImage({ ...request, inputImages: inputs })
              : inputs.length ? await services.imageService.generateImage2Image({ ...request, inputImage: inputs[0] })
                : await services.imageService.generateText2Image(request)
            if (!current()) return
            if (output.text) stream.onToken(output.text)
            await runSessionWrite(services.preferenceService, () => queueImageStorageMaintenance(async () => {
              for (const image of output.images) {
                const assetId = await persistGeneratedImage(image, services.imageStorageService, { prompt: result.prompt, modelId: model.modelId, configId: model.configKey })
                if (!assetId) throw new Error('arena.missingImage')
                if (current()) live.images.push({ id: assetId, _type: 'image-ref' })
              }
            }))
          } else {
            let failure: Error | undefined
            const accepts = () => current() && !stream.signal.aborted
            const callbacks: StreamHandlers = {
              signal: stream.signal,
              onToken: token => { if (accepts()) stream.onToken(token) },
              onReasoningToken: token => { if (accepts()) stream.onReasoningToken(token) },
              onComplete: response => {
                if (!accepts() || !response) return
                if (!stream.document.length && response.content) stream.onToken(response.content)
                if (!stream.document.size('reasoning') && response.reasoning) stream.onReasoningToken(response.reasoning)
              },
              onError: error => { if (current()) failure = error },
            }
            if (inputs.length) {
              const understanding = isRunningInElectron() ? new ElectronImageUnderstandingServiceProxy()
                : createImageUnderstandingService({ registry: services.textAdapterRegistry! })
              await understanding.understandStream({ modelConfig: config as TextModelConfig, userPrompt: result.prompt, images: inputs }, callbacks)
            } else await services.llmService.sendMessageStream([{ role: 'user', content: result.prompt }], model.configKey, callbacks, { configSnapshot: config as TextModelConfig })
            if (failure) throw failure
          }
          if (stream.document.phase === 'capacity') throw new Error('arena.capacity')
          if (current()) {
            if (!stream.document.length && !live.images.length) throw new Error('arena.emptyOutput')
            live.status = 'success'
          }
        } catch (error) {
          if (current()) { live.status = 'error'; live.error = stream.document.phase === 'capacity' ? 'arena.capacity' : error instanceof Error ? error.message : String(error) }
        } finally { stream.finish(live.status === 'error') }
      })()
    } catch (error) {
      if (current()) { live.status = 'error'; live.error = error instanceof Error ? error.message : String(error) }
    } finally {
      if (controllers.get(id) === controller) controllers.delete(id)
      pendingJobs.value--
      state.value.lastActiveAt = Date.now()
      pendingGcResumes.add(resumeGc)
      await saveSession()
    }
  }
  const runAll = async () => {
    if (!state.value.prompt.trim() || state.value.contestants.some(c => !c.configKey || !c.modelId)) throw new Error('arena.incomplete')
    await Promise.allSettled(state.value.contestants.map(c => run(c.id)))
  }
  const addContestant = () => {
    const contestants = state.value.contestants
    const column = createArenaContestant(contestants[contestants.length - 1])
    state.value.contestants.push(column)
    return column.id
  }
  const removeContestant = (id: string) => {
    if (state.value.contestants.length <= 1 || busy(id)) return
    state.value.contestants = state.value.contestants.filter(c => c.id !== id)
    delete state.value.results[id]
  }
  // Persist draft edits even when no workspace component is mounted.
  let timer: ReturnType<typeof setTimeout> | undefined
  watch(() => [state.value.prompt, state.value.images, state.value.contestants], () => {
    if (hydrating) return
    state.value.lastActiveAt = Date.now()
    clearTimeout(timer)
    timer = setTimeout(() => { void saveSession() }, 500)
  }, { deep: true, flush: 'sync' })
  return { state, configurations, refreshConfigs, resolveConfig, running, lastActiveAt, saveError, saveSession, restoreSession,
    isStale, resolveImages, addImages, replaceInput, busy, cancellable, run, runAll, stop, addContestant, removeContestant }
})
