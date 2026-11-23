import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import type { ImageResult } from '@prompt-optimizer/core'

import { createTestPinia } from '../../utils/pinia-test-helpers'
import SaveTestResultExamplesBatchButton from '../../../src/components/SaveTestResultExamplesBatchButton.vue'
import { useBasicSystemSession } from '../../../src/stores/session/useBasicSystemSession'
import { useImageMultiImageSession } from '../../../src/stores/session/useImageMultiImageSession'

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
      t: (key: string, params?: Record<string, unknown>) =>
        params ? `${key}:${JSON.stringify(params)}` : key,
    }),
  }
})

const stubs = {
  NButton: {
    name: 'NButton',
    template:
      '<button v-bind="$attrs" :disabled="disabled" @click="$emit(\'click\', $event)"><slot name="icon" /><slot /></button>',
    props: ['disabled', 'size', 'loading'],
    emits: ['click'],
  },
  NIcon: { name: 'NIcon', template: '<span><slot /></span>' },
  NText: { name: 'NText', template: '<span><slot /></span>' },
  NScrollbar: { name: 'NScrollbar', template: '<div><slot /></div>' },
  Checkbox: {
    name: 'Checkbox',
    props: ['checked'],
    emits: ['update:checked'],
    template:
      '<label><input type="checkbox" :checked="checked" @change="$emit(\'update:checked\', $event.target.checked)" /><slot /></label>',
  },
  AdaptiveModal: {
    name: 'AdaptiveModal',
    props: ['show', 'positiveText', 'positiveButtonProps', 'onPositiveClick'],
    emits: ['update:show', 'after-leave'],
    methods: {
      close() {
        this.$emit('update:show', false)
        this.$emit('after-leave')
      },
      async confirm() {
        if (await this.onPositiveClick?.() !== false) this.close()
      },
    },
    template: `
      <div v-if="show" data-testid="batch-modal">
        <slot />
        <button data-testid="batch-confirm" :disabled="positiveButtonProps?.disabled" @click="confirm">{{ positiveText }}</button>
        <button data-testid="batch-cancel" @click="close">cancel</button>
      </div>
    `,
  },
}

const mountBatchButton = (
  pinia: ReturnType<typeof createTestPinia>['pinia'],
  handleSaveFavorite: ReturnType<typeof vi.fn>,
  props: Record<string, unknown>,
  addFavorite = vi.fn(async () => 'saved'),
) => mount(SaveTestResultExamplesBatchButton, {
  props: {
    testId: 'save-examples-batch',
    ...props,
  },
  global: {
    plugins: [pinia],
    provide: { handleSaveFavorite, services: ref({ favoriteManager: { addFavorite } }) },
    stubs,
  },
})

const basicSystemProps = {
  subModeKey: 'basic-system',
  content: 'Optimized {{topic}}',
  originalContent: 'Original {{topic}}',
  functionMode: 'basic',
  optimizationMode: 'system',
}

const seedBasicSystemSession = (pinia: ReturnType<typeof createTestPinia>['pinia']) => {
  const session = useBasicSystemSession(pinia)
  session.prompt = 'Original {{topic}}'
  session.optimizedPrompt = 'Optimized {{topic}}'
  session.testContent = 'Input about {{topic}}'
  session.testVariants = [
    { id: 'a', version: 'workspace', modelKey: 'model-a' },
    { id: 'b', version: 'workspace', modelKey: 'model-b' },
    { id: 'c', version: 'workspace', modelKey: 'model-c' },
    { id: 'd', version: 'workspace', modelKey: '' },
  ]
  session.testVariantResults = {
    a: { result: 'Output A', reasoning: '' },
    b: { result: 'Output B', reasoning: '' },
    c: { result: 'Output C', reasoning: '' },
    d: { result: '', reasoning: '' },
  }
  return session
}

const openSelection = async (wrapper: ReturnType<typeof mountBatchButton>) => {
  await wrapper.get('[data-testid="save-examples-batch"]').trigger('click')
  await flushPromises()
}

const seedMixedPrompts = (pinia: ReturnType<typeof createTestPinia>['pinia']) => {
  const session = seedBasicSystemSession(pinia)
  session.testVariantResults.a.runSnapshot = {
    prompt: 'Tested prompt 1 {{topic}}',
    input: { text: 'Input A' },
  }
  session.testVariantResults.b.requestPrompt = '[system]\nOlder tested prompt 2\n\n[user]\nInput B'
  session.testVariantResults.c.runSnapshot = {
    prompt: 'Tested prompt 1 {{topic}}',
    input: { text: 'Input C' },
  }
}

describe('SaveTestResultExamplesBatchButton', () => {
  beforeEach(() => {
    toastMock.error.mockClear()
    toastMock.success.mockClear()
    toastMock.warning.mockClear()
  })

  it('stays hidden when fewer than two columns are ready', () => {
    const { pinia } = createTestPinia()
    seedBasicSystemSession(pinia)

    const wrapper = mountBatchButton(pinia, vi.fn(), {
      ...basicSystemProps,
      variantIds: ['a'],
    })

    expect(wrapper.find('[data-testid="save-examples-batch"]').exists()).toBe(false)
  })

  it('opens the normal favorite editor directly when the columns share a prompt', async () => {
    const { pinia } = createTestPinia()
    const handleSaveFavorite = vi.fn()
    seedBasicSystemSession(pinia)

    const wrapper = mountBatchButton(pinia, handleSaveFavorite, {
      ...basicSystemProps,
      variantIds: ['a', 'b', 'c'],
    })

    await openSelection(wrapper)

    expect(handleSaveFavorite).toHaveBeenCalledTimes(1)
    const payload = handleSaveFavorite.mock.calls[0][0]
    expect(payload).toMatchObject({
      content: 'Optimized {{topic}}',
      originalContent: 'Original {{topic}}',
      prefill: {
        functionMode: 'basic',
        optimizationMode: 'system',
        updateIntent: 'examples',
      },
    })
    const examples = payload.prefill.reproducibilityDraft.examples
    expect(examples.map((example: { outputText?: string }) => example.outputText)).toEqual([
      'Output A',
      'Output B',
      'Output C',
    ])
    expect(examples.map((example: { metadata?: Record<string, unknown> }) => example.metadata?.modelKey)).toEqual([
      'model-a',
      'model-b',
      'model-c',
    ])
    expect(new Set(examples.map((example: { id?: string }) => example.id)).size).toBe(3)
    expect(examples.every((example: { text?: string }) => example.text === 'Input about {{topic}}')).toBe(true)
    expect(wrapper.find('[data-testid="batch-modal"]').exists()).toBe(false)
  })

  it('saves configured and legacy results with their own prompts and test inputs', async () => {
    const { pinia } = createTestPinia()
    const handleSaveFavorite = vi.fn()
    seedMixedPrompts(pinia)
    const addFavorite = vi.fn(async () => 'saved')

    const wrapper = mountBatchButton(pinia, handleSaveFavorite, {
      ...basicSystemProps,
      variantIds: ['a', 'b', 'c'],
    }, addFavorite)

    await openSelection(wrapper)
    const checkboxes = wrapper.findAll('input[type="checkbox"]')
    expect(checkboxes).toHaveLength(3)
    expect(checkboxes.every((checkbox) => (checkbox.element as HTMLInputElement).checked)).toBe(true)

    expect(wrapper.get('[data-testid="batch-confirm"]').text()).toContain('"count":2')

    await wrapper.get('[data-testid="batch-confirm"]').trigger('click')
    await flushPromises()

    expect(handleSaveFavorite).not.toHaveBeenCalled()
    expect(addFavorite).toHaveBeenCalledTimes(2)
    expect(addFavorite).toHaveBeenNthCalledWith(1, expect.objectContaining({
      content: 'Tested prompt 1 {{topic}}',
      metadata: expect.objectContaining({
        reproducibility: expect.objectContaining({
          variables: expect.arrayContaining([expect.objectContaining({ name: 'topic' })]),
          examples: [
            expect.objectContaining({ id: 'ex-001', text: 'Input A', outputText: 'Output A' }),
            expect.objectContaining({ id: 'ex-002', text: 'Input C', outputText: 'Output C' }),
          ],
        }),
      }),
    }))
    expect(addFavorite).toHaveBeenNthCalledWith(2, expect.objectContaining({
      content: 'Older tested prompt 2',
      metadata: expect.objectContaining({
        reproducibility: expect.objectContaining({
          examples: [expect.objectContaining({ id: 'ex-001', text: 'Input B', outputText: 'Output B' })],
        }),
      }),
    }))
    expect(wrapper.find('[data-testid="batch-modal"]').exists()).toBe(false)
  })

  it('excludes unchecked columns and retries only groups that did not save', async () => {
    const { pinia } = createTestPinia()
    seedMixedPrompts(pinia)
    const addFavorite = vi.fn(async () => 'saved')
      .mockResolvedValueOnce('first')
      .mockRejectedValueOnce(new Error('Storage error'))
    const wrapper = mountBatchButton(pinia, vi.fn(), {
      ...basicSystemProps,
      variantIds: ['a', 'b', 'c'],
    }, addFavorite)

    await openSelection(wrapper)
    await wrapper.get('[data-testid="save-examples-batch-item-c"] input').setValue(false)
    await wrapper.get('[data-testid="batch-confirm"]').trigger('click')
    await flushPromises()
    expect(addFavorite).toHaveBeenNthCalledWith(1, expect.objectContaining({
      metadata: expect.objectContaining({
        reproducibility: expect.objectContaining({
          examples: [expect.objectContaining({ outputText: 'Output A' })],
        }),
      }),
    }))
    expect(wrapper.get('[data-testid="batch-confirm"]').text()).toContain('"count":1')
    expect(toastMock.error).toHaveBeenCalledTimes(1)
    await wrapper.get('[data-testid="batch-confirm"]').trigger('click')
    await flushPromises()
    expect(addFavorite).toHaveBeenCalledTimes(3)
    expect(addFavorite).toHaveBeenNthCalledWith(3, expect.objectContaining({ content: 'Older tested prompt 2' }))
  })

  it('disables confirmation when nothing is selected and cancels without saving', async () => {
    const { pinia } = createTestPinia()
    const handleSaveFavorite = vi.fn()
    seedMixedPrompts(pinia)

    const wrapper = mountBatchButton(pinia, handleSaveFavorite, {
      ...basicSystemProps,
      variantIds: ['a', 'b'],
    })

    await openSelection(wrapper)
    for (const checkbox of wrapper.findAll('input[type="checkbox"]')) {
      await checkbox.setValue(false)
    }

    expect(wrapper.get('[data-testid="batch-confirm"]').attributes('disabled')).toBeDefined()

    await wrapper.get('[data-testid="batch-cancel"]').trigger('click')
    await flushPromises()

    expect(handleSaveFavorite).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="batch-modal"]').exists()).toBe(false)
  })

  it('skips columns without a successful result', async () => {
    const { pinia } = createTestPinia()
    const handleSaveFavorite = vi.fn()
    seedBasicSystemSession(pinia)

    const wrapper = mountBatchButton(pinia, handleSaveFavorite, {
      ...basicSystemProps,
      variantIds: ['a', 'd'],
    })

    await openSelection(wrapper)

    expect(handleSaveFavorite.mock.calls[0][0].prefill.reproducibilityDraft.examples).toHaveLength(1)
  })

  it('warns instead of opening the selection when no column has a result', async () => {
    const { pinia } = createTestPinia()
    const handleSaveFavorite = vi.fn()
    const session = seedBasicSystemSession(pinia)
    session.testVariantResults = {
      a: { result: '', reasoning: '' },
      b: { result: '', reasoning: '' },
      c: { result: '', reasoning: '' },
      d: { result: '', reasoning: '' },
    }

    const wrapper = mountBatchButton(pinia, handleSaveFavorite, {
      ...basicSystemProps,
      variantIds: ['a', 'b'],
    })

    await openSelection(wrapper)

    expect(toastMock.warning).toHaveBeenCalledWith('favorites.dialog.reproducibility.noTestResultToSave')
    expect(wrapper.find('[data-testid="batch-modal"]').exists()).toBe(false)
    expect(handleSaveFavorite).not.toHaveBeenCalled()
  })

  it('merges variables and keeps image outputs for multiimage results', async () => {
    const { pinia } = createTestPinia()
    const handleSaveFavorite = vi.fn()
    const session = useImageMultiImageSession(pinia)

    session.originalPrompt = 'Generate {{scene}}'
    session.optimizedPrompt = 'Generate vivid {{scene}}'
    session.temporaryVariables = { scene: 'city' }
    session.testVariants = [
      { id: 'a', version: 'workspace', modelKey: 'image-model-a' },
      { id: 'b', version: 'workspace', modelKey: 'image-model-b' },
      { id: 'c', version: 'workspace', modelKey: '' },
      { id: 'd', version: 'workspace', modelKey: '' },
    ]
    session.testVariantResults = {
      a: { images: [{ b64: 'OUTPUT_A', mimeType: 'image/png' }] } as unknown as ImageResult,
      b: { images: [{ _type: 'image-ref', id: 'output-asset-b' }] } as unknown as ImageResult,
      c: null,
      d: null,
    }

    const wrapper = mountBatchButton(pinia, handleSaveFavorite, {
      subModeKey: 'image-multiimage',
      variantIds: ['a', 'b'],
      content: 'Generate vivid {{scene}}',
      originalContent: 'Generate {{scene}}',
      functionMode: 'image',
      imageSubMode: 'multiimage',
    })

    await openSelection(wrapper)
    const draft = handleSaveFavorite.mock.calls[0][0].prefill.reproducibilityDraft
    expect(draft.variables).toEqual([
      { name: 'scene', required: false, options: [], source: 'test-run' },
    ])
    expect(draft.examples).toHaveLength(2)
    expect(draft.examples[0]).toMatchObject({ images: ['data:image/png;base64,OUTPUT_A'], parameters: { scene: 'city' } })
    expect(draft.examples[1]).toMatchObject({ imageAssetIds: ['output-asset-b'] })
  })
})
