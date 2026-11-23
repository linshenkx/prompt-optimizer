import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import type { ImageResult, PromptRecordChain } from '@prompt-optimizer/core'

import { createTestPinia } from '../../utils/pinia-test-helpers'
import SaveTestResultExampleButton from '../../../src/components/SaveTestResultExampleButton.vue'
import { useBasicSystemSession } from '../../../src/stores/session/useBasicSystemSession'
import { useBasicUserSession } from '../../../src/stores/session/useBasicUserSession'
import { useImageMultiImageSession } from '../../../src/stores/session/useImageMultiImageSession'
import { useImageText2ImageSession } from '../../../src/stores/session/useImageText2ImageSession'

const toastMock = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
}))

vi.mock('../../../src/composables/ui/useToast', () => ({
  useToast: () => toastMock,
}))

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key,
    }),
  }
})

const naiveStubs = {
  NButton: {
    name: 'NButton',
    template:
      '<button v-bind="$attrs" :disabled="disabled" @click="$emit(\'click\', $event)"><slot name="icon" /><slot /></button>',
    props: ['disabled', 'size', 'quaternary', 'circle'],
    emits: ['click'],
  },
  NIcon: {
    name: 'NIcon',
    template: '<span><slot /></span>',
  },
  NTooltip: {
    name: 'NTooltip',
    template: '<span><slot name="trigger" /><slot /></span>',
    props: ['trigger'],
  },
}

const mountButton = (
  pinia: ReturnType<typeof createTestPinia>['pinia'],
  handleSaveFavorite: ReturnType<typeof vi.fn>,
  props: Record<string, unknown>,
  services?: unknown,
) => mount(SaveTestResultExampleButton, {
  props: {
    testId: 'save-example',
    ...props,
  },
  global: {
    plugins: [pinia],
    provide: {
      handleSaveFavorite,
      ...(services ? { services } : {}),
    },
    stubs: naiveStubs,
  },
})

const triggerSaveExample = async (
  wrapper: ReturnType<typeof mountButton>,
) => {
  await wrapper.get('[data-testid="save-example"]').trigger('click')
  await flushPromises()
}

const createHistoryChain = (): PromptRecordChain => {
  const rootRecord = {
    id: 'record-1',
    originalPrompt: 'Original prompt',
    optimizedPrompt: 'Optimized prompt',
    type: 'optimize' as const,
    chainId: 'chain-1',
    version: 1,
    timestamp: 1000,
    modelKey: 'text-model',
    templateId: 'template-a',
  }
  const currentRecord = {
    ...rootRecord,
    id: 'record-2',
    originalPrompt: 'Optimized prompt',
    optimizedPrompt: 'Optimized prompt v2',
    type: 'iterate' as const,
    version: 2,
    previousId: 'record-1',
    timestamp: 2000,
  }

  return {
    chainId: 'chain-1',
    rootRecord,
    currentRecord,
    versions: [rootRecord, currentRecord],
  }
}

describe('SaveTestResultExampleButton', () => {
  beforeEach(() => {
    toastMock.error.mockClear()
    toastMock.success.mockClear()
    toastMock.warning.mockClear()
  })

  it('opens save favorite with a text test result example draft', async () => {
    const { pinia } = createTestPinia()
    const handleSaveFavorite = vi.fn()
    const session = useBasicSystemSession(pinia)

    session.prompt = 'Original {{topic}}'
    session.optimizedPrompt = 'Optimized {{topic}}'
    session.testContent = 'Input about {{topic}}'
    session.testVariants = [
      { id: 'a', version: 'workspace', modelKey: 'text-model' },
      { id: 'b', version: 'workspace', modelKey: '' },
      { id: 'c', version: 'workspace', modelKey: '' },
      { id: 'd', version: 'workspace', modelKey: '' },
    ]
    session.testVariantResults = {
      a: { result: 'Saved output', reasoning: 'brief reasoning' },
      b: { result: '', reasoning: '' },
      c: { result: '', reasoning: '' },
      d: { result: '', reasoning: '' },
    }

    const wrapper = mountButton(pinia, handleSaveFavorite, {
      subModeKey: 'basic-system',
      variantId: 'a',
      content: 'Optimized {{topic}}',
      originalContent: 'Original {{topic}}',
      functionMode: 'basic',
      optimizationMode: 'system',
    })

    await triggerSaveExample(wrapper)

    expect(handleSaveFavorite).toHaveBeenCalledTimes(1)
    const payload = handleSaveFavorite.mock.calls[0][0]
    expect(payload).toMatchObject({
      content: 'Optimized {{topic}}',
      originalContent: 'Original {{topic}}',
      prefill: {
        functionMode: 'basic',
        optimizationMode: 'system',
        reproducibilityDraft: {
          variables: [],
          examples: [
            {
              basedOnVersionId: 'implicit:basic-system:draft',
              text: 'Input about {{topic}}',
              outputText: 'Saved output',
              metadata: {
                modelKey: 'text-model',
              },
            },
          ],
        },
      },
    })
  })

  it('opens the save dialog with the linked favorite as the candidate target', async () => {
    const { pinia } = createTestPinia()
    const handleSaveFavorite = vi.fn()
    const session = useBasicSystemSession(pinia)

    session.origin = { kind: 'favorite', id: 'favorite-linked' }
    session.prompt = 'Original {{topic}}'
    session.optimizedPrompt = 'Optimized {{topic}}'
    session.testContent = 'Input about {{topic}}'
    session.testVariants = [
      { id: 'a', version: 'workspace', modelKey: 'text-model' },
      { id: 'b', version: 'workspace', modelKey: '' },
      { id: 'c', version: 'workspace', modelKey: '' },
      { id: 'd', version: 'workspace', modelKey: '' },
    ]
    session.testVariantResults = {
      a: { result: 'Saved output', reasoning: '' },
      b: { result: '', reasoning: '' },
      c: { result: '', reasoning: '' },
      d: { result: '', reasoning: '' },
    }

    const wrapper = mountButton(pinia, handleSaveFavorite, {
      subModeKey: 'basic-system',
      variantId: 'a',
      content: 'Optimized {{topic}}',
      originalContent: 'Original {{topic}}',
      functionMode: 'basic',
      optimizationMode: 'system',
    })

    await triggerSaveExample(wrapper)

    expect(handleSaveFavorite).toHaveBeenCalledTimes(1)
    expect(handleSaveFavorite.mock.calls[0][0]).toMatchObject({
      candidateSource: { favoriteId: 'favorite-linked' },
      content: 'Optimized {{topic}}',
      originalContent: 'Original {{topic}}',
      prefill: {
        reproducibilityDraft: {
          examples: [
            {
              basedOnVersionId: 'implicit:basic-system:draft',
              text: 'Input about {{topic}}',
              outputText: 'Saved output',
              metadata: {
                modelKey: 'text-model',
              },
            },
          ],
        },
      },
    })
  })

  it('opens the save dialog instead of appending when linked favorite content differs', async () => {
    const { pinia } = createTestPinia()
    const handleSaveFavorite = vi.fn()
    const session = useBasicSystemSession(pinia)

    session.origin = { kind: 'favorite', id: 'favorite-linked' }
    session.optimizedPrompt = 'Edited workspace {{topic}}'
    session.testContent = 'Input about {{topic}}'
    session.testVariants = [
      { id: 'a', version: 'workspace', modelKey: 'text-model' },
      { id: 'b', version: 'workspace', modelKey: '' },
      { id: 'c', version: 'workspace', modelKey: '' },
      { id: 'd', version: 'workspace', modelKey: '' },
    ]
    session.testVariantResults = {
      a: { result: 'Saved output', reasoning: '' },
      b: { result: '', reasoning: '' },
      c: { result: '', reasoning: '' },
      d: { result: '', reasoning: '' },
    }

    const wrapper = mountButton(pinia, handleSaveFavorite, {
      subModeKey: 'basic-system',
      variantId: 'a',
      content: 'Edited workspace {{topic}}',
      functionMode: 'basic',
      optimizationMode: 'system',
    })

    await triggerSaveExample(wrapper)

    expect(toastMock.warning).not.toHaveBeenCalled()
    expect(handleSaveFavorite).toHaveBeenCalledTimes(1)
    expect(handleSaveFavorite.mock.calls[0][0]).toMatchObject({
      content: 'Edited workspace {{topic}}',
      prefill: {
        reproducibilityDraft: {
          examples: [
            {
              text: 'Input about {{topic}}',
              outputText: 'Saved output',
            },
          ],
        },
      },
    })
  })

  it('does not implicitly update a linked favorite when saving a test example', async () => {
    const { pinia } = createTestPinia()
    const handleSaveFavorite = vi.fn()
    const session = useBasicSystemSession(pinia)

    session.origin = { kind: 'favorite', id: 'favorite-linked' }
    session.optimizedPrompt = 'Optimized prompt'
    session.testContent = 'Input'
    session.testVariants = [
      { id: 'a', version: 'workspace', modelKey: 'text-model' },
      { id: 'b', version: 'workspace', modelKey: '' },
      { id: 'c', version: 'workspace', modelKey: '' },
      { id: 'd', version: 'workspace', modelKey: '' },
    ]
    session.testVariantResults = {
      a: { result: 'Saved output', reasoning: '' },
      b: { result: '', reasoning: '' },
      c: { result: '', reasoning: '' },
      d: { result: '', reasoning: '' },
    }

    const wrapper = mountButton(pinia, handleSaveFavorite, {
      subModeKey: 'basic-system',
      variantId: 'a',
      content: 'Optimized prompt',
      functionMode: 'basic',
      optimizationMode: 'system',
    })

    await triggerSaveExample(wrapper)

    expect(toastMock.error).not.toHaveBeenCalled()
    expect(handleSaveFavorite).toHaveBeenCalledTimes(1)
    expect(handleSaveFavorite.mock.calls[0][0].prefill.reproducibilityDraft.examples[0]).toMatchObject({
      outputText: 'Saved output',
    })
  })

  it('preserves image input and output refs when saving a multiimage result example', async () => {
    const { pinia } = createTestPinia()
    const handleSaveFavorite = vi.fn()
    const session = useImageMultiImageSession(pinia)

    session.originalPrompt = 'Generate {{scene}}'
    session.optimizedPrompt = 'Generate vivid {{scene}}'
    session.assetBinding = { assetId: 'asset-image', versionId: 'asset-version-image', status: 'linked' }
    session.origin = { kind: 'favorite', id: 'favorite-image' }
    session.temporaryVariables = { scene: 'city' }
    session.inputImages = [
      {
        id: 'runtime-1',
        assetId: null,
        b64: 'INPUT_B64',
        mimeType: 'image/png',
      },
    ]
    session.testVariants = [
      { id: 'a', version: 'workspace', modelKey: 'image-model' },
      { id: 'b', version: 'workspace', modelKey: '' },
      { id: 'c', version: 'workspace', modelKey: '' },
      { id: 'd', version: 'workspace', modelKey: '' },
    ]
    session.testVariantResults = {
      a: {
        images: [
          { _type: 'image-ref', id: 'output-asset' },
          { b64: 'OUTPUT_B64', mimeType: 'image/jpeg' },
        ],
        text: 'Image output note',
        metadata: {
          providerId: 'provider',
          modelId: 'model',
          configId: 'image-model',
        },
      } as unknown as ImageResult,
      b: null,
      c: null,
      d: null,
    }

    const wrapper = mountButton(pinia, handleSaveFavorite, {
      subModeKey: 'image-multiimage',
      variantId: 'a',
      content: 'Generate vivid {{scene}}',
      originalContent: 'Generate {{scene}}',
      functionMode: 'image',
      imageSubMode: 'multiimage',
    })

    await triggerSaveExample(wrapper)

    expect(handleSaveFavorite).toHaveBeenCalledTimes(1)
    const draft = handleSaveFavorite.mock.calls[0][0].prefill.reproducibilityDraft
    expect(draft.variables).toEqual([
      {
        name: 'scene',
        required: false,
        options: [],
        source: 'test-run',
      },
    ])
    expect(draft.examples[0]).toMatchObject({
      basedOnVersionId: 'implicit:image-multiimage:draft',
      parameters: { scene: 'city' },
      outputText: 'Image output note',
      images: ['data:image/jpeg;base64,OUTPUT_B64'],
      inputImages: ['data:image/png;base64,INPUT_B64'],
      imageAssetIds: ['output-asset'],
      source: {
        kind: 'workspace',
        id: 'implicit:image-multiimage',
        metadata: {
          assetBinding: {
            assetId: 'asset-image',
            versionId: 'asset-version-image',
            status: 'linked',
          },
          origin: {
            kind: 'favorite',
            id: 'favorite-image',
          },
        },
      },
      metadata: {
        modelKey: 'image-model',
      },
    })
  })

  it('resolves based-on ids for root, record, and workspace draft test runs', async () => {
    const { pinia } = createTestPinia()
    const handleSaveFavorite = vi.fn()
    const session = useBasicSystemSession(pinia)

    session.prompt = 'Original prompt'
    session.optimizedPrompt = 'Optimized prompt'
    session.chainId = 'chain-1'
    session.versionId = 'record-current'
    session.testContent = 'Input'
    session.testVariants = [
      { id: 'a', version: 0, modelKey: 'text-model' },
      { id: 'b', version: 2, modelKey: 'text-model' },
      { id: 'c', version: 'workspace', modelKey: 'text-model' },
      { id: 'd', version: 'workspace', modelKey: '' },
    ]
    session.testVariantResults = {
      a: { result: 'Root output', reasoning: '' },
      b: { result: 'Record output', reasoning: '' },
      c: { result: 'Workspace output', reasoning: '' },
      d: { result: '', reasoning: '' },
    }

    for (const variantId of ['a', 'b', 'c']) {
      const wrapper = mountButton(pinia, handleSaveFavorite, {
        subModeKey: 'basic-system',
        variantId,
        content: 'Optimized prompt',
        functionMode: 'basic',
        optimizationMode: 'system',
      })

      await triggerSaveExample(wrapper)
      wrapper.unmount()
    }

    expect(handleSaveFavorite.mock.calls.map((call) =>
      call[0].prefill.reproducibilityDraft.examples[0].basedOnVersionId,
    )).toEqual([
      'chain-1:root',
      'legacy-version:2',
      'implicit:basic-system:draft',
    ])
  })

  it('uses hydrated history ids for root, previous, and numeric record test runs when available', async () => {
    const historyManager = {
      getChain: vi.fn(async () => createHistoryChain()),
    }
    const { pinia } = createTestPinia({
      historyManager: historyManager as any,
    })
    const handleSaveFavorite = vi.fn()
    const session = useBasicSystemSession(pinia)

    session.prompt = 'Original prompt'
    session.optimizedPrompt = 'Optimized prompt'
    session.chainId = 'chain-1'
    session.assetBinding = { assetId: 'asset-text', versionId: 'asset-version-text', status: 'linked' }
    session.origin = { kind: 'favorite', id: 'favorite-text' }
    session.testContent = 'Input'
    session.testVariants = [
      { id: 'a', version: 0, modelKey: 'text-model' },
      { id: 'b', version: 2, modelKey: 'text-model' },
      { id: 'c', version: 'workspace', modelKey: 'text-model' },
      { id: 'd', version: 'previous', modelKey: 'text-model' },
    ]
    session.testVariantResults = {
      a: { result: 'Root output', reasoning: '' },
      b: { result: 'Record output', reasoning: '' },
      c: { result: 'Workspace output', reasoning: '' },
      d: { result: 'Previous output', reasoning: '' },
    }

    for (const variantId of ['a', 'b', 'd', 'c']) {
      const wrapper = mountButton(pinia, handleSaveFavorite, {
        subModeKey: 'basic-system',
        variantId,
        content: 'Optimized prompt',
        functionMode: 'basic',
        optimizationMode: 'system',
      })

      await triggerSaveExample(wrapper)
      wrapper.unmount()
    }

    expect(historyManager.getChain).toHaveBeenCalledWith('chain-1')
    const savedExamples = handleSaveFavorite.mock.calls.map((call) =>
      call[0].prefill.reproducibilityDraft.examples[0],
    )
    expect(savedExamples.map((example) => example.basedOnVersionId)).toEqual([
      'chain-1:root',
      'record-2',
      'record-1',
      'implicit:basic-system:draft',
    ])
    expect(savedExamples[3].source).toMatchObject({
      kind: 'workspace',
      id: 'implicit:basic-system',
      metadata: {
        chainId: 'chain-1',
        assetBinding: {
          assetId: 'asset-text',
          versionId: 'asset-version-text',
          status: 'linked',
        },
        origin: {
          kind: 'favorite',
          id: 'favorite-text',
        },
      },
    })
  })

  it('falls back to the synchronous projection when history hydration fails', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const historyManager = {
      getChain: vi.fn(async () => {
        throw new Error('history unavailable')
      }),
    }
    const { pinia } = createTestPinia({
      historyManager: historyManager as any,
    })
    const handleSaveFavorite = vi.fn()
    const session = useBasicSystemSession(pinia)

    session.prompt = 'Original prompt'
    session.optimizedPrompt = 'Optimized prompt'
    session.chainId = 'chain-1'
    session.testContent = 'Input'
    session.testVariants = [
      { id: 'a', version: 2, modelKey: 'text-model' },
      { id: 'b', version: 'workspace', modelKey: '' },
      { id: 'c', version: 'workspace', modelKey: '' },
      { id: 'd', version: 'workspace', modelKey: '' },
    ]
    session.testVariantResults = {
      a: { result: 'Record output', reasoning: '' },
      b: { result: '', reasoning: '' },
      c: { result: '', reasoning: '' },
      d: { result: '', reasoning: '' },
    }

    const wrapper = mountButton(pinia, handleSaveFavorite, {
      subModeKey: 'basic-system',
      variantId: 'a',
      content: 'Optimized prompt',
      functionMode: 'basic',
      optimizationMode: 'system',
    })

    await triggerSaveExample(wrapper)

    expect(handleSaveFavorite).toHaveBeenCalledTimes(1)
    expect(handleSaveFavorite.mock.calls[0][0].prefill.reproducibilityDraft.examples[0].basedOnVersionId)
      .toBe('legacy-version:2')

    consoleWarnSpy.mockRestore()
  })

  it('ignores duplicate clicks while the hydrated session is loading', async () => {
    let resolveChain: (chain: PromptRecordChain) => void = () => {}
    const pendingChain = new Promise<PromptRecordChain>((resolve) => {
      resolveChain = resolve
    })
    const historyManager = {
      getChain: vi.fn(() => pendingChain),
    }
    const { pinia } = createTestPinia({
      historyManager: historyManager as any,
    })
    const handleSaveFavorite = vi.fn()
    const session = useBasicSystemSession(pinia)

    session.prompt = 'Original prompt'
    session.optimizedPrompt = 'Optimized prompt'
    session.chainId = 'chain-1'
    session.testContent = 'Input'
    session.testVariants = [
      { id: 'a', version: 2, modelKey: 'text-model' },
      { id: 'b', version: 'workspace', modelKey: '' },
      { id: 'c', version: 'workspace', modelKey: '' },
      { id: 'd', version: 'workspace', modelKey: '' },
    ]
    session.testVariantResults = {
      a: { result: 'Record output', reasoning: '' },
      b: { result: '', reasoning: '' },
      c: { result: '', reasoning: '' },
      d: { result: '', reasoning: '' },
    }

    const wrapper = mountButton(pinia, handleSaveFavorite, {
      subModeKey: 'basic-system',
      variantId: 'a',
      content: 'Optimized prompt',
      functionMode: 'basic',
      optimizationMode: 'system',
    })

    const button = wrapper.get('[data-testid="save-example"]')
    await button.trigger('click')
    expect(button.attributes('disabled')).toBeDefined()

    await button.trigger('click')
    expect(historyManager.getChain).toHaveBeenCalledTimes(1)
    expect(handleSaveFavorite).not.toHaveBeenCalled()

    resolveChain(createHistoryChain())
    await flushPromises()

    expect(handleSaveFavorite).toHaveBeenCalledTimes(1)
  })

  it('warns instead of opening the save dialog when the selected variant has no result', async () => {
    const { pinia } = createTestPinia()
    const handleSaveFavorite = vi.fn()
    const session = useBasicSystemSession(pinia)

    session.optimizedPrompt = 'Optimized prompt'
    session.testContent = 'Input'
    session.testVariants = [
      { id: 'a', version: 'workspace', modelKey: 'text-model' },
      { id: 'b', version: 'workspace', modelKey: '' },
      { id: 'c', version: 'workspace', modelKey: '' },
      { id: 'd', version: 'workspace', modelKey: '' },
    ]
    session.testVariantResults = {
      a: { result: '', reasoning: '' },
      b: { result: '', reasoning: '' },
      c: { result: '', reasoning: '' },
      d: { result: '', reasoning: '' },
    }

    const wrapper = mountButton(pinia, handleSaveFavorite, {
      subModeKey: 'basic-system',
      variantId: 'a',
      content: 'Optimized prompt',
      functionMode: 'basic',
      optimizationMode: 'system',
    })

    await triggerSaveExample(wrapper)

    expect(handleSaveFavorite).not.toHaveBeenCalled()
    expect(toastMock.warning).toHaveBeenCalledWith('favorites.dialog.reproducibility.noTestResultToSave')
  })

  it('saves basic-user and plain text2image results without separate test input', async () => {
    const { pinia } = createTestPinia()
    const handleSaveFavorite = vi.fn()
    const userSession = useBasicUserSession(pinia)
    userSession.optimizedPrompt = 'Write a haiku about rain'
    userSession.testVariants = [
      { id: 'a', version: 'workspace', modelKey: 'user-model' },
      { id: 'b', version: 'workspace', modelKey: '' },
      { id: 'c', version: 'workspace', modelKey: '' },
      { id: 'd', version: 'workspace', modelKey: '' },
    ]
    userSession.testVariantResults = {
      a: { result: 'Soft rain falls gently', reasoning: '', status: 'complete' },
      b: { result: '', reasoning: '' },
      c: { result: '', reasoning: '' },
      d: { result: '', reasoning: '' },
    }

    const userWrapper = mountButton(pinia, handleSaveFavorite, {
      subModeKey: 'basic-user',
      variantId: 'a',
      content: 'Write a haiku about rain',
      functionMode: 'basic',
      optimizationMode: 'user',
    })
    await triggerSaveExample(userWrapper)

    expect(handleSaveFavorite).toHaveBeenCalledTimes(1)
    expect(handleSaveFavorite.mock.calls[0][0]).toMatchObject({
      content: 'Write a haiku about rain',
      prefill: {
        reproducibilityDraft: {
          examples: [{ outputText: 'Soft rain falls gently' }],
        },
      },
    })

    const imageSession = useImageText2ImageSession(pinia)
    imageSession.optimizedPrompt = 'A glowing lantern in snow'
    imageSession.testVariants = [
      { id: 'a', version: 'workspace', modelKey: 'img-model' },
      { id: 'b', version: 'workspace', modelKey: '' },
      { id: 'c', version: 'workspace', modelKey: '' },
      { id: 'd', version: 'workspace', modelKey: '' },
    ]
    imageSession.testVariantResults = {
      a: { images: [{ _type: 'image-ref', id: 'img-out-1' } as any] },
      b: null,
      c: null,
      d: null,
    }

    const imageWrapper = mountButton(pinia, handleSaveFavorite, {
      subModeKey: 'image-text2image',
      variantId: 'a',
      content: 'A glowing lantern in snow',
      functionMode: 'image',
      imageSubMode: 'text2image',
    })
    await triggerSaveExample(imageWrapper)

    expect(handleSaveFavorite).toHaveBeenCalledTimes(2)
    expect(handleSaveFavorite.mock.calls[1][0]).toMatchObject({
      content: 'A glowing lantern in snow',
      prefill: {
        reproducibilityDraft: {
          examples: [{ imageAssetIds: ['img-out-1'] }],
        },
      },
    })
  })

  it('uses captured runSnapshot prompt and input when present, and rejects cancelled outputs', async () => {
    const { pinia } = createTestPinia()
    const handleSaveFavorite = vi.fn()
    const session = useBasicSystemSession(pinia)

    session.prompt = 'New original'
    session.optimizedPrompt = 'New optimized'
    session.testContent = 'New test input'
    session.testVariants = [
      { id: 'a', version: 'workspace', modelKey: 'new-model' },
      { id: 'b', version: 'workspace', modelKey: 'new-model' },
      { id: 'c', version: 'workspace', modelKey: '' },
      { id: 'd', version: 'workspace', modelKey: '' },
    ]
    session.testVariantResults = {
      a: {
        result: 'Original run answer',
        reasoning: '',
        status: 'complete',
        runSnapshot: {
          prompt: 'Original system prompt',
          modelKey: 'original-model',
          version: 0,
          input: { text: 'Original user input' },
        },
      },
      b: {
        result: 'Partial cancelled text',
        reasoning: '',
        status: 'cancelled',
      },
      c: { result: '', reasoning: '' },
      d: { result: '', reasoning: '' },
    }

    const wrapperA = mountButton(pinia, handleSaveFavorite, {
      subModeKey: 'basic-system',
      variantId: 'a',
      content: 'New optimized',
      functionMode: 'basic',
      optimizationMode: 'system',
    })
    await triggerSaveExample(wrapperA)

    expect(handleSaveFavorite).toHaveBeenCalledTimes(1)
    expect(handleSaveFavorite.mock.calls[0][0]).toMatchObject({
      content: 'Original system prompt',
      prefill: {
        reproducibilityDraft: {
          examples: [{
            text: 'Original user input',
            outputText: 'Original run answer',
            metadata: { modelKey: 'original-model' },
          }],
        },
      },
    })

    const wrapperB = mountButton(pinia, handleSaveFavorite, {
      subModeKey: 'basic-system',
      variantId: 'b',
      content: 'New optimized',
      functionMode: 'basic',
      optimizationMode: 'system',
    })
    await triggerSaveExample(wrapperB)

    expect(handleSaveFavorite).toHaveBeenCalledTimes(1)
    expect(toastMock.warning).toHaveBeenCalledWith('favorites.dialog.reproducibility.noTestResultToSave')
  })
})
