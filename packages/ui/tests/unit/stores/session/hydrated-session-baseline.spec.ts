import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, shallowRef, type EffectScope } from 'vue'
import { setActivePinia } from 'pinia'
import { MemoryStorageProvider, PreferenceService, type IImageStorageService, type Template } from '@prompt-optimizer/core'
import { createTestPinia } from '../../../utils/pinia-test-helpers'
import { allowConsole } from '../../../utils/error-detection'
import { setPiniaServices } from '../../../../src/plugins/pinia'
import { useSessionManager } from '../../../../src/stores/session/useSessionManager'
import { useBasicSystemSession } from '../../../../src/stores/session/useBasicSystemSession'
import { useBasicUserSession } from '../../../../src/stores/session/useBasicUserSession'
import { useProMultiMessageSession } from '../../../../src/stores/session/useProMultiMessageSession'
import { useProVariableSession } from '../../../../src/stores/session/useProVariableSession'
import { useImageText2ImageSession } from '../../../../src/stores/session/useImageText2ImageSession'
import { useImageImage2ImageSession } from '../../../../src/stores/session/useImageImage2ImageSession'
import { useImageMultiImageSession } from '../../../../src/stores/session/useImageMultiImageSession'
import { hasSessionConflicts } from '../../../../src/stores/session/sessionPersistence'
import { useWorkspaceTemplateSelection } from '../../../../src/composables/workspaces/useWorkspaceTemplateSelection'
import { createAppUpdatePreparation } from '../../../../src/composables/ui/useAppUpdatePreparation'
import type { AppServices } from '../../../../src/types/services'

const workspaces = [
  ['basic-system', useBasicSystemSession], ['basic-user', useBasicUserSession],
  ['pro-multi', useProMultiMessageSession], ['pro-variable', useProVariableSession],
  ['image-text2image', useImageText2ImageSession], ['image-image2image', useImageImage2ImageSession],
  ['image-multiimage', useImageMultiImageSession],
] as const
const scopes: EffectScope[] = []
afterEach(() => { for (const scope of scopes.splice(0)) scope.stop(); vi.restoreAllMocks() })
const createWindow = (storage: MemoryStorageProvider, imageOverrides: Partial<IImageStorageService> = {}) => {
  const preferences = new PreferenceService(storage)
  const context = createTestPinia({
    preferenceService: preferences,
    imageStorageService: {
      getImage: vi.fn(async () => null), getMetadata: vi.fn(async () => null),
      listAllMetadata: vi.fn(async () => []), deleteImages: vi.fn(async () => {}),
      ...imageOverrides,
    } as unknown as IImageStorageService,
  })
  const activate = () => { setPiniaServices(context.services); setActivePinia(context.pinia) }
  return { ...context, preferences, activate }
}

describe('hydrated session content baseline', () => {
  it.each(workspaces.filter(([mode]) => mode.startsWith('image-')))(
    '%s does not acknowledge a new result edited while the previous image was saving', async (mode, factory) => {
      const storage = new MemoryStorageProvider()
      let release!: () => void
      const imageSaved = new Promise<void>(resolve => { release = resolve })
      const saveImage = vi.fn(() => imageSaved)
      const first = createWindow(storage, { saveImage })
      const store = factory(first.pinia)
      await store.restoreSession()
      const original = { images: [{ b64: 'AAAA', mimeType: 'image/png' }], metadata: {} }
      const edited = { images: [{ b64: 'BBBB', mimeType: 'image/png' }], metadata: {} }
      // Image factories share these fields; narrowing avoids broad fixture casts.
      if (!('originalImageResult' in store)) throw new Error('Expected an image workspace')
      store.originalImageResult = original
      const saving = store.saveSession()
      await vi.waitFor(() => expect(saveImage).toHaveBeenCalledOnce())
      store.originalImageResult = edited
      release()
      expect(await saving).toBe(true)

      const key = `session/v1/${mode}`
      const persisted = await first.preferences.get<Record<string, unknown>>(key, {})
      const other = new PreferenceService(storage)
      const remote = { ...persisted, selectedTemplateId: 'changed in another window' }
      await other.set(key, remote)
      // The new local image was never committed. It must still be a real edit,
      // not the acknowledged baseline from the previous async image save.
      expect(await store.saveSession().catch(() => false)).toBe(false)
      expect(hasSessionConflicts(first.preferences)).toBe(true)
      expect(store.originalImageResult).toEqual(edited)
      expect(await other.get(key, null)).toEqual(remote)
    },
  )

  it.each(workspaces.filter(([mode]) => mode.startsWith('image-')))(
    '%s compares hydrated image content without confusing it with persisted references', async (mode, factory) => {
      const storage = new MemoryStorageProvider()
      const first = createWindow(storage, {
        getImage: vi.fn(async () => ({ data: 'AAAA', metadata: { mimeType: 'image/png' } })) as IImageStorageService['getImage'],
        saveImage: vi.fn(async () => {}),
      })
      const key = `session/v1/${mode}`
      await first.preferences.set(key, { originalImageResult: { images: [{ _type: 'image-ref', id: 'legacy-image' }], metadata: {} } })
      const store = factory(first.pinia)
      await store.restoreSession()
      if (!('originalImageResult' in store)) throw new Error('Expected an image workspace')
      expect(store.originalImageResult?.images[0]).toMatchObject({ b64: 'AAAA' })
      const other = new PreferenceService(storage)
      const remote = { originalPrompt: 'A newer remote prompt', inputImages: [] }
      await other.set(key, remote)
      expect(await store.saveSession()).toBe(true)
      expect(hasSessionConflicts(first.preferences)).toBe(false)
      expect(await other.get(key, null)).toEqual(remote)
    },
  )

  it.each(workspaces)('%s preserves its first idle save, then does not rewrite another window', async (mode, factory) => {
    const storage = new MemoryStorageProvider()
    const first = createWindow(storage)
    const store = factory(first.pinia)
    const key = `session/v1/${mode}`
    await store.restoreSession()
    expect(await first.preferences.get(key, null)).toBeNull()
    expect(await store.saveSession()).toBe(true)
    expect(await first.preferences.get(key, null)).toBeTruthy()

    const other = createWindow(storage)
    const remoteStore = factory(other.pinia)
    await remoteStore.restoreSession()
    remoteStore.optimizedPrompt = 'New result from the other window'
    expect(await remoteStore.saveSession()).toBe(true)
    const remote = await other.preferences.get(key, null)
    first.activate()
    expect(await store.saveSession()).toBe(true)
    expect(await first.preferences.get(key, null)).toEqual(remote)
    expect(hasSessionConflicts(first.preferences)).toBe(false)
  })

  describe.each(['missing', 'legacy'] as const)('%s snapshot', kind => {
    it.each(workspaces)('%s ignores an untouched hydrated session but still protects an actual edit', async (mode, factory) => {
      allowConsole(/Failed to save session:/)
      const storage = new MemoryStorageProvider()
      const first = createWindow(storage)
      const key = `session/v1/${mode}`
      // A valid earlier schema: restored defaults differ from the stored value.
      if (kind === 'legacy') await first.preferences.set(key, { optimizedPrompt: 'Earlier result' })
      const localStore = factory(first.pinia)
      await localStore.restoreSession()
      const other = createWindow(storage)
      const remoteStore = factory(other.pinia)
      await remoteStore.restoreSession()
      remoteStore.selectedTemplateId = 'other-window-template'
      expect(await remoteStore.saveSession()).toBe(true)
      const remote = await other.preferences.get(key, null)

      first.activate()
      expect(await localStore.saveSession()).toBe(true)
      expect(await localStore.saveSession()).toBe(true)
      expect(hasSessionConflicts(first.preferences)).toBe(false)
      expect(await first.preferences.get(key, null)).toEqual(remote)

      localStore.optimizedPrompt = 'Actual unsaved edit in the first window'
      expect(await localStore.saveSession().catch(() => false)).toBe(false)
      expect(hasSessionConflicts(first.preferences)).toBe(true)
      expect(localStore.optimizedPrompt).toBe('Actual unsaved edit in the first window')
      expect(await first.preferences.get(key, null)).toEqual(remote)
    })
  })

  it('prepares an update after another window only initializes default system templates', async () => {
    const storage = new MemoryStorageProvider()
    const first = createWindow(storage)
    const manager = useSessionManager(first.pinia)
    await manager.restoreAllSessions()
    const user = useBasicUserSession(first.pinia)
    user.prompt = 'Keep the user draft'
    user.optimizedPrompt = 'Keep the completed optimization'
    expect(await user.saveSession()).toBe(true)
    expect(await first.preferences.get('session/v1/basic-system', null)).toBeNull()

    const other = createWindow(storage)
    const system = useBasicSystemSession(other.pinia)
    await system.restoreSession()
    const templates: Template[] = [
      { id: 'default-optimize', name: 'Optimize', content: 'fixture', metadata: { version: '1', lastModified: 0, templateType: 'optimize' } },
      { id: 'default-iterate', name: 'Iterate', content: 'fixture', metadata: { version: '1', lastModified: 0, templateType: 'iterate' } },
    ]
    const templateManager = { listTemplatesByType: async (type: string) => templates.filter(t => t.metadata.templateType === type) } as AppServices['templateManager']
    const scope = effectScope()
    scopes.push(scope)
    scope.run(() => useWorkspaceTemplateSelection(shallowRef({ ...other.services, templateManager }), system, 'optimize', 'iterate'))
    await vi.waitFor(() => expect(system.selectedIterateTemplateId).toBe('default-iterate'))
    await nextTick()
    expect(await system.saveSession()).toBe(true)
    const remote = await other.preferences.get('session/v1/basic-system', null)
    expect(remote).toMatchObject({ prompt: '', selectedTemplateId: 'default-optimize' })

    first.activate()
    const prepare = createAppUpdatePreparation({
      isBusy: () => hasSessionConflicts(first.preferences),
      subscribeToChanges: manager.subscribeToSessionChanges,
      flush: manager.saveAllSessions,
    })
    expect(await prepare()).toBe('ready')
    scope.stop()
    expect(await prepare()).toBe('ready')
    expect(hasSessionConflicts(first.preferences)).toBe(false)
    expect(await first.preferences.get('session/v1/basic-system', null)).toEqual(remote)
    expect(await first.preferences.get('session/v1/basic-user', null)).toMatchObject({
      prompt: 'Keep the user draft', optimizedPrompt: 'Keep the completed optimization',
    })
  })
})
