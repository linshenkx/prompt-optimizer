import { describe, expect, it, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import type { FullImageData } from '@prompt-optimizer/core'

import FavoriteImportPanel from '../../../src/components/FavoriteImportPanel.vue'
import { createFavoriteResourcePackage } from '../../../src/utils/favorite-resource-package'
import { createFavoriteShareHtml } from '../../../src/utils/favorite-share-export'

const compactViewport = ref(false)
vi.mock('../../../src/composables/ui/useWorkspaceLayout', () => ({
  useWorkspaceLayout: () => ({ isCompact: compactViewport }),
}))

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
}))

const { pushMock, currentRoute } = vi.hoisted(() => {
  const pushMock = vi.fn()
  const currentRoute = {
    value: {
      path: '/favorites',
      query: { keep: '1' },
    },
  }
  return { pushMock, currentRoute }
})

vi.mock('../../../src/composables/ui/useToast', () => ({
  useToast: () => toastMock,
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({
    currentRoute,
    push: pushMock,
  }),
}))

const naiveStubs = {
  NButton: {
    name: 'NButton',
    template: '<button class="n-button" :disabled="disabled" @click="$emit(\'click\', $event)"><slot name="icon" /><slot /></button>',
    props: ['disabled', 'type', 'secondary', 'loading'],
    emits: ['click'],
  },
  NCard: {
    name: 'NCard',
    template: '<section class="n-card"><header>{{ title }}</header><slot /></section>',
    props: ['size', 'title', 'segmented'],
  },
  NIcon: {
    name: 'NIcon',
    template: '<i><slot /></i>',
    props: ['size'],
  },
  NInput: {
    name: 'NInput',
    template: '<textarea :value="value" @input="$emit(\'update:value\', $event.target.value)" />',
    props: ['value', 'type', 'placeholder', 'autosize'],
    emits: ['update:value'],
  },
  NRadio: {
    name: 'NRadio',
    template: '<label><input type="radio" :value="value" /><slot /></label>',
    props: ['value'],
  },
  NRadioGroup: {
    name: 'NRadioGroup',
    template: '<div><slot /></div>',
    props: ['value'],
    emits: ['update:value'],
  },
  NScrollbar: {
    name: 'NScrollbar',
    template: '<div><slot /></div>',
  },
  NSpace: {
    name: 'NSpace',
    template: '<div><slot /></div>',
    props: ['vertical', 'size', 'align', 'justify', 'wrap'],
  },
  NText: {
    name: 'NText',
    template: '<span><slot /></span>',
    props: ['depth'],
  },
  NThing: {
    name: 'NThing',
    template: '<div><slot name="header" /><slot name="description" /><slot name="footer" /></div>',
  },
  NUpload: {
    name: 'NUpload',
    template: '<div><slot /></div>',
    props: ['max', 'accept', 'defaultUpload', 'fileList'],
    emits: ['change'],
  },
  NUploadDragger: {
    name: 'NUploadDragger',
    template: '<div><slot /></div>',
  },
}

const createImage = (id: string, data: string): FullImageData => ({
  metadata: {
    id,
    mimeType: 'image/png',
    sizeBytes: data.length,
    createdAt: 1700000000000,
    accessedAt: 1700000000001,
    source: 'uploaded',
  },
  data: globalThis.btoa(data),
})

const mountPanel = (services: Record<string, unknown>, shallow = true) =>
  mount(FavoriteImportPanel, {
    shallow,
    global: {
      stubs: naiveStubs,
      provide: {
        services: ref(services),
      },
    },
  })

describe('FavoriteImportPanel', () => {
  beforeEach(() => {
    compactViewport.value = false
    toastMock.success.mockReset()
    toastMock.error.mockReset()
    toastMock.warning.mockReset()
    toastMock.info.mockReset()
    pushMock.mockReset()
    currentRoute.value = {
      path: '/favorites',
      query: { keep: '1' },
    }
  })

  it('describes HTML and PNG shares as part of the same file upload entry', () => {
    const wrapper = mountPanel({}, false)

    expect(wrapper.text()).toContain('Same upload entry supports')
    expect(wrapper.text()).toContain('share .html/.htm')
    expect(wrapper.text()).toContain('original .png')
  })

  it('keeps a pasted draft and overwrite choice across compact layouts and submits only on explicit import', async () => {
    const favoriteManager = {
      importFavorites: vi.fn(async () => ({ imported: 1, skipped: 0, errors: [] })),
    }
    compactViewport.value = true
    const wrapper = mountPanel({ favoriteManager }, false)
    const groups = wrapper.findAllComponents('.n-radio-group')
    groups[0].vm.$emit('update:value', 'paste')
    groups[1].vm.$emit('update:value', 'overwrite')
    await flushPromises()
    const input = wrapper.get('[data-testid="favorite-import-paste"] textarea')
    const payload = JSON.stringify({ favorites: [{ title: 'Long draft', content: 'prompt\n'.repeat(100) }] })
    await input.setValue(payload)
    compactViewport.value = false
    await flushPromises()
    compactViewport.value = true
    await flushPromises()
    expect(wrapper.get('[data-testid="favorite-import-paste"] textarea').element).toBe(input.element)
    expect((input.element as HTMLTextAreaElement).value).toBe(payload)
    expect(favoriteManager.importFavorites).not.toHaveBeenCalled()
    await wrapper.get('.favorite-import-panel__buttons').findAll('button')[1].trigger('click')
    await flushPromises()
    expect(favoriteManager.importFavorites).toHaveBeenCalledExactlyOnceWith(payload, { mergeStrategy: 'overwrite' })
    expect(wrapper.emitted('imported')).toHaveLength(1)
    wrapper.unmount()
  })

  it('keeps legacy JSON file import on the file path', async () => {
    const favoriteManager = {
      importFavorites: vi.fn(async () => ({ imported: 1, skipped: 0, errors: [] })),
    }
    const wrapper = mountPanel({ favoriteManager })
    const payload = JSON.stringify({ version: '1.0', favorites: [{ content: 'legacy json' }] })
    const file = new File([payload], 'favorites.json', { type: 'application/json' })

    ;(wrapper.vm as unknown as { fileList: unknown[] }).fileList = [{ file, name: file.name }]
    await (wrapper.vm as unknown as { handleImportConfirm: () => Promise<void> }).handleImportConfirm()
    await flushPromises()

    expect(favoriteManager.importFavorites).toHaveBeenCalledWith(payload, {
      mergeStrategy: 'skip',
    })
    expect(toastMock.success).toHaveBeenCalledWith(expect.stringContaining('Import completed'))
    expect(wrapper.emitted('imported')).toHaveLength(1)
  })

  it('restores zip package resources before importing favorites from the file path', async () => {
    const sourceImage = createImage('cover-asset', 'cover-bytes')
    const exported = await createFavoriteResourcePackage({
      favoriteManager: {
        exportFavorites: vi.fn(async () => JSON.stringify({
          version: '1.0',
          favorites: [
            {
              id: 'fav-1',
              title: 'Image favorite',
              content: 'image prompt',
              createdAt: 1700000000000,
              updatedAt: 1700000000001,
              tags: [],
              useCount: 0,
              functionMode: 'image',
              imageSubMode: 'text2image',
              metadata: {
                media: {
                  coverAssetId: 'cover-asset',
                },
              },
            },
          ],
        })),
      },
      imageStorageService: {
        getImage: vi.fn(async () => sourceImage),
      },
    })
    const file = new File([exported.blob], 'favorites.po-favorites.zip', {
      type: 'application/zip',
    })
    const order: string[] = []
    const favoriteManager = {
      importFavorites: vi.fn(async () => {
        order.push('import:favorites')
        return { imported: 1, skipped: 0, errors: [] }
      }),
    }
    const favoriteImageStorageService = {
      getImage: vi.fn(async () => null),
      saveImage: vi.fn(async (image: FullImageData) => {
        order.push(`save:${image.metadata.id}`)
        return image.metadata.id
      }),
    }
    const wrapper = mountPanel({ favoriteManager, favoriteImageStorageService })

    ;(wrapper.vm as unknown as { fileList: unknown[] }).fileList = [{ file, name: file.name }]
    await (wrapper.vm as unknown as { handleImportConfirm: () => Promise<void> }).handleImportConfirm()
    await flushPromises()

    expect(favoriteImageStorageService.saveImage).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({ id: 'cover-asset' }),
    }))
    expect(favoriteManager.importFavorites).toHaveBeenCalledWith(expect.stringContaining('"favorites"'), {
      mergeStrategy: 'skip',
    })
    expect(order).toEqual(['save:cover-asset', 'import:favorites'])
    expect(wrapper.emitted('imported')).toHaveLength(1)
  })

  it('imports favorite share HTML through the package restore path', async () => {
    const share = await createFavoriteShareHtml({
      favorite: {
        id: 'fav-share',
        title: 'Share favorite',
        content: 'shared prompt',
        createdAt: 1700000000000,
        updatedAt: 1700000000001,
        tags: [],
        useCount: 0,
        functionMode: 'basic',
        optimizationMode: 'system',
      },
      sections: {
        description: true,
        content: true,
        tags: true,
        media: true,
        variables: true,
        examples: true,
        versions: false,
        watermark: true,
      },
      imageStorageServices: [],
    })
    const file = new File([share.blob], 'share.po-favorite-share.html', {
      type: 'text/html',
    })
    const favoriteManager = {
      importFavorites: vi.fn(async () => ({ imported: 1, skipped: 0, errors: [] })),
    }
    const wrapper = mountPanel({ favoriteManager })

    ;(wrapper.vm as unknown as { fileList: unknown[] }).fileList = [{ file, name: file.name }]
    await (wrapper.vm as unknown as { handleImportConfirm: () => Promise<void> }).handleImportConfirm()
    await flushPromises()

    expect(favoriteManager.importFavorites).toHaveBeenCalledWith(expect.stringContaining('Share favorite'), {
      mergeStrategy: 'skip',
    })
    expect(wrapper.emitted('imported')).toHaveLength(1)
  })

  it('routes Prompt Garden import codes to the save-favorite flow', async () => {
    const wrapper = mountPanel({})

    ;(wrapper.vm as unknown as { source: string; gardenImportInput: string }).source = 'garden'
    ;(wrapper.vm as unknown as { source: string; gardenImportInput: string }).gardenImportInput =
      'https://prompt.local/#/image/text2image?importCode=ZH-NB-001@ex-001&exampleId=ex-002'

    await (wrapper.vm as unknown as { handleImportConfirm: () => Promise<void> }).handleImportConfirm()
    await flushPromises()

    expect(pushMock).toHaveBeenCalledWith({
      path: '/favorites',
      query: {
        keep: '1',
        importCode: 'ZH-NB-001',
        saveToFavorites: 'confirm',
      },
    })
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })
})
