import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

import FavoriteReproducibilityEditor from '../../../src/components/FavoriteReproducibilityEditor.vue'

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
    template: '<button class="n-button" @click="$emit(\'click\', $event)"><slot /></button>',
    emits: ['click'],
  },
  NCard: {
    name: 'NCard',
    template: '<section class="n-card"><slot /></section>',
    props: ['size', 'title', 'segmented'],
  },
  NCheckbox: {
    name: 'NCheckbox',
    template: '<label class="n-checkbox"><input type="checkbox" :checked="checked" @change="$emit(\'update:checked\', $event.target.checked)" /><slot /></label>',
    props: ['checked'],
    emits: ['update:checked'],
  },
  NDivider: {
    name: 'NDivider',
    template: '<hr class="n-divider" />',
  },
  NEmpty: {
    name: 'NEmpty',
    template: '<div class="n-empty">{{ description }}</div>',
    props: ['description', 'size'],
  },
  NGrid: {
    name: 'NGrid',
    template: '<div class="n-grid"><slot /></div>',
    props: ['cols', 'xGap', 'yGap', 'responsive'],
  },
  NGridItem: {
    name: 'NGridItem',
    template: '<div class="n-grid-item"><slot /></div>',
  },
  NInput: {
    name: 'NInput',
    template: '<input class="n-input" :placeholder="placeholder" :value="value" @input="$emit(\'update:value\', $event.target.value)" />',
    props: ['value', 'placeholder', 'type', 'autosize'],
    emits: ['update:value'],
  },
  NSelect: {
    name: 'NSelect',
    template: '<select class="n-select" :value="value" @change="$emit(\'update:value\', $event.target.value)"><option value=""></option><option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option></select>',
    props: ['value', 'options', 'clearable', 'placeholder'],
    emits: ['update:value'],
  },
  NSpace: {
    name: 'NSpace',
    template: '<div class="n-space"><slot /></div>',
    props: ['vertical', 'size', 'align', 'wrap'],
  },
  NTag: {
    name: 'NTag',
    template: '<span class="n-tag"><slot /></span>',
    props: ['size', 'type', 'bordered'],
  },
  NText: {
    name: 'NText',
    template: '<span class="n-text"><slot /></span>',
    props: ['depth', 'strong'],
  },
  NUpload: {
    name: 'NUpload',
    template: '<div class="n-upload" @click="handleClick"><slot /></div>',
    props: ['accept', 'multiple', 'defaultUpload', 'showFileList', 'onBeforeUpload'],
    emits: ['before-upload'],
    data: () => ({
      testBlob: new Blob(['upload'], { type: 'image/png' }),
    }),
    methods: {
      handleClick() {
        const payload = { file: { file: this.testBlob } }
        if (typeof this.onBeforeUpload === 'function') {
          this.onBeforeUpload(payload)
        }
        this.$emit('before-upload', payload)
      },
    },
  },
  AppPreviewImage: {
    name: 'AppPreviewImage',
    template: '<img class="app-preview-image" :src="src" :alt="alt" />',
    props: ['src', 'alt', 'objectFit', 'class'],
  },
  AppPreviewImageGroup: {
    name: 'AppPreviewImageGroup',
    template: '<div class="app-preview-image-group"><slot /></div>',
  },
}

const findField = (wrapper: any, testId: string) =>
  wrapper.find(
    `[data-testid="${testId}"] textarea, ` +
    `[data-testid="${testId}"] input, ` +
    `textarea[data-testid="${testId}"], ` +
    `input[data-testid="${testId}"]`,
  )

const mountComponent = () =>
  mount(FavoriteReproducibilityEditor, {
    props: {
      variables: [],
      examples: [],
    },
    global: {
      stubs: naiveStubs,
    },
  })

describe('FavoriteReproducibilityEditor', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('respects variable and example visibility switches', () => {
    const wrapper = mount(FavoriteReproducibilityEditor, {
      props: {
        variables: [{ name: 'style', required: true }],
        examples: [{ id: 'ex-1', parameters: { style: 'ink' } }],
        showExamples: false,
      },
      global: {
        stubs: naiveStubs,
      },
    })

    expect(wrapper.find('[data-testid="favorite-repro-variable-name"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="favorite-repro-add-example"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('favorites.dialog.reproducibility.examples')
  }, 15000)

  it('keeps existing examples in display mode until explicitly edited in review mode', async () => {
    const wrapper = mount(FavoriteReproducibilityEditor, {
      props: {
        variables: [],
        examples: [
          { id: 'ex-001', text: 'Existing example', parameters: {}, images: [], imageAssetIds: [], inputImages: [], inputImageAssetIds: [] },
        ],
        panelMode: 'review',
      },
      global: {
        stubs: naiveStubs,
      },
    })

    expect(wrapper.find('[data-testid="favorite-repro-edit-example"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="favorite-repro-example-text"]').exists()).toBe(false)

    await wrapper.find('[data-testid="favorite-repro-edit-example"]').trigger('click')

    expect(wrapper.find('[data-testid="favorite-repro-example-text"]').exists()).toBe(true)
  })

  it('does not carry review edit state to a different example list with reused ids', async () => {
    const wrapper = mount(FavoriteReproducibilityEditor, {
      props: {
        variables: [],
        examples: [
          { id: 'ex-001', text: 'First favorite example', parameters: {}, images: [], imageAssetIds: [], inputImages: [], inputImageAssetIds: [] },
        ],
        panelMode: 'review',
      },
      global: {
        stubs: naiveStubs,
      },
    })

    await wrapper.find('[data-testid="favorite-repro-edit-example"]').trigger('click')
    expect(wrapper.find('[data-testid="favorite-repro-example-text"]').exists()).toBe(true)

    await wrapper.setProps({
      examples: [
        { id: 'ex-001', text: 'Second favorite example', parameters: {}, images: [], imageAssetIds: [], inputImages: [], inputImageAssetIds: [] },
      ],
    })

    expect(wrapper.find('[data-testid="favorite-repro-edit-example"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="favorite-repro-example-text"]').exists()).toBe(false)
  })

  it('opens newly added examples in edit mode even when reviewing existing examples', async () => {
    const wrapper = mount(FavoriteReproducibilityEditor, {
      props: {
        variables: [],
        examples: [],
        panelMode: 'review',
      },
      global: {
        stubs: naiveStubs,
      },
    })

    await wrapper.find('[data-testid="favorite-repro-add-example"]').trigger('click')
    const nextExamples = wrapper.emitted('update:examples')?.[0]?.[0]
    await wrapper.setProps({ examples: nextExamples })

    expect(wrapper.find('[data-testid="favorite-repro-example-text"]').exists()).toBe(true)
  })

  it('keeps a newly added review example editable after the user fills its id', async () => {
    const wrapper = mount(FavoriteReproducibilityEditor, {
      props: {
        variables: [],
        examples: [],
        panelMode: 'review',
      },
      global: {
        stubs: naiveStubs,
      },
    })

    await wrapper.find('[data-testid="favorite-repro-add-example"]').trigger('click')
    await wrapper.setProps({ examples: wrapper.emitted('update:examples')?.[0]?.[0] })

    await findField(wrapper, 'favorite-repro-example-id').setValue('custom-id')
    await wrapper.setProps({ examples: wrapper.emitted('update:examples')?.at(-1)?.[0] })

    expect(wrapper.find('[data-testid="favorite-repro-example-text"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="favorite-repro-edit-example"]').exists()).toBe(false)
  })

  it('lets users add and edit variable configuration', async () => {
    const wrapper = mountComponent()

    await wrapper.findAll('.n-button')[0].trigger('click')
    const nextVariables = wrapper.emitted('update:variables')?.[0]?.[0]

    expect(nextVariables).toEqual([
      {
        name: '',
        required: false,
        options: [],
      },
    ])

    await wrapper.setProps({ variables: nextVariables })
    await wrapper.find('[data-testid="favorite-repro-variable-name"] input').setValue('style')

    expect(wrapper.emitted('update:variables')?.at(-1)?.[0]).toEqual([
      {
        name: 'style',
        required: false,
        options: [],
      },
    ])
  })

  it('lets users add and edit example parameters', async () => {
    const wrapper = mountComponent()

    await wrapper.findAll('.n-button')[1].trigger('click')
    const nextExamples = wrapper.emitted('update:examples')?.[0]?.[0]

    expect(nextExamples).toEqual([
      {
        parameters: {},
        images: [],
        imageAssetIds: [],
        inputImages: [],
        inputImageAssetIds: [],
      },
    ])

    await wrapper.setProps({ examples: nextExamples })
    await findField(wrapper, 'favorite-repro-example-parameter-key').setValue('style')
    await findField(wrapper, 'favorite-repro-example-parameter-new-value').setValue('ink')
    await wrapper.find('[data-testid="favorite-repro-example-add-parameter"]').trigger('click')

    const examplesWithStyle = wrapper.emitted('update:examples')?.at(-1)?.[0]
    await wrapper.setProps({ examples: examplesWithStyle })
    await findField(wrapper, 'favorite-repro-example-parameter-key').setValue('size')
    await findField(wrapper, 'favorite-repro-example-parameter-new-value').setValue('large')
    await wrapper.find('[data-testid="favorite-repro-example-add-parameter"]').trigger('click')

    expect(wrapper.emitted('update:examples')?.at(-1)?.[0]).toEqual([
      {
        parameters: {
          style: 'ink',
          size: 'large',
        },
        images: [],
        imageAssetIds: [],
        inputImages: [],
        inputImageAssetIds: [],
      },
    ])
  })

  it('lets users edit example output and input image urls', async () => {
    const wrapper = mountComponent()

    await wrapper.findAll('.n-button')[1].trigger('click')
    const nextExamples = wrapper.emitted('update:examples')?.[0]?.[0]
    await wrapper.setProps({ examples: nextExamples })

    await findField(wrapper, 'favorite-repro-example-output-text').setValue('Edited output text')
    const examplesWithOutputText = wrapper.emitted('update:examples')?.at(-1)?.[0]
    await wrapper.setProps({ examples: examplesWithOutputText })

    await findField(wrapper, 'favorite-repro-example-images').setValue('https://example.com/output.png')
    await wrapper.find('[data-testid="favorite-repro-example-add-image-url"]').trigger('click')
    const examplesWithOutputImages = wrapper.emitted('update:examples')?.at(-1)?.[0]
    await wrapper.setProps({ examples: examplesWithOutputImages })

    await findField(wrapper, 'favorite-repro-example-input-images').setValue('https://example.com/input.png')
    await wrapper.find('[data-testid="favorite-repro-example-add-input-image-url"]').trigger('click')

    expect(wrapper.emitted('update:examples')?.at(-1)?.[0]).toEqual([
      {
        parameters: {},
        outputText: 'Edited output text',
        images: ['https://example.com/output.png'],
        imageAssetIds: [],
        inputImages: ['https://example.com/input.png'],
        inputImageAssetIds: [],
      },
    ])
  })

  it('lets users edit, add, and remove example conversation messages', async () => {
    const wrapper = mount(FavoriteReproducibilityEditor, {
      props: {
        variables: [],
        examples: [
          {
            id: 'ex-1',
            messages: [{ role: 'user', content: 'Original user input' }],
            parameters: {},
            images: [],
            imageAssetIds: [],
            inputImages: [],
            inputImageAssetIds: [],
          },
        ],
      },
      global: {
        stubs: naiveStubs,
      },
    })

    await findField(wrapper, 'favorite-repro-example-message-content').setValue('Edited user input')
    let nextExamples = wrapper.emitted('update:examples')?.at(-1)?.[0]
    await wrapper.setProps({ examples: nextExamples })

    expect(wrapper.emitted('update:examples')?.at(-1)?.[0]).toEqual([
      {
        id: 'ex-1',
        messages: [{ role: 'user', content: 'Edited user input' }],
        parameters: {},
        images: [],
        imageAssetIds: [],
        inputImages: [],
        inputImageAssetIds: [],
      },
    ])

    await wrapper.find('[data-testid="favorite-repro-example-add-message"]').trigger('click')
    nextExamples = wrapper.emitted('update:examples')?.at(-1)?.[0]
    await wrapper.setProps({ examples: nextExamples })

    expect(wrapper.emitted('update:examples')?.at(-1)?.[0][0].messages).toEqual([
      { role: 'user', content: 'Edited user input' },
      { role: 'user', content: '' },
    ])

    await wrapper.findAll('[data-testid="favorite-repro-example-remove-message"]')[0].trigger('click')

    expect(wrapper.emitted('update:examples')?.at(-1)?.[0][0].messages).toEqual([
      { role: 'user', content: '' },
    ])
  })

  it('does not carry unsaved example drafts onto the next example after removal', async () => {
    const wrapper = mount(FavoriteReproducibilityEditor, {
      props: {
        variables: [],
        examples: [
          {
            id: 'ex-1',
            parameters: {},
            images: [],
            imageAssetIds: [],
            inputImages: [],
            inputImageAssetIds: [],
          },
          {
            id: 'ex-2',
            parameters: {},
            images: [],
            imageAssetIds: [],
            inputImages: [],
            inputImageAssetIds: [],
          },
        ],
      },
      global: {
        stubs: naiveStubs,
      },
    })

    await findField(wrapper, 'favorite-repro-example-parameter-key').setValue('stale')
    await findField(wrapper, 'favorite-repro-example-parameter-new-value').setValue('draft')
    await findField(wrapper, 'favorite-repro-example-images').setValue('https://example.com/stale.png')
    await wrapper.findAll('[data-testid="favorite-repro-remove-example"]')[0].trigger('click')

    const remainingExamples = wrapper.emitted('update:examples')?.at(-1)?.[0]
    await wrapper.setProps({ examples: remainingExamples })

    expect((findField(wrapper, 'favorite-repro-example-parameter-key').element as HTMLInputElement).value).toBe('')
    expect((findField(wrapper, 'favorite-repro-example-parameter-new-value').element as HTMLInputElement).value).toBe('')
    expect((findField(wrapper, 'favorite-repro-example-images').element as HTMLInputElement).value).toBe('')
  }, 15_000)

  it('shows persisted example asset previews separately from editable urls', () => {
    const wrapper = mount(FavoriteReproducibilityEditor, {
      props: {
        variables: [],
        examples: [
          {
            parameters: {},
            images: [],
            imageAssetIds: ['asset-output'],
            inputImages: [],
            inputImageAssetIds: ['asset-input'],
          },
        ],
        examplePreviews: [
          {
            images: [{ assetId: 'asset-output', source: 'data:image/png;base64,output-preview' }],
            inputImages: [{ assetId: 'asset-input', source: 'data:image/png;base64,input-preview' }],
          },
        ],
      },
      global: {
        stubs: naiveStubs,
      },
    })

    const previewImages = wrapper.findAll('.app-preview-image')
    expect(previewImages.map((image) => image.attributes('src'))).toEqual([
      'data:image/png;base64,output-preview',
      'data:image/png;base64,input-preview',
    ])
    expect((findField(wrapper, 'favorite-repro-example-images').element as HTMLInputElement).value).toBe('')
    expect((findField(wrapper, 'favorite-repro-example-input-images').element as HTMLInputElement).value).toBe('')
  })

  it('emits an explicit request to add example images to the favorite image list', async () => {
    const wrapper = mount(FavoriteReproducibilityEditor, {
      props: {
        variables: [],
        examples: [
          {
            parameters: {},
            images: ['data:image/png;base64,output-source'],
            imageAssetIds: ['asset-output'],
            inputImages: ['data:image/png;base64,input-source'],
            inputImageAssetIds: ['asset-input'],
          },
        ],
        examplePreviews: [
          {
            images: [{ assetId: 'asset-output', source: 'data:image/png;base64,output-preview' }],
            inputImages: [{ assetId: 'asset-input', source: 'data:image/png;base64,input-preview' }],
          },
        ],
      },
      global: {
        stubs: naiveStubs,
      },
    })

    await wrapper.find('[data-testid="favorite-repro-example-add-image-to-media"]').trigger('click')
    await wrapper.find('[data-testid="favorite-repro-example-add-input-image-to-media"]').trigger('click')

    expect(wrapper.emitted('add-image-to-media')?.[0]?.[0]).toMatchObject({
      exampleIndex: 0,
      field: 'images',
      source: 'data:image/png;base64,output-source',
    })
    expect(wrapper.emitted('add-image-to-media')?.[1]?.[0]).toMatchObject({
      exampleIndex: 0,
      field: 'inputImages',
      source: 'data:image/png;base64,input-source',
    })
  })

  it('removes persisted example asset previews from the matching asset field', async () => {
    const wrapper = mount(FavoriteReproducibilityEditor, {
      props: {
        variables: [],
        examples: [
          {
            parameters: {},
            images: [],
            imageAssetIds: ['asset-output'],
            inputImages: [],
            inputImageAssetIds: ['asset-input'],
          },
        ],
        examplePreviews: [
          {
            images: [{ assetId: 'asset-output', source: 'data:image/png;base64,output-preview' }],
            inputImages: [{ assetId: 'asset-input', source: 'data:image/png;base64,input-preview' }],
          },
        ],
      },
      global: {
        stubs: naiveStubs,
      },
    })

    await wrapper.find('[data-testid="favorite-repro-example-remove-input-image"]').trigger('click')

    expect(wrapper.emitted('update:examples')?.at(-1)?.[0]).toEqual([
      {
        parameters: {},
        images: [],
        imageAssetIds: ['asset-output'],
        inputImages: [],
        inputImageAssetIds: [],
      },
    ])
  })
})
