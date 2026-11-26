import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import ReferenceImagePicker, { type ReferenceImageItem } from '../../../src/components/media/ReferenceImagePicker.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
  }),
}))

const sampleItems: ReferenceImageItem[] = [
  { id: 'img-1', src: 'data:image/png;base64,AAA', label: 'Image 1', alt: 'First' },
  { id: 'img-2', src: 'data:image/png;base64,BBB', label: 'Image 2', alt: 'Second' },
]

const createDragEvent = (
  type: string,
  { files = [], types = [] }: { files?: File[]; types?: string[] } = {},
) => {
  const event = new Event(type, { bubbles: true, cancelable: true }) as DragEvent
  Object.defineProperty(event, 'dataTransfer', {
    value: {
      files,
      types,
      dropEffect: 'none',
      effectAllowed: 'all',
      setData: vi.fn(),
    },
  })
  return event
}

describe('ReferenceImagePicker', () => {
  it('renders a full-width empty upload card and emits select-files on file input change', async () => {
    const wrapper = mount(ReferenceImagePicker, {
      props: {
        items: [],
        label: 'Reference images',
        uploadTestId: 'ref-upload',
        listTestId: 'ref-list',
        uploadCardTestId: 'ref-upload-card',
      },
    })

    const uploadCard = wrapper.get('[data-testid="ref-upload-card"]')
    expect(uploadCard.classes()).toContain('image-upload-card--empty')

    const file = new File(['abc'], 'cat.png', { type: 'image/png' })
    const input = wrapper.get('input[type="file"]').element as HTMLInputElement
    Object.defineProperty(input, 'files', { value: [file], configurable: true })
    await wrapper.get('input[type="file"]').trigger('change')

    expect(wrapper.emitted('select-files')).toEqual([[[file]]])
  })

  it('shows the release prompt for external file drops and keeps the supplied order', async () => {
    const wrapper = mount(ReferenceImagePicker, {
      props: {
        items: sampleItems,
        multiple: true,
        reorderable: true,
        uploadTestId: 'ref-upload',
        uploadCardTestId: 'ref-upload-card',
      },
    })

    const surface = wrapper.get('.reference-image-picker__surface')
    const fileA = new File(['a'], 'a.png', { type: 'image/png' })
    const fileB = new File(['b'], 'b.png', { type: 'image/png' })

    surface.element.dispatchEvent(createDragEvent('dragenter', { types: ['Files'] }))
    await wrapper.vm.$nextTick()
    expect(surface.get('[role="status"]').text()).toBe('imageWorkspace.upload.dropToUpload')

    surface.element.dispatchEvent(createDragEvent('dragleave', { types: ['Files'] }))
    await wrapper.vm.$nextTick()
    expect(surface.find('[role="status"]').exists()).toBe(false)

    surface.element.dispatchEvent(createDragEvent('dragenter', { types: ['Files'] }))

    surface.element.dispatchEvent(createDragEvent('drop', { files: [fileA, fileB], types: ['Files'] }))
    await wrapper.vm.$nextTick()

    expect(surface.find('[role="status"]').exists()).toBe(false)
    expect(wrapper.emitted('select-files')).toEqual([[[fileA, fileB]]])
    expect(wrapper.emitted('reorder')).toBeUndefined()
  })

  it('supports single-file replace via external drop and replace button when max=1', async () => {
    const wrapper = mount(ReferenceImagePicker, {
      props: {
        items: [sampleItems[0]],
        multiple: false,
        max: 1,
        replaceable: true,
        uploadCardTestId: 'ref-upload-card',
        replaceTestId: 'ref-replace',
      },
    })

    expect(wrapper.find('[data-testid="ref-upload-card"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="ref-replace"]').exists()).toBe(true)

    const fileA = new File(['a'], 'first.png', { type: 'image/png' })
    const fileB = new File(['b'], 'second.png', { type: 'image/png' })
    const surface = wrapper.get('.reference-image-picker__surface')
    surface.element.dispatchEvent(createDragEvent('drop', { files: [fileA, fileB], types: ['Files'] }))
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('select-files')).toEqual([[[fileA]]])
  })

  it('reorders cards internally without triggering select-files', async () => {
    const wrapper = mount(ReferenceImagePicker, {
      props: {
        items: sampleItems,
        reorderable: true,
        cardTestIdPrefix: 'ref-card',
        uploadCardTestId: 'ref-upload-card',
      },
    })

    const firstFooter = wrapper.get('[data-testid="ref-card-1"] .image-card__footer')
    const secondCard = wrapper.get('[data-testid="ref-card-2"]')

    firstFooter.element.dispatchEvent(createDragEvent('dragstart'))
    secondCard.element.dispatchEvent(createDragEvent('dragover'))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.reference-image-picker__drop-overlay').exists()).toBe(false)

    secondCard.element.dispatchEvent(createDragEvent('drop'))
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('reorder')).toEqual([[0, 1]])
    expect(wrapper.emitted('select-files')).toBeUndefined()
  })

  it('emits remove, supports compact reorder buttons, and renders card-extra slot', async () => {
    const wrapper = mount(ReferenceImagePicker, {
      props: {
        items: sampleItems,
        reorderable: true,
        compact: true,
        cardTestIdPrefix: 'ref-card',
      },
      slots: {
        'card-extra': ({ index }: { index: number }) => `role-select-${index}`,
      },
    })

    expect(wrapper.text()).toContain('role-select-0')
    expect(wrapper.text()).toContain('role-select-1')

    await wrapper.get('[data-testid="ref-card-1"] .image-card__remove').trigger('click')
    expect(wrapper.emitted('remove')?.[0]?.[0]).toBe(0)

    const moveLaterBtn = wrapper.findAll('[data-testid="ref-card-1"] .image-card__reorder button')[1]
    await moveLaterBtn.trigger('click')
    expect(wrapper.emitted('reorder')).toEqual([[0, 1]])
  })
})
