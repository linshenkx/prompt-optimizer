import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import type { FavoritePrompt } from '@prompt-optimizer/core'

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
}))

const exportMocks = vi.hoisted(() => ({
  createFavoriteShareHtml: vi.fn(),
  createFavoriteSharePng: vi.fn(),
}))

const i18nLocale = vi.hoisted(() => ({ value: 'en-US' }))

const naiveComponents = vi.hoisted(() => ({
  NAlert: {
    name: 'NAlert',
    template: '<div class="n-alert"><slot /></div>',
    props: ['type', 'showIcon'],
  },
  NButton: {
    name: 'NButton',
    template: '<button class="n-button" :disabled="disabled" @click="$emit(\'click\', $event)"><slot /></button>',
    props: ['disabled', 'type', 'secondary', 'loading'],
    emits: ['click'],
  },
  NCard: {
    name: 'NCard',
    template: '<section class="n-card"><header><slot name="header" />{{ title }}<slot name="header-extra" /></header><div><slot /></div></section>',
    props: ['size', 'title', 'segmented', 'class'],
  },
  NCheckbox: {
    name: 'NCheckbox',
    template: '<label><input type="checkbox" :checked="checked" @change="$emit(\'update:checked\', $event.target.checked)" /><slot /></label>',
    props: ['checked'],
    emits: ['update:checked'],
  },
  NEmpty: {
    name: 'NEmpty',
    template: '<div class="n-empty">{{ description }}</div>',
    props: ['description'],
  },
  NInput: {
    name: 'NInput',
    template: '<input class="n-input" :value="value" @input="$emit(\'update:value\', $event.target.value)" />',
    props: ['value', 'placeholder'],
    emits: ['update:value'],
  },
  NModal: {
    name: 'NModal',
    template: '<div v-if="show" class="n-modal"><slot /></div>',
    props: ['show', 'preset', 'title', 'style', 'maskClosable'],
    emits: ['update:show'],
  },
  NRadioButton: {
    name: 'NRadioButton',
    template: '<button type="button" :data-value="value"><slot /></button>',
    props: ['value'],
  },
  NRadioGroup: {
    name: 'NRadioGroup',
    template: '<div class="n-radio-group"><slot /></div>',
    props: ['value', 'size'],
    emits: ['update:value'],
  },
  NSpace: {
    name: 'NSpace',
    template: '<div class="n-space"><slot /></div>',
    props: ['vertical', 'size', 'align', 'justify', 'wrap'],
  },
  NSpin: {
    name: 'NSpin',
    template: '<span class="n-spin"></span>',
    props: ['size'],
  },
  NTag: {
    name: 'NTag',
    template: '<span class="n-tag"><slot /></span>',
    props: ['size', 'round', 'bordered'],
  },
  NText: {
    name: 'NText',
    template: '<span class="n-text"><slot /></span>',
    props: ['depth', 'class'],
  },
}))

vi.mock('../../../src/composables/ui/useToast', () => ({
  useToast: () => toastMock,
}))

vi.mock('naive-ui', () => naiveComponents)

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({
      locale: i18nLocale,
      t: (key: string, params?: Record<string, unknown>) => {
        const messages: Record<string, string> = {
          'favorites.share.title': 'Export Share',
          'favorites.share.hint': 'Core content stays with the share file',
          'favorites.share.sectionsTitle': 'Share Content',
          'favorites.share.watermarkTitle': 'Project Watermark',
          'favorites.share.projectNamePlaceholder': 'Project name',
          'favorites.share.projectUrlPlaceholder': 'Project URL',
          'favorites.share.fixedSectionsHint': 'Core sections are always included',
          'favorites.share.watermarkHint': 'Watermark is always shown',
          'favorites.share.previewTitle': 'Export Preview',
          'favorites.share.previewHtml': 'HTML',
          'favorites.share.previewPng': 'PNG',
          'favorites.share.previewLoading': 'Generating preview',
          'favorites.share.previewFailed': 'Preview failed',
          'favorites.share.previewEmpty': 'No preview',
          'favorites.share.previewHint': 'Preview matches export',
          'favorites.share.previewPngAlt': 'PNG preview',
          'favorites.share.previewObjectUrlUnavailable': 'No object URL',
          'favorites.share.originalFileHint': 'Use original exported file',
          'favorites.share.cancel': 'Cancel',
          'favorites.share.exportHtml': 'Export HTML',
          'favorites.share.exportPng': 'Export PNG',
          'favorites.share.document.titleSuffix': i18nLocale.value === 'zh-CN' ? 'GlobalCloud XiaoC 收藏分享' : 'GlobalCloud XiaoC Favorite Share',
          'favorites.share.document.eyebrow': i18nLocale.value === 'zh-CN' ? 'GlobalCloud XiaoC 收藏分享' : 'GlobalCloud XiaoC Favorite Share',
          'favorites.share.document.metaPrefix': i18nLocale.value === 'zh-CN' ? '收藏分享' : 'GlobalCloud XiaoC favorite share',
          'favorites.share.document.headerImportNote': i18nLocale.value === 'zh-CN' ? '导入：访问 https://prompt.always200.com/ → 收藏夹 → 导入 → 上传此 HTML 文件。' : 'Import: open https://prompt.always200.com/ -> Favorites -> Import -> upload this HTML file.',
          'favorites.share.document.copy': i18nLocale.value === 'zh-CN' ? '复制' : 'Copy',
          'favorites.share.document.copied': i18nLocale.value === 'zh-CN' ? '已复制' : 'Copied',
          'favorites.share.document.copyFailed': i18nLocale.value === 'zh-CN' ? '复制失败' : 'Failed',
          'favorites.share.document.mode': i18nLocale.value === 'zh-CN' ? '模式' : 'Mode',
          'favorites.share.document.input': i18nLocale.value === 'zh-CN' ? '输入' : 'Input',
          'favorites.share.document.output': i18nLocale.value === 'zh-CN' ? '输出' : 'Output',
          'favorites.share.document.importNoteTitle': i18nLocale.value === 'zh-CN' ? '导入说明' : 'Import Note',
          'favorites.share.document.current': i18nLocale.value === 'zh-CN' ? '当前' : 'current',
          'favorites.share.document.htmlImportNoteBody1': i18nLocale.value === 'zh-CN' ? '导入：访问 https://prompt.always200.com/ → 收藏夹 → 导入 → 上传此 HTML 文件。' : 'Import: open https://prompt.always200.com/ -> Favorites -> Import -> upload this HTML file.',
          'favorites.share.document.htmlImportNoteBody2': i18nLocale.value === 'zh-CN' ? '请使用原始 HTML 文件恢复数据。' : 'Use the original HTML file to restore data.',
          'favorites.share.document.pngImportNoteText': i18nLocale.value === 'zh-CN' ? '导入：访问 https://prompt.always200.com/ → 收藏夹 → 导入 → 上传原始 PNG 文件。\n必须使用原图。' : 'Import: open https://prompt.always200.com/ -> Favorites -> Import -> upload the original PNG file.',
          'favorites.share.document.exampleTitle': i18nLocale.value === 'zh-CN' ? `示例 ${params?.index ?? ''}` : `Example ${params?.index ?? ''}`,
          'favorites.share.document.exampleOutputAlt': i18nLocale.value === 'zh-CN' ? `示例 ${params?.index ?? ''} 输出` : `Example ${params?.index ?? ''} output`,
          'favorites.share.document.exampleInputAlt': i18nLocale.value === 'zh-CN' ? `示例 ${params?.index ?? ''} 输入` : `Example ${params?.index ?? ''} input`,
          'favorites.share.document.versionTitle': `v${params?.version ?? ''}`,
          'favorites.share.document.versionTitleCurrent': `v${params?.version ?? ''} · ${params?.current ?? ''}`,
          'favorites.share.document.parameterSummary': i18nLocale.value === 'zh-CN' ? `${params?.count ?? 0} 个参数` : `${params?.count ?? 0} parameter(s)`,
          'favorites.share.document.outputImageSummary': i18nLocale.value === 'zh-CN' ? `${params?.count ?? 0} 张输出图` : `${params?.count ?? 0} output image(s)`,
          'favorites.share.document.inputImageSummary': i18nLocale.value === 'zh-CN' ? `${params?.count ?? 0} 张输入图` : `${params?.count ?? 0} input image(s)`,
          'favorites.share.sections.description': 'Description',
          'favorites.share.sections.content': 'Prompt content',
          'favorites.share.sections.tags': 'Tags/category',
          'favorites.share.sections.media': 'Image resources',
          'favorites.share.sections.variables': 'Variables',
          'favorites.share.sections.examples': 'Examples',
          'favorites.share.sections.versions': 'Version history',
          'favorites.share.sections.watermark': 'Project watermark',
          'common.error': 'Error',
        }
        return messages[key] ?? key
      },
    }),
  }
})

vi.mock('../../../src/utils/favorite-share-export', () => ({
  DEFAULT_FAVORITE_SHARE_SECTIONS: {
    description: true,
    content: true,
    tags: true,
    media: true,
    variables: true,
    examples: true,
    versions: false,
    watermark: true,
  },
  createFavoriteShareHtml: exportMocks.createFavoriteShareHtml,
  createFavoriteSharePng: exportMocks.createFavoriteSharePng,
}))

import FavoriteShareExportDialog from '../../../src/components/favorites/FavoriteShareExportDialog.vue'

const favorite: FavoritePrompt = {
  id: 'fav-1',
  title: 'Share favorite',
  content: 'Prompt body',
  createdAt: 1700000000000,
  updatedAt: 1700000000001,
  tags: ['image'],
  useCount: 0,
  functionMode: 'image',
  imageSubMode: 'text2image',
}

const mountDialog = () =>
  mount(FavoriteShareExportDialog, {
    props: {
      show: true,
      favorite,
    },
    global: {
      provide: {
        services: ref({}),
      },
    },
  })

describe('FavoriteShareExportDialog', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    i18nLocale.value = 'en-US'
    toastMock.success.mockReset()
    toastMock.error.mockReset()
    toastMock.warning.mockReset()
    toastMock.info.mockReset()
    exportMocks.createFavoriteShareHtml.mockReset()
    exportMocks.createFavoriteSharePng.mockReset()
    exportMocks.createFavoriteShareHtml.mockResolvedValue({
      blob: new Blob(['<html>share preview</html>'], { type: 'text/html' }),
      result: { package: { missingResourceIds: [] } },
    })
    exportMocks.createFavoriteSharePng.mockResolvedValue({
      blob: new Blob(['png'], { type: 'image/png' }),
      result: { package: { missingResourceIds: [] } },
    })
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:preview-png'),
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps core sections fixed and defaults version history off', async () => {
    const wrapper = mountDialog()

    await vi.advanceTimersByTimeAsync(400)
    await flushPromises()

    expect(wrapper.text()).toContain('Image resources')
    expect(wrapper.text()).toContain('Prompt content')
    expect(wrapper.text()).toContain('Project watermark')
    expect(wrapper.findAll('.n-input')).toHaveLength(0)
    expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(2)
    expect(exportMocks.createFavoriteShareHtml).toHaveBeenCalledWith(expect.objectContaining({
      sections: expect.objectContaining({
        description: true,
        content: true,
        tags: true,
        media: true,
        variables: true,
        examples: true,
        versions: false,
        watermark: true,
      }),
      branding: {
        projectName: 'GlobalCloud XiaoC',
        projectUrl: 'https://prompt.always200.com/',
      },
    }))
    expect(wrapper.find('[data-testid="favorite-share-preview-html"]').exists()).toBe(true)
  })

  it('refreshes preview with optional versions and PNG format', async () => {
    const wrapper = mountDialog()
    await vi.advanceTimersByTimeAsync(400)
    await flushPromises()

    const [, versionsCheckbox] = wrapper.findAll('input[type="checkbox"]')
    await versionsCheckbox.setValue(true)
    await vi.advanceTimersByTimeAsync(400)
    await flushPromises()

    expect(exportMocks.createFavoriteShareHtml).toHaveBeenLastCalledWith(expect.objectContaining({
      sections: expect.objectContaining({
        examples: true,
        versions: true,
      }),
    }))

    ;(wrapper.vm as unknown as { previewFormat: 'html' | 'png' }).previewFormat = 'png'
    await nextTick()
    await vi.advanceTimersByTimeAsync(400)
    await flushPromises()

    expect(exportMocks.createFavoriteSharePng).toHaveBeenCalledWith(expect.objectContaining({
      sections: expect.objectContaining({
        versions: true,
        watermark: true,
      }),
    }))
    expect(wrapper.find('[data-testid="favorite-share-preview-png"]').exists()).toBe(true)
  })

  it('passes the active UI locale labels into share generation', async () => {
    i18nLocale.value = 'zh-CN'
    mountDialog()
    await vi.advanceTimersByTimeAsync(400)
    await flushPromises()

    expect(exportMocks.createFavoriteShareHtml).toHaveBeenCalledWith(expect.objectContaining({
      labels: expect.objectContaining({
        htmlLang: 'zh-CN',
        copyButton: '复制',
        importNoteTitle: '导入说明',
      }),
    }))
  })
})
