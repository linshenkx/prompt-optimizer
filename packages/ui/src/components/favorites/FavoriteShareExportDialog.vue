<template>
  <NModal
    :show="show"
    preset="card"
    :title="t('favorites.share.title')"
    :style="{ width: 'min(96vw, 1120px)' }"
    :mask-closable="!exporting"
    @update:show="handleShowUpdate"
  >
    <NSpace vertical :size="16">
      <NAlert type="info" :show-icon="false">
        {{ t('favorites.share.hint') }}
      </NAlert>

      <div class="favorite-share-export-dialog__body">
        <div class="favorite-share-export-dialog__controls">
          <NCard size="small" :title="t('favorites.share.sectionsTitle')" :segmented="{ content: true }">
            <NSpace vertical :size="12">
              <div class="favorite-share-export-dialog__fixed-list">
                <NTag
                  v-for="section in fixedSectionLabels"
                  :key="section"
                  size="small"
                  round
                  :bordered="false"
                >
                  {{ section }}
                </NTag>
              </div>
              <NText depth="3">
                {{ t('favorites.share.fixedSectionsHint') }}
              </NText>
              <div class="favorite-share-export-dialog__section-grid">
                <NCheckbox v-model:checked="sections.examples">
                  {{ t('favorites.share.sections.examples') }}
                </NCheckbox>
                <NCheckbox v-model:checked="sections.versions">
                  {{ t('favorites.share.sections.versions') }}
                </NCheckbox>
              </div>
            </NSpace>
          </NCard>

        </div>

        <NCard
          class="favorite-share-export-dialog__preview-card"
          size="small"
          :segmented="{ content: true }"
        >
          <template #header>
            {{ t('favorites.share.previewTitle') }}
          </template>
          <template #header-extra>
            <NRadioGroup
              v-model:value="previewFormat"
              size="small"
            >
              <NRadioButton value="html">
                {{ t('favorites.share.previewHtml') }}
              </NRadioButton>
              <NRadioButton value="png">
                {{ t('favorites.share.previewPng') }}
              </NRadioButton>
            </NRadioGroup>
          </template>

          <div class="favorite-share-export-dialog__preview-stage" data-testid="favorite-share-preview">
            <div
              v-if="previewLoading"
              class="favorite-share-export-dialog__preview-state"
              data-testid="favorite-share-preview-loading"
            >
              <NSpin size="small" />
              <NText depth="3">{{ t('favorites.share.previewLoading') }}</NText>
            </div>
            <NAlert
              v-else-if="previewError"
              type="error"
              :show-icon="false"
              data-testid="favorite-share-preview-error"
            >
              {{ previewError }}
            </NAlert>
            <iframe
              v-else-if="previewFormat === 'html' && previewHtml"
              class="favorite-share-export-dialog__preview-frame"
              data-testid="favorite-share-preview-html"
              sandbox="allow-scripts"
              :srcdoc="previewHtml"
            />
            <img
              v-else-if="previewFormat === 'png' && previewImageUrl"
              class="favorite-share-export-dialog__preview-image"
              data-testid="favorite-share-preview-png"
              :src="previewImageUrl"
              :alt="t('favorites.share.previewPngAlt')"
            >
            <NEmpty v-else :description="t('favorites.share.previewEmpty')" />
          </div>
          <NText depth="3" class="favorite-share-export-dialog__preview-hint">
            {{ t('favorites.share.previewHint') }}
          </NText>
        </NCard>
      </div>

      <NSpace justify="space-between" align="center" wrap>
        <NText depth="3">{{ t('favorites.share.originalFileHint') }}</NText>
        <NSpace :size="8">
          <NButton :disabled="exporting" @click="handleShowUpdate(false)">
            {{ t('favorites.share.cancel') }}
          </NButton>
          <NButton
            secondary
            data-testid="favorite-share-export-png"
            :loading="exportingFormat === 'png'"
            :disabled="exporting"
            @click="handleExport('png')"
          >
            {{ t('favorites.share.exportPng') }}
          </NButton>
          <NButton
            type="primary"
            data-testid="favorite-share-export-html"
            :loading="exportingFormat === 'html'"
            :disabled="exporting"
            @click="handleExport('html')"
          >
            {{ t('favorites.share.exportHtml') }}
          </NButton>
        </NSpace>
      </NSpace>
    </NSpace>
  </NModal>
</template>

<script setup lang="ts">
import { computed, inject, onUnmounted, reactive, ref, watch, type Ref } from 'vue'
import {
  NAlert,
  NButton,
  NCard,
  NCheckbox,
  NEmpty,
  NModal,
  NRadioButton,
  NRadioGroup,
  NSpace,
  NSpin,
  NTag,
  NText,
} from 'naive-ui'
import { useI18n } from 'vue-i18n'
import type { FavoritePrompt } from '@prompt-optimizer/core'

import { useToast } from '../../composables/ui/useToast'
import type { AppServices } from '../../types/services'
import { getI18nErrorMessage } from '../../utils/error'
import {
  DEFAULT_FAVORITE_SHARE_SECTIONS,
  createFavoriteShareHtml,
  createFavoriteSharePng,
  type FavoriteShareLabels,
  type FavoriteShareSections,
} from '../../utils/favorite-share-export'

const props = withDefaults(defineProps<{
  show: boolean
  favorite: FavoritePrompt | null
}>(), {
  favorite: null,
})

const emit = defineEmits<{
  'update:show': [value: boolean]
}>()

const { t, locale } = useI18n() as unknown as {
  t: (key: string, params?: Record<string, unknown>) => string
  locale: Ref<string>
}
const message = useToast()
const services = inject<Ref<AppServices | null> | null>('services', null)
const activeLocale = computed(() => String(locale.value || 'en-US'))

const getDefaultShareSections = (): FavoriteShareSections => ({
  ...DEFAULT_FAVORITE_SHARE_SECTIONS,
  description: true,
  content: true,
  tags: true,
  media: true,
  variables: true,
  examples: true,
  versions: false,
  watermark: true,
})

const sections = reactive<FavoriteShareSections>(getDefaultShareSections())
const PRODUCT_WATERMARK = {
  projectName: 'GlobalCloud XiaoC',
  projectUrl: 'https://prompt.always200.com/',
} as const
const previewFormat = ref<'html' | 'png'>('html')
const previewHtml = ref('')
const previewImageUrl = ref('')
const previewLoading = ref(false)
const previewError = ref('')
const exportingFormat = ref<'html' | 'png' | null>(null)
const exporting = computed(() => exportingFormat.value !== null)
let previewTimer: ReturnType<typeof setTimeout> | null = null
let previewBuildId = 0

const fixedSectionLabels = computed(() => [
  t('favorites.share.sections.media'),
  t('favorites.share.sections.description'),
  t('favorites.share.sections.content'),
  t('favorites.share.sections.tags'),
  t('favorites.share.sections.variables'),
  t('favorites.share.sections.watermark'),
])

const buildShareSections = (): FavoriteShareSections => ({
  ...getDefaultShareSections(),
  examples: sections.examples,
  versions: sections.versions,
})

watch(
  () => props.show,
  (visible) => {
    if (!visible) {
      clearPreview()
      return
    }
    Object.assign(sections, getDefaultShareSections())
    previewFormat.value = 'html'
  },
)

const handleShowUpdate = (value: boolean) => {
  if (exporting.value) return
  emit('update:show', value)
}

const buildFileBaseName = () => {
  const title = props.favorite?.title || 'favorite'
  const safeTitle = title
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .slice(0, 48)
    || 'favorite'
  return `${safeTitle}.po-favorite-share`
}

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

const getImageStorageServices = () => {
  const servicesValue = services?.value
  return [
    servicesValue?.favoriteImageStorageService,
    servicesValue?.imageStorageService,
  ]
}

const buildErrorMessage = (summary: string, error: unknown) => {
  const fallback = t('common.error')
  const detail = getI18nErrorMessage(error, fallback)
  return detail === fallback ? summary : `${summary}: ${detail}`
}

const buildFavoriteShareLabels = (): Partial<FavoriteShareLabels> => ({
  htmlLang: activeLocale.value,
  documentTitleSuffix: t('favorites.share.document.titleSuffix'),
  eyebrow: t('favorites.share.document.eyebrow'),
  metaPrefix: t('favorites.share.document.metaPrefix'),
  headerImportNote: t('favorites.share.document.headerImportNote'),
  copyButton: t('favorites.share.document.copy'),
  copiedButton: t('favorites.share.document.copied'),
  copyFailedButton: t('favorites.share.document.copyFailed'),
  descriptionTitle: t('favorites.share.sections.description'),
  promptTitle: t('favorites.share.sections.content'),
  tagsTitle: t('favorites.share.sections.tags'),
  modeTitle: t('favorites.share.document.mode'),
  variablesTitle: t('favorites.share.sections.variables'),
  examplesTitle: t('favorites.share.sections.examples'),
  versionsTitle: t('favorites.share.sections.versions'),
  inputTitle: t('favorites.share.document.input'),
  outputTitle: t('favorites.share.document.output'),
  importNoteTitle: t('favorites.share.document.importNoteTitle'),
  currentVersionLabel: t('favorites.share.document.current'),
  htmlImportNoteBody1: t('favorites.share.document.htmlImportNoteBody1'),
  htmlImportNoteBody2: t('favorites.share.document.htmlImportNoteBody2'),
  pngImportNoteText: t('favorites.share.document.pngImportNoteText'),
  pngHeaderBadge: t('favorites.share.document.eyebrow'),
  exampleTitle: (index) => t('favorites.share.document.exampleTitle', { index }),
  exampleOutputAlt: (index) => t('favorites.share.document.exampleOutputAlt', { index }),
  exampleInputAlt: (index) => t('favorites.share.document.exampleInputAlt', { index }),
  versionTitle: (version, isCurrent) => isCurrent
    ? t('favorites.share.document.versionTitleCurrent', {
        version,
        current: t('favorites.share.document.current'),
      })
    : t('favorites.share.document.versionTitle', { version }),
  parameterSummary: (count) => t('favorites.share.document.parameterSummary', { count }),
  outputImageSummary: (count) => t('favorites.share.document.outputImageSummary', { count }),
  inputImageSummary: (count) => t('favorites.share.document.inputImageSummary', { count }),
})

const buildShareOptions = () => ({
  favorite: props.favorite as FavoritePrompt,
  sections: buildShareSections(),
  branding: PRODUCT_WATERMARK,
  labels: buildFavoriteShareLabels(),
  imageStorageServices: getImageStorageServices(),
})

const revokePreviewImageUrl = () => {
  if (previewImageUrl.value && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(previewImageUrl.value)
  }
  previewImageUrl.value = ''
}

const clearPreview = () => {
  if (previewTimer) {
    clearTimeout(previewTimer)
    previewTimer = null
  }
  previewBuildId += 1
  previewLoading.value = false
  previewError.value = ''
  previewHtml.value = ''
  revokePreviewImageUrl()
}

const createPreviewObjectUrl = (blob: Blob) => {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    throw new Error(t('favorites.share.previewObjectUrlUnavailable'))
  }
  return URL.createObjectURL(blob)
}

const refreshPreview = async () => {
  if (!props.show || !props.favorite) {
    clearPreview()
    return
  }

  const buildId = previewBuildId + 1
  previewBuildId = buildId
  previewLoading.value = true
  previewError.value = ''

  try {
    const format = previewFormat.value
    const options = buildShareOptions()
    const result = format === 'html'
      ? await createFavoriteShareHtml(options)
      : await createFavoriteSharePng(options)

    if (buildId !== previewBuildId) return

    if (format === 'html') {
      previewHtml.value = await result.blob.text()
      revokePreviewImageUrl()
    } else {
      previewHtml.value = ''
      revokePreviewImageUrl()
      previewImageUrl.value = createPreviewObjectUrl(result.blob)
    }
  } catch (error) {
    if (buildId !== previewBuildId) return
    previewHtml.value = ''
    revokePreviewImageUrl()
    previewError.value = buildErrorMessage(t('favorites.share.previewFailed'), error)
  } finally {
    if (buildId === previewBuildId) {
      previewLoading.value = false
    }
  }
}

const schedulePreviewRefresh = () => {
  if (!props.show || !props.favorite) {
    clearPreview()
    return
  }
  if (previewTimer) clearTimeout(previewTimer)
  previewTimer = setTimeout(() => {
    previewTimer = null
    void refreshPreview()
  }, 400)
}

watch(
  [
    () => props.show,
    () => props.favorite?.id,
    () => props.favorite?.updatedAt,
    () => sections.examples,
    () => sections.versions,
    () => activeLocale.value,
    () => previewFormat.value,
  ],
  schedulePreviewRefresh,
  { immediate: true },
)

onUnmounted(clearPreview)

const handleExport = async (format: 'html' | 'png') => {
  if (!props.favorite) {
    message.warning(t('favorites.manager.messages.unavailable'))
    return
  }

  exportingFormat.value = format
  try {
    const result = format === 'html'
      ? await createFavoriteShareHtml(buildShareOptions())
      : await createFavoriteSharePng(buildShareOptions())
    const filename = `${buildFileBaseName()}.${format}`
    downloadBlob(result.blob, filename)

    if (result.result.package.missingResourceIds.length > 0) {
      message.warning(t('favorites.share.exportPartialSuccess', {
        count: result.result.package.missingResourceIds.length,
      }))
    } else {
      message.success(t('favorites.share.exportSuccess'))
    }
  } catch (error) {
    message.error(buildErrorMessage(t('favorites.share.exportFailed'), error))
  } finally {
    exportingFormat.value = null
  }
}
</script>

<style scoped>
.favorite-share-export-dialog__body {
  display: grid;
  grid-template-columns: minmax(280px, 340px) minmax(0, 1fr);
  gap: 16px;
  align-items: stretch;
}

.favorite-share-export-dialog__controls {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.favorite-share-export-dialog__fixed-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.favorite-share-export-dialog__section-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
}

.favorite-share-export-dialog__preview-card {
  min-width: 0;
}

.favorite-share-export-dialog__preview-stage {
  min-height: 520px;
  max-height: min(68vh, 680px);
  overflow: auto;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background:
    linear-gradient(45deg, rgba(148, 163, 184, 0.12) 25%, transparent 25%),
    linear-gradient(-45deg, rgba(148, 163, 184, 0.12) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, rgba(148, 163, 184, 0.12) 75%),
    linear-gradient(-45deg, transparent 75%, rgba(148, 163, 184, 0.12) 75%);
  background-position: 0 0, 0 10px, 10px -10px, -10px 0;
  background-size: 20px 20px;
}

.favorite-share-export-dialog__preview-state {
  min-height: 520px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.favorite-share-export-dialog__preview-frame {
  display: block;
  width: 100%;
  height: min(68vh, 680px);
  min-height: 520px;
  border: 0;
  background: #fff;
}

.favorite-share-export-dialog__preview-image {
  display: block;
  width: min(100%, 860px);
  margin: 0 auto;
}

.favorite-share-export-dialog__preview-hint {
  display: block;
  margin-top: 10px;
}

@media (max-width: 900px) {
  .favorite-share-export-dialog__body {
    grid-template-columns: 1fr;
  }

  .favorite-share-export-dialog__preview-stage,
  .favorite-share-export-dialog__preview-state,
  .favorite-share-export-dialog__preview-frame {
    min-height: 360px;
  }
}
</style>
