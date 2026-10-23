import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryStorageProvider, PreferenceService, type IImageStorageService } from '@prompt-optimizer/core'
import { createTestPinia } from '../../../utils/pinia-test-helpers'
import { setPiniaServices } from '../../../../src/plugins/pinia'
import { useBasicSystemSession } from '../../../../src/stores/session/useBasicSystemSession'
import { useBasicUserSession } from '../../../../src/stores/session/useBasicUserSession'
import { useProMultiMessageSession } from '../../../../src/stores/session/useProMultiMessageSession'
import { useProVariableSession } from '../../../../src/stores/session/useProVariableSession'
import { useImageText2ImageSession } from '../../../../src/stores/session/useImageText2ImageSession'
import { useImageImage2ImageSession } from '../../../../src/stores/session/useImageImage2ImageSession'
import { useImageMultiImageSession } from '../../../../src/stores/session/useImageMultiImageSession'
import { hasSessionConflicts, readSessionSnapshot, writeSessionSnapshot } from '../../../../src/stores/session/sessionPersistence'
import { useSessionManager } from '../../../../src/stores/session/useSessionManager'

const workspaces = [
  ['basic-system', useBasicSystemSession], ['basic-user', useBasicUserSession],
  ['pro-multi', useProMultiMessageSession], ['pro-variable', useProVariableSession],
  ['image-text2image', useImageText2ImageSession], ['image-image2image', useImageImage2ImageSession],
  ['image-multiimage', useImageMultiImageSession],
] as const
afterEach(() => vi.restoreAllMocks())

describe('independent window sessions', () => {
  it.each(workspaces)('preserves persisted updates and the losing draft in %s', async (mode, factory) => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const storage = new MemoryStorageProvider()
    const firstPreferences = new PreferenceService(storage)
    const secondPreferences = new PreferenceService(storage)
    const imageStorageService = {
      getImage: vi.fn(async () => null), getMetadata: vi.fn(async () => null),
      listAllMetadata: vi.fn(async () => []), deleteImages: vi.fn(async () => {}),
    } as unknown as IImageStorageService
    const first = createTestPinia({ preferenceService: firstPreferences, imageStorageService })
    const firstStore = factory(first.pinia)
    await firstStore.restoreSession()
    firstStore.optimizedPrompt = 'baseline'
    expect(await firstStore.saveSession()).toBe(true)

    const second = createTestPinia({ preferenceService: secondPreferences, imageStorageService })
    const secondStore = factory(second.pinia)
    await secondStore.restoreSession()

    setPiniaServices(first.services)
    firstStore.optimizedPrompt = 'newer saved result'
    expect(await firstStore.saveSession()).toBe(true)

    setPiniaServices(second.services)
    // Merely opening/closing a tab is not a conflicting edit.
    expect(await secondStore.saveSession()).toBe(true)
    expect(hasSessionConflicts(secondPreferences)).toBe(false)
    expect((await firstPreferences.get<{ optimizedPrompt: string }>(`session/v1/${mode}`, { optimizedPrompt: '' })).optimizedPrompt).toBe('newer saved result')
    secondStore.optimizedPrompt = 'keep this local draft'
    expect(await secondStore.saveSession().catch(() => false)).toBe(false)
    expect(secondStore.optimizedPrompt).toBe('keep this local draft')
    expect(hasSessionConflicts(secondPreferences)).toBe(true)
    const persisted = await firstPreferences.get<{ optimizedPrompt: string }>(`session/v1/${mode}`, { optimizedPrompt: '' })
    expect(persisted.optimizedPrompt).toBe('newer saved result')
    // Returning to this workspace must keep the unsaved draft available to copy.
    await useSessionManager(second.pinia).restoreSubModeSession(mode)
    expect(secondStore.optimizedPrompt).toBe('keep this local draft')
  })

  it('serializes rapid saves from one window without conflicting with itself', async () => {
    const preferences = new PreferenceService(new MemoryStorageProvider())
    const key = 'session/v1/basic-user'
    await preferences.set(key, { prompt: 'initial' })
    await readSessionSnapshot(preferences, key, null)
    await Promise.all([
      writeSessionSnapshot(preferences, key, { prompt: 'first edit' }),
      writeSessionSnapshot(preferences, key, { prompt: 'latest edit' }),
    ])
    expect(await preferences.get(key, null)).toEqual({ prompt: 'latest edit' })
    expect(hasSessionConflicts(preferences)).toBe(false)
  })

  it('accepts equivalent legacy snapshots without falsely overwriting another window', async () => {
    const preferences = new PreferenceService(new MemoryStorageProvider())
    const key = 'session/v1/basic-user'
    await preferences.set(key, JSON.stringify({ prompt: 'same content', lastActiveAt: 1 }))
    await readSessionSnapshot(preferences, key, null)
    await preferences.set(key, { lastActiveAt: 2, prompt: 'same content' })
    await writeSessionSnapshot(preferences, key, { prompt: 'same content', lastActiveAt: 3 })
    expect(await preferences.get(key, null)).toEqual({ lastActiveAt: 2, prompt: 'same content' })
    expect(hasSessionConflicts(preferences)).toBe(false)
  })
})
