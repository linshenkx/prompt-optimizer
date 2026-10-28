<template>
  <NPopover
    v-if="isPromptGardenEnabled"
    ref="popoverInstRef"
    v-model:show="popoverVisible"
    trigger="manual"
    placement="bottom-end"
    flip
    :show-arrow="false"
    :style="{ padding: '0' }"
    :content-style="{ padding: '0' }"
    @clickoutside="handleClickOutside"
  >
    <template #trigger>
      <NButton
        type="tertiary"
        size="small"
        ghost
        round
        class="prompt-garden-inspiration-trigger"
        :disabled="disabled"
        :data-testid="`${rootTestId}-trigger`"
        @click="handleTriggerClick"
        @mouseenter="handleTriggerMouseEnter"
        @mouseleave="handleTriggerMouseLeave"
        @focus="handleTriggerFocus"
        @blur="handleTriggerBlur"
        @keydown.esc.stop.prevent="closePopover"
      >
        <template #icon>
          <NIcon :size="16">
            <Plant2 />
          </NIcon>
        </template>
        {{ t('common.promptGarden.inspirationTrigger') }}
      </NButton>
    </template>

    <div
      ref="popoverBodyRef"
      class="prompt-garden-inspiration-popover"
      :data-testid="`${rootTestId}-popover`"
      @mouseenter="handlePopoverMouseEnter"
      @mouseleave="handlePopoverMouseLeave"
      @focusin.capture="handlePopoverFocusIn"
      @focusout.capture="handlePopoverFocusOut"
      @keydown.esc.stop.prevent="closePopover"
    >
      <div class="prompt-garden-inspiration-popover__header">
        <div class="prompt-garden-inspiration-popover__title">
          <NIcon :size="16">
            <Plant2 />
          </NIcon>
          <NText strong>
            {{ hasPrompt ? t('common.promptGarden.inspirationTitle') : t('common.promptGarden.inspirationStartTitle') }}
          </NText>
        </div>
        <NButton
          size="tiny"
          quaternary
          circle
          :disabled="isLoading"
          :title="t('common.promptGarden.refreshSuggestions')"
          :data-testid="`${rootTestId}-refresh`"
          @click="handleRefresh"
        >
          <template #icon>
            <NIcon :size="16">
              <Refresh />
            </NIcon>
          </template>
        </NButton>
      </div>

      <div v-if="isLoading" class="prompt-garden-inspiration-popover__loading">
        <NSpin size="small" />
        <NText depth="3">{{ t('common.promptGarden.loadingSuggestions') }}</NText>
      </div>

      <AppPreviewImageGroup
        v-else-if="suggestions.length > 0"
        class="prompt-garden-inspiration-list"
      >
        <div
          v-for="(item, index) in suggestions"
          :key="`${item.importCode}-${item.id}`"
          class="prompt-garden-inspiration-item"
          :data-testid="`${rootTestId}-suggestion-${index}`"
        >
          <AppPreviewImage
            v-if="item.thumbnailUrl"
            class="prompt-garden-inspiration-item__thumb"
            :src="item.thumbnailUrl"
            :preview-src="item.thumbnailUrl"
            :alt="item.title"
            width="44"
            height="44"
            object-fit="cover"
            loading="lazy"
          />
          <div class="prompt-garden-inspiration-item__body">
            <div class="prompt-garden-inspiration-item__title-row">
              <NText strong class="prompt-garden-inspiration-item__title">
                {{ item.title }}
              </NText>
              <NButton
                size="tiny"
                secondary
                :disabled="disabled"
                :data-testid="`${rootTestId}-suggestion-${index}-apply`"
                @click="handleApply(item)"
              >
                {{ hasPrompt ? t('common.promptGarden.replaceImportShort') : t('common.promptGarden.useShort') }}
              </NButton>
            </div>
            <NText depth="3" class="prompt-garden-inspiration-item__summary">
              {{ item.summary }}
            </NText>
            <div v-if="item.tags.length > 0" class="prompt-garden-inspiration-item__tags">
              <NTag
                v-for="tag in item.tags"
                :key="tag"
                size="small"
                :bordered="false"
              >
                {{ tag }}
              </NTag>
            </div>
          </div>
        </div>
      </AppPreviewImageGroup>

      <div v-else class="prompt-garden-inspiration-popover__empty">
        <NText depth="3">{{ t('common.promptGarden.noSuggestions') }}</NText>
      </div>

      <div class="prompt-garden-inspiration-popover__footer">
        <NButton
          size="tiny"
          text
          :data-testid="`${rootTestId}-browse`"
          @click="handleBrowseMore"
        >
          <template #icon>
            <NIcon :size="16">
              <ExternalLink />
            </NIcon>
          </template>
          {{ t('common.promptGarden.browseMore') }}
        </NButton>
        <NButton
          size="tiny"
          text
          :data-testid="`${rootTestId}-import`"
          @click="handleOpenImport"
        >
          <template #icon>
            <NIcon :size="16">
              <FileImport />
            </NIcon>
          </template>
          {{ t('common.promptGarden.importShort') }}
        </NButton>
      </div>
    </div>
  </NPopover>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch, type Ref } from 'vue'
import { NButton, NIcon, NPopover, NSpin, NTag, NText } from 'naive-ui'
import { ExternalLink, FileInput as FileImport, Sprout as Plant2, RefreshCw as Refresh } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import { getEnvVar } from '@prompt-optimizer/core'
import { openExternalUrl } from '../../utils/open-external-url'
import type { PromptGardenImportRequest } from '../../utils/prompt-garden-import'
import {
  fetchPromptGardenSuggestions,
  type PromptGardenSuggestionItem,
} from '../../utils/prompt-garden-suggestions'
import AppPreviewImage from '../media/AppPreviewImage.vue'
import AppPreviewImageGroup from '../media/AppPreviewImageGroup.vue'

type PopoverInst = {
  syncPosition?: () => void
}

const props = withDefaults(
  defineProps<{
    mode: string
    hasPrompt?: boolean
    disabled?: boolean
    testId?: string
  }>(),
  {
    hasPrompt: false,
    disabled: false,
    testId: 'prompt-garden-inspiration',
  },
)

const emit = defineEmits<{
  apply: [request: PromptGardenImportRequest]
  'open-import': []
}>()

const { t, locale } = useI18n() as unknown as {
  t: (key: string) => string
  locale: Ref<string>
}

const popoverVisible = ref(false)
const isHoveringTrigger = ref(false)
const isHoveringPopover = ref(false)
const isPinnedByClick = ref(false)
const hasFocusWithinPopover = ref(false)
const isLoading = ref(false)
const suggestions = ref<PromptGardenSuggestionItem[]>([])
const browseUrl = ref('')
const shownExclude = ref<string[]>([])
const cacheExpiresAt = ref(0)
const popoverInstRef = ref<PopoverInst | null>(null)
const popoverBodyRef = ref<HTMLElement | null>(null)
const rootTestId = computed(() => props.testId)

let openTimer: ReturnType<typeof setTimeout> | null = null
let closeTimer: ReturnType<typeof setTimeout> | null = null
let loadSequence = 0

const HOVER_OPEN_DELAY = 180
const POPOVER_CLOSE_DELAY = 220

const clearOpenTimer = () => {
  if (!openTimer) return
  clearTimeout(openTimer)
  openTimer = null
}

const clearCloseTimer = () => {
  if (!closeTimer) return
  clearTimeout(closeTimer)
  closeTimer = null
}

onBeforeUnmount(() => {
  clearOpenTimer()
  clearCloseTimer()
})

const isPromptGardenEnabled = computed(() => {
  const value = getEnvVar('VITE_ENABLE_PROMPT_GARDEN_IMPORT').trim().toLowerCase()
  return value === '1' || value === 'true'
})

const promptGardenBaseUrl = computed(() =>
  getEnvVar('VITE_PROMPT_GARDEN_BASE_URL').trim().replace(/\/$/, ''),
)

const fallbackBrowseUrl = computed(() => {
  if (!promptGardenBaseUrl.value) return ''
  const url = new URL(`${promptGardenBaseUrl.value}/prompts`)
  url.searchParams.set('mode', props.mode)
  return url.toString()
})

const promptGardenLocale = computed(() => String(locale.value || '').trim())

const syncPopoverPosition = () => {
  nextTick(() => {
    popoverInstRef.value?.syncPosition?.()
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => popoverInstRef.value?.syncPosition?.())
    }
  })
}

watch(popoverVisible, (visible) => {
  if (visible) {
    syncPopoverPosition()
  }
})

watch(
  () => props.mode,
  () => {
    suggestions.value = []
    browseUrl.value = ''
    shownExclude.value = []
    cacheExpiresAt.value = 0
  },
)

const dedupe = (items: string[]): string[] =>
  Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)))

const rememberShown = (items: PromptGardenSuggestionItem[], nextExclude: string[]) => {
  shownExclude.value = dedupe([
    ...shownExclude.value,
    ...nextExclude,
    ...items.map((item) => item.importCode),
  ])
}

const loadSuggestions = async (options: { force?: boolean } = {}) => {
  if (props.disabled || !isPromptGardenEnabled.value || !promptGardenBaseUrl.value) return

  if (!options.force && suggestions.value.length > 0 && cacheExpiresAt.value > Date.now()) {
    return
  }

  const sequence = ++loadSequence
  isLoading.value = true

  try {
    const result = await fetchPromptGardenSuggestions({
      gardenBaseUrl: promptGardenBaseUrl.value,
      mode: props.mode,
      limit: 3,
      strategy: 'mixed',
      exclude: options.force ? shownExclude.value : [],
      locale: promptGardenLocale.value,
    })

    if (sequence !== loadSequence) return

    suggestions.value = result.items
    browseUrl.value = result.browseUrl
    rememberShown(result.items, result.nextExclude)

    const ttl = result.ttlSeconds ?? 300
    cacheExpiresAt.value = Date.now() + ttl * 1000
  } catch (error) {
    if (sequence !== loadSequence) return
    console.info('[PromptGardenInspiration] Failed to load suggestions:', error)
    suggestions.value = []
    browseUrl.value = fallbackBrowseUrl.value
    cacheExpiresAt.value = Date.now() + 60 * 1000
  } finally {
    if (sequence === loadSequence) {
      isLoading.value = false
      syncPopoverPosition()
    }
  }
}

const openPopover = (options: { pinned?: boolean; immediate?: boolean } = {}) => {
  if (props.disabled) return

  clearCloseTimer()
  clearOpenTimer()

  const open = () => {
    popoverVisible.value = true
    if (options.pinned) {
      isPinnedByClick.value = true
    }
    void loadSuggestions()
  }

  if (options.immediate) {
    open()
    return
  }

  openTimer = setTimeout(open, HOVER_OPEN_DELAY)
}

const closePopover = () => {
  clearOpenTimer()
  clearCloseTimer()
  popoverVisible.value = false
  isPinnedByClick.value = false
  hasFocusWithinPopover.value = false
}

const scheduleClose = () => {
  if (isPinnedByClick.value || hasFocusWithinPopover.value) {
    clearCloseTimer()
    return
  }

  clearCloseTimer()
  closeTimer = setTimeout(() => {
    if (!isHoveringTrigger.value && !isHoveringPopover.value) {
      closePopover()
    }
  }, POPOVER_CLOSE_DELAY)
}

const handleTriggerMouseEnter = () => {
  isHoveringTrigger.value = true
  openPopover()
}

const handleTriggerMouseLeave = () => {
  isHoveringTrigger.value = false
  scheduleClose()
}

const handleTriggerClick = () => {
  if (props.disabled) return

  if (popoverVisible.value && isPinnedByClick.value) {
    closePopover()
    return
  }

  openPopover({ pinned: true, immediate: true })
}

const handleTriggerFocus = () => {
  openPopover({ immediate: true })
}

const handleTriggerBlur = () => {
  scheduleClose()
}

const handlePopoverMouseEnter = () => {
  isHoveringPopover.value = true
  clearCloseTimer()
}

const handlePopoverMouseLeave = () => {
  isHoveringPopover.value = false
  scheduleClose()
}

const handlePopoverFocusIn = () => {
  hasFocusWithinPopover.value = true
  clearCloseTimer()
}

const handlePopoverFocusOut = () => {
  if (typeof document === 'undefined') return

  const body = popoverBodyRef.value
  const updateFocusState = () => {
    const active = document.activeElement
    if (body && active && body.contains(active)) return

    hasFocusWithinPopover.value = false
    scheduleClose()
  }

  if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(updateFocusState)
    return
  }

  updateFocusState()
}

const handleClickOutside = () => {
  if (isPinnedByClick.value || hasFocusWithinPopover.value) {
    closePopover()
  }
}

const handleRefresh = () => {
  void loadSuggestions({ force: true })
}

const handleApply = (item: PromptGardenSuggestionItem) => {
  emit('apply', {
    importCode: item.importCode,
    exampleId: null,
    subModeKey: item.mode || props.mode,
  })
  closePopover()
}

const handleBrowseMore = () => {
  void openExternalUrl(browseUrl.value || fallbackBrowseUrl.value || promptGardenBaseUrl.value, {
    logPrefix: 'PromptGarden',
  })
  closePopover()
}

const handleOpenImport = () => {
  emit('open-import')
  closePopover()
}
</script>

<style scoped>
.prompt-garden-inspiration-trigger {
  border-radius: 999px;
  font-weight: 500;
  white-space: nowrap;
}

.prompt-garden-inspiration-popover {
  width: min(360px, calc(100vw - 32px));
  display: grid;
  gap: 8px;
  padding: 10px;
}

.prompt-garden-inspiration-popover__header,
.prompt-garden-inspiration-popover__footer,
.prompt-garden-inspiration-item__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.prompt-garden-inspiration-popover__title {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  gap: 6px;
  color: color-mix(in srgb, var(--n-success-color) 78%, var(--n-text-color-2));
}

.prompt-garden-inspiration-popover__loading,
.prompt-garden-inspiration-popover__empty {
  min-height: 70px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  text-align: center;
}

.prompt-garden-inspiration-list {
  display: grid;
  gap: 8px;
}

.prompt-garden-inspiration-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 8px;
  padding: 8px;
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  background: color-mix(in srgb, var(--n-color) 92%, var(--n-success-color) 8%);
}

.prompt-garden-inspiration-item__thumb {
  width: 44px;
  height: 44px;
  border-radius: 6px;
  overflow: hidden;
  background: var(--n-border-color);
  cursor: zoom-in;
}

.prompt-garden-inspiration-item__thumb :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.prompt-garden-inspiration-item__body {
  min-width: 0;
  display: grid;
  gap: 4px;
}

.prompt-garden-inspiration-item__title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.prompt-garden-inspiration-item__summary {
  display: -webkit-box;
  overflow: hidden;
  line-height: 1.4;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.prompt-garden-inspiration-item__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.prompt-garden-inspiration-popover__footer {
  padding-top: 2px;
}
</style>
