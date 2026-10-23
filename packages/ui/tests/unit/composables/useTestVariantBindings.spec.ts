import { describe, expect, it, vi } from 'vitest'
import { MemoryStorageProvider, PreferenceService, type IImageStorageService } from '@prompt-optimizer/core'
import { useTestVariantBindings } from '../../../src/composables/workspaces/useTestVariantBindings'
import { createTestPinia } from '../../utils/pinia-test-helpers'
import { useBasicSystemSession } from '../../../src/stores/session/useBasicSystemSession'
import { useBasicUserSession } from '../../../src/stores/session/useBasicUserSession'
import { useProMultiMessageSession } from '../../../src/stores/session/useProMultiMessageSession'
import { useProVariableSession } from '../../../src/stores/session/useProVariableSession'
import { useImageText2ImageSession } from '../../../src/stores/session/useImageText2ImageSession'
import { useImageImage2ImageSession } from '../../../src/stores/session/useImageImage2ImageSession'
import { useImageMultiImageSession } from '../../../src/stores/session/useImageMultiImageSession'

const workspaces = [
  ['basic-system', useBasicSystemSession], ['basic-user', useBasicUserSession],
  ['pro-multi', useProMultiMessageSession], ['pro-variable', useProVariableSession],
  ['image-text2image', useImageText2ImageSession], ['image-image2image', useImageImage2ImageSession],
  ['image-multiimage', useImageMultiImageSession],
] as const

describe('test variant bindings', () => {
  it.each(workspaces)('keeps hidden groups and binds to restored session objects in %s', async (mode, factory) => {
    const preferenceService = new PreferenceService(new MemoryStorageProvider())
    const imageStorageService = {
      getImage: vi.fn(async () => null), getMetadata: vi.fn(async () => null),
      listAllMetadata: vi.fn(async () => []), deleteImages: vi.fn(async () => {}),
    } as unknown as IImageStorageService
    const { pinia } = createTestPinia({ preferenceService, imageStorageService })
    const session = factory(pinia)
    await session.restoreSession()
    const bindings = useTestVariantBindings({
      getVariants: () => session.testVariants,
      getCount: () => session.layout.testColumnCount,
      setVariant: (id, patch) => session.updateTestVariant(id, patch),
      setCount: count => session.setTestColumnCount(count),
      originalVersionFallback: mode === 'image-multiimage' ? 'workspace' : 0,
    })
    const { variantVersionModels, variantModelKeyModels, testColumnCountModel, activeVariantIds } = bindings
    expect(variantVersionModels.a.value).toBe(0)
    expect(variantVersionModels.b.value).toBe('workspace')
    testColumnCountModel.value = 4
    variantVersionModels.c.value = 'previous'
    variantModelKeyModels.d.value = 'keep-hidden-d'
    testColumnCountModel.value = 2
    expect(activeVariantIds.value).toEqual(['a', 'b'])
    expect(session.testVariants.find(item => item.id === 'c')?.version).toBe('previous')
    expect(session.testVariants.find(item => item.id === 'd')?.modelKey).toBe('keep-hidden-d')
    await session.saveSession()

    const oldVariants = session.testVariants
    const oldLayout = session.layout
    await session.restoreSession()
    expect(session.testVariants).not.toBe(oldVariants)
    expect(session.layout).not.toBe(oldLayout)
    expect(variantVersionModels.c.value).toBe('previous')
    expect(variantModelKeyModels.d.value).toBe('keep-hidden-d')
    testColumnCountModel.value = 4
    expect(activeVariantIds.value).toEqual(['a', 'b', 'c', 'd'])
    variantVersionModels.c.value = 2
    variantModelKeyModels.d.value = 'new-d-model'
    expect(oldVariants.find(item => item.id === 'c')?.version).toBe('previous')
    expect(oldVariants.find(item => item.id === 'd')?.modelKey).toBe('keep-hidden-d')
    expect(oldLayout.testColumnCount).toBe(2)
    await session.saveSession()
    const saved = await preferenceService.get<{ layout: { testColumnCount: number }; testVariants: typeof session.testVariants } | null>(`session/v1/${mode}`, null)
    expect(saved?.layout.testColumnCount).toBe(4)
    expect(saved?.testVariants.find(item => item.id === 'c')?.version).toBe(2)
    expect(saved?.testVariants.find(item => item.id === 'd')?.modelKey).toBe('new-d-model')
  })

  it.each([0, 'workspace'] as const)('preserves the configured missing-A fallback %s without writing defaults', fallback => {
    const setVariant = vi.fn()
    const setCount = vi.fn()
    const bindings = useTestVariantBindings({
      getVariants: () => [], getCount: () => NaN, setVariant, setCount,
      originalVersionFallback: fallback,
    })
    expect(bindings.variantVersionModels.a.value).toBe(fallback)
    expect(bindings.variantVersionModels.b.value).toBe('workspace')
    expect(bindings.variantModelKeyModels.a.value).toBe('')
    expect(bindings.testColumnCountModel.value).toBe(2)
    expect(setVariant).not.toHaveBeenCalled()
    expect(setCount).not.toHaveBeenCalled()
  })
})
