import { defineComponent, h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const toastError = vi.fn()

vi.mock('../../../src/composables/ui/useToast', () => ({
  useToast: () => ({
    error: toastError,
    success: vi.fn(),
    warning: vi.fn(),
  }),
}))

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key }),
  }
})

import TestImageAttachmentControl from '../../../src/components/TestImageAttachmentControl.vue'
import TestInputSection from '../../../src/components/TestInputSection.vue'

const NButton = defineComponent({
  name: 'NButton',
  inheritAttrs: false,
  props: {
    disabled: Boolean,
    title: String,
  },
  emits: ['click'],
  template: `
    <button
      class="n-button"
      :disabled="disabled"
      :title="title"
      v-bind="$attrs"
      @click="$emit('click', $event)"
    ><slot name="icon" /><slot /></button>
  `,
})

const NUpload = defineComponent({
  name: 'NUpload',
  props: {
    accept: String,
    defaultUpload: Boolean,
    showFileList: Boolean,
    disabled: Boolean,
  },
  emits: ['before-upload'],
  template: '<div class="n-upload"><slot /></div>',
})

const commonStubs = {
  NButton,
  Button: NButton,
  NUpload,
  Upload: NUpload,
  NIcon: defineComponent({
    name: 'NIcon',
    template: '<span class="n-icon"><slot /></span>',
  }),
  Icon: defineComponent({
    name: 'Icon',
    template: '<span class="n-icon"><slot /></span>',
  }),
  NFlex: defineComponent({
    name: 'NFlex',
    template: '<div class="n-flex"><slot /></div>',
  }),
  Flex: defineComponent({
    name: 'Flex',
    template: '<div class="n-flex"><slot /></div>',
  }),
  NSpace: defineComponent({
    name: 'NSpace',
    template: '<div class="n-space"><slot /></div>',
  }),
  Space: defineComponent({
    name: 'Space',
    template: '<div class="n-space"><slot /></div>',
  }),
  NText: defineComponent({
    name: 'NText',
    template: '<span class="n-text"><slot /></span>',
  }),
  Text: defineComponent({
    name: 'Text',
    template: '<span class="n-text"><slot /></span>',
  }),
  NInput: defineComponent({
    name: 'NInput',
    inheritAttrs: false,
    props: {
      value: String,
      disabled: Boolean,
      type: String,
    },
    emits: ['update:value'],
    template: '<textarea v-bind="$attrs" :value="value" :disabled="disabled" @input="$emit(\'update:value\', $event.target.value)" />',
  }),
  Input: defineComponent({
    name: 'Input',
    inheritAttrs: false,
    props: {
      value: String,
      disabled: Boolean,
      type: String,
    },
    emits: ['update:value'],
    template: '<textarea v-bind="$attrs" :value="value" :disabled="disabled" @input="$emit(\'update:value\', $event.target.value)" />',
  }),
  FullscreenDialog: defineComponent({
    name: 'FullscreenDialog',
    props: ['modelValue', 'title'],
    template: '<div class="fullscreen-dialog"><slot /></div>',
  }),
  AppPreviewImage: defineComponent({
    name: 'AppPreviewImage',
    inheritAttrs: false,
    props: ['src', 'alt'],
    template: '<img class="app-preview-image" :src="src" :alt="alt" v-bind="$attrs" />',
  }),
}

const mountInputSection = (options: Parameters<typeof mount>[1] = {}) =>
  mount(TestInputSection, {
    props: {
      modelValue: 'question',
      label: 'Test content',
      ...options.props,
    },
    slots: options.slots,
    global: {
      stubs: commonStubs,
      ...options.global,
    },
  })

const mountAttachment = (props: Record<string, unknown> = {}) =>
  mount(TestImageAttachmentControl, {
    props,
    global: { stubs: commonStubs },
  })

const emitUpload = async (wrapper: ReturnType<typeof mountAttachment>, file: File) => {
  wrapper.findComponent(NUpload).vm.$emit('before-upload', { file: { file } })
  await flushPromises()
}

describe('TestInputSection', () => {
  beforeEach(() => {
    toastError.mockReset()
  })

  it('keeps the plain-text default free of extra header content', () => {
    const wrapper = mountInputSection({
      props: { enableFullscreen: false, testId: 'basic-system-test-input' },
    })

    expect(wrapper.find('.test-input-section__header-actions').exists()).toBe(false)
    expect(wrapper.get('[data-testid="basic-system-test-input"]').attributes('value')).toBe('question')
  })

  it('renders optional header actions beside the existing fullscreen action', async () => {
    const wrapper = mountInputSection({
      props: { testId: 'basic-system-test-input', enableFullscreen: true },
      slots: {
        'header-actions': '<button data-testid="custom-header-action">image</button>',
      },
    })

    const actions = wrapper.get('.test-input-section__header-actions')
    expect(actions.find('[data-testid="custom-header-action"]').exists()).toBe(true)
    await actions.get('button[title="common.expand"]').trigger('click')
    expect(wrapper.find('.fullscreen-dialog').exists()).toBe(true)
  })

  it('preserves text updates', async () => {
    const wrapper = mountInputSection({ props: { testId: 'basic-system-test-input' } })
    await wrapper.get('[data-testid="basic-system-test-input"]').setValue('updated')
    expect(wrapper.emitted('update:modelValue')).toEqual([['updated']])
  })

  it('keeps shared fullscreen editing available from a footer without a header row', async () => {
    const wrapper = mountInputSection({
      props: { showHeader: false, testId: 'footer-input' },
      slots: {
        footer: ({ openFullscreen }) => h('button', { 'data-testid': 'footer-expand', onClick: openFullscreen }, 'Expand'),
      },
    })
    expect(wrapper.find('.test-input-section__header-actions').exists()).toBe(false)
    const dialog = wrapper.findComponent({ name: 'FullscreenDialog' })
    expect(dialog.props('modelValue')).toBe(false)
    await wrapper.get('[data-testid="footer-expand"]').trigger('click')
    expect(dialog.props('modelValue')).toBe(true)
    await dialog.get('textarea').setValue('edited in fullscreen')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['edited in fullscreen'])
  })
})

describe('TestImageAttachmentControl', () => {
  beforeEach(() => {
    toastError.mockReset()
    vi.stubGlobal('FileReader', class {
      result: string | ArrayBuffer | null = null
      onerror: (() => void) | null = null
      onload: (() => void) | null = null

      readAsDataURL(blob: Blob) {
        const name = (blob as File).name
        const content = name === 'sample.png'
          ? 'png-data'
          : name === 'replacement.jpg'
            ? 'new'
            : 'image-data'
        this.result = `data:${blob.type};base64,${btoa(content)}`
        queueMicrotask(() => this.onload?.())
      }
    })
  })

  it('shows only the compact image action for the pure-text default', () => {
    const wrapper = mountAttachment()

    expect(wrapper.get('[data-testid="basic-system-test-image-add"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="basic-system-test-image-preview"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="basic-system-test-image-remove"]').exists()).toBe(false)
    expect(wrapper.get('.test-image-attachment-control').attributes('title')).toBe('test.image.visionHint')
    expect(wrapper.findComponent(NUpload).props()).toMatchObject({
      accept: 'image/png,image/jpeg',
      defaultUpload: false,
      showFileList: false,
    })
  })

  it('selects one PNG as raw base64 with its MIME type', async () => {
    const wrapper = mountAttachment()
    await emitUpload(wrapper, new File(['png-data'], 'sample.png', { type: 'image/png' }))

    const update = wrapper.emitted('update:modelValue')?.[0]?.[0] as { b64: string; mimeType: string }
    expect(update.mimeType).toBe('image/png')
    expect(update.b64).toBe(btoa('png-data'))
    expect(update.b64).not.toContain('data:image')
  })

  it('replaces an existing image and keeps a single controlled value', async () => {
    const wrapper = mountAttachment({
      modelValue: { b64: btoa('old'), mimeType: 'image/png' },
    })

    expect(wrapper.get('[data-testid="basic-system-test-image-preview"]').attributes('src'))
      .toBe(`data:image/png;base64,${btoa('old')}`)
    await emitUpload(wrapper, new File(['new'], 'replacement.jpg', { type: 'image/jpeg' }))

    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toEqual({
      b64: btoa('new'),
      mimeType: 'image/jpeg',
    })
  })

  it('removes the controlled image', async () => {
    const wrapper = mountAttachment({
      modelValue: { b64: btoa('old'), mimeType: 'image/png' },
    })

    await wrapper.get('[data-testid="basic-system-test-image-remove"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([[null]])
  })

  it('rejects unsupported image formats', async () => {
    const wrapper = mountAttachment()
    await emitUpload(wrapper, new File(['gif'], 'sample.gif', { type: 'image/gif' }))

    expect(toastError).toHaveBeenCalledWith('test.image.unsupportedFormat')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('rejects images larger than 5 MiB', async () => {
    const wrapper = mountAttachment()
    const file = new File(
      [new Uint8Array(5 * 1024 * 1024 + 1)],
      'large.png',
      { type: 'image/png' },
    )
    await emitUpload(wrapper, file)

    expect(toastError).toHaveBeenCalledWith('test.image.tooLarge')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('does not change the image while disabled', async () => {
    const wrapper = mountAttachment({ disabled: true })
    expect(wrapper.get('[data-testid="basic-system-test-image-add"]').attributes('disabled')).toBeDefined()

    await emitUpload(wrapper, new File(['png'], 'sample.png', { type: 'image/png' }))
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('ignores a file read that finishes after the control becomes disabled', async () => {
    let finishRead: (() => void) | undefined
    vi.stubGlobal('FileReader', class {
      result: string | ArrayBuffer | null = null
      onerror: (() => void) | null = null
      onload: (() => void) | null = null

      readAsDataURL(blob: Blob) {
        this.result = `data:${blob.type};base64,${btoa('delayed-image')}`
        finishRead = () => this.onload?.()
      }
    })

    const wrapper = mountAttachment()
    wrapper.findComponent(NUpload).vm.$emit('before-upload', {
      file: { file: new File(['png'], 'delayed.png', { type: 'image/png' }) },
    })
    await wrapper.setProps({ disabled: true })
    finishRead?.()
    await flushPromises()

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})
