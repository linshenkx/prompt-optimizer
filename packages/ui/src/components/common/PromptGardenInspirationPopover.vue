<template>
  <NPopover
    v-if="isPromptGardenEnabled"
    ref="popoverInstRef"
    v-model:show="popoverVisible"
    trigger="manual"
    :placement="viewport.layout.value?.placement || 'bottom-end'"
    flip
    :show-arrow="false"
    :style="{ padding: '0' }"
    :content-style="{ padding: '0' }"
    @clickoutside="handleClickOutside"
  >
    <template #trigger>
      <NButton
        ref="triggerRef"
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
        <template #icon
          ><NIcon :size="16"><Plant2 /></NIcon
        ></template>
        {{ label || t('common.promptGarden.inspirationTrigger') }}
      </NButton>
    </template>
    <div
      ref="popoverBodyRef"
      class="prompt-garden-inspiration-popover"
      :class="{ 'prompt-garden-inspiration-popover--images': isImageMode }"
      :style="[
        viewport.menuStyle.value,
        {
          '--garden-border': theme.borderColor,
          '--garden-surface': theme.actionColor,
          '--garden-focus': theme.primaryColor,
          '--garden-title': theme.textColor1,
        },
      ]"
      :data-testid="`${rootTestId}-popover`"
      @mouseenter="handlePopoverMouseEnter"
      @mouseleave="handlePopoverMouseLeave"
      @focusin.capture="handlePopoverFocusIn"
      @focusout.capture="handlePopoverFocusOut"
      @keydown.esc.stop.prevent="closePopover"
    >
      <div class="prompt-garden-inspiration-popover__header" data-header>
        <NRadioGroup
          :value="view"
          size="small"
          :aria-label="label || t('common.promptGarden.inspirationTrigger')"
          @update:value="handleViewChange"
        >
          <NRadioButton
            value="recommended"
            :data-testid="`${rootTestId}-recommended`"
            >{{ t('common.promptGarden.recommended') }}</NRadioButton
          >
          <NRadioButton value="all" :data-testid="`${rootTestId}-all`">{{
            t('common.promptGarden.all')
          }}</NRadioButton>
        </NRadioGroup>
        <NButton
          v-if="view === 'recommended'"
          size="tiny"
          quaternary
          :disabled="loading"
          :data-testid="`${rootTestId}-refresh`"
          @click="handleRefresh"
        >
          <template #icon
            ><NIcon :size="14"><Refresh /></NIcon
          ></template>
          {{ t('common.promptGarden.refreshSuggestions') }}
        </NButton>
        <NText
          v-else-if="catalogLoaded"
          depth="3"
          class="prompt-garden-inspiration-popover__count"
        >
          {{ t('common.promptGarden.itemCount', { count: total }) }}
        </NText>
      </div>
      <NInput
        v-if="view === 'all'"
        v-model:value="searchQuery"
        clearable
        size="small"
        data-header
        :placeholder="t('common.promptGarden.searchPrompts')"
        :aria-label="t('common.promptGarden.searchPrompts')"
        :data-testid="`${rootTestId}-search`"
      >
        <template #prefix
          ><NIcon :size="16"><Search /></NIcon
        ></template>
      </NInput>
      <NScrollbar
        ref="scrollbarRef"
        trigger="none"
        :aria-busy="loading"
        :style="scrollStyle"
        class="prompt-garden-inspiration-popover__scroll"
        @scroll="handleScroll"
      >
        <div
          v-if="loading && !items.length"
          class="prompt-garden-inspiration-popover__status"
          role="status"
        >
          <NSpin size="small" /><NText depth="3">{{
            t('common.loading')
          }}</NText>
        </div>
        <AppPreviewImageGroup v-else-if="items.length">
          <div
            class="prompt-garden-inspiration-list"
            :class="{ 'prompt-garden-inspiration-list--images': isImageMode }"
          >
            <component
              :is="isImageMode ? NCard : 'article'"
              v-for="(item, index) in items"
              :key="item.importCode"
              v-bind="
                isImageMode
                  ? { size: 'small', contentStyle: { padding: '0' } }
                  : {}
              "
              class="prompt-garden-inspiration-item"
              :class="{
                'prompt-garden-inspiration-item--image': isImageMode,
                'prompt-garden-inspiration-item--expanded':
                  expandedCode === item.importCode,
              }"
              :data-testid="`${rootTestId}-suggestion-${index}`"
            >
              <div class="prompt-garden-inspiration-item__row">
                <div
                  v-if="isImageMode"
                  class="prompt-garden-inspiration-item__media"
                >
                  <AppPreviewImage
                    v-if="item.thumbnailUrl"
                    class="prompt-garden-inspiration-item__thumb"
                    :src="item.thumbnailUrl"
                    :preview-src="item.previewUrl || item.thumbnailUrl"
                    :alt="item.title"
                    width="100%"
                    height="100%"
                    object-fit="contain"
                    loading="lazy"
                  >
                    <template #placeholder
                      ><NSkeleton width="100%" height="100%"
                    /></template>
                    <template #error
                      ><NEmpty
                        size="small"
                        :description="t('common.promptGarden.imageLoadFailed')"
                    /></template>
                  </AppPreviewImage>
                  <NEmpty
                    v-else
                    size="small"
                    :description="t('common.promptGarden.noExampleImage')"
                  />
                </div>
                <button
                  type="button"
                  class="prompt-garden-inspiration-item__body"
                  :aria-expanded="expandedCode === item.importCode"
                  :aria-controls="`${rootTestId}-detail-${item.importCode}`"
                  :data-testid="`${rootTestId}-suggestion-${index}-preview`"
                  @click="handlePreview(item)"
                >
                  <span class="prompt-garden-inspiration-item__heading">
                    <NText
                      strong
                      class="prompt-garden-inspiration-item__title"
                      >{{ item.title }}</NText
                    >
                    <NIcon
                      :size="14"
                      class="prompt-garden-inspiration-item__chevron"
                      ><ChevronDown
                    /></NIcon>
                  </span>
                  <NText
                    depth="3"
                    class="prompt-garden-inspiration-item__summary"
                  >
                    {{
                      mode === 'arena'
                        ? item.excerpt || item.summary
                        : item.summary
                    }}
                  </NText>
                  <NText
                    v-if="item.categoryPath?.length"
                    depth="3"
                    class="prompt-garden-inspiration-item__category"
                  >
                    {{ item.categoryPath[item.categoryPath.length - 1] }}
                  </NText>
                </button>
                <NButton
                  size="small"
                  secondary
                  :disabled="disabled"
                  class="prompt-garden-inspiration-item__apply"
                  :data-testid="`${rootTestId}-suggestion-${index}-apply`"
                  @click="handleApply(item)"
                >
                  {{
                    hasPrompt
                      ? t('common.promptGarden.replaceImportShort')
                      : t('common.promptGarden.useShort')
                  }}
                </NButton>
              </div>
              <div
                v-if="expandedCode === item.importCode"
                :id="`${rootTestId}-detail-${item.importCode}`"
                class="prompt-garden-inspiration-item__detail"
              >
                <div v-if="previews[item.importCode]?.loading" role="status">
                  <NSpin size="small" />
                </div>
                <div
                  v-else-if="previews[item.importCode]?.error"
                  class="prompt-garden-inspiration-popover__status"
                  role="alert"
                >
                  <NText depth="3">{{
                    t('common.promptGarden.loadFailed')
                  }}</NText>
                  <NButton size="tiny" @click="handlePreview(item)">{{
                    t('common.retry')
                  }}</NButton>
                </div>
                <p v-else class="prompt-garden-inspiration-item__source">
                  {{ previews[item.importCode]?.text }}
                </p>
              </div>
            </component>
          </div>
        </AppPreviewImageGroup>
        <div
          v-else-if="!loadError"
          class="prompt-garden-inspiration-popover__status"
          role="status"
        >
          <NText depth="3">{{ t('common.promptGarden.noResults') }}</NText>
        </div>
        <div
          v-if="loadError"
          class="prompt-garden-inspiration-popover__status"
          role="alert"
        >
          <NText depth="3">{{ t('common.promptGarden.loadFailed') }}</NText>
          <NButton size="tiny" @click="retryLoading">{{
            t('common.retry')
          }}</NButton>
        </div>
        <div
          v-else-if="view === 'all' && loading && items.length"
          class="prompt-garden-inspiration-popover__more"
          role="status"
          aria-live="polite"
        >
          <NSpin size="small" />
          <NText depth="3">{{ t('common.loading') }}</NText>
        </div>
      </NScrollbar>
      <div class="prompt-garden-inspiration-popover__footer" data-action>
        <NButton
          size="tiny"
          text
          :data-testid="`${rootTestId}-browse`"
          @click="handleBrowseMore"
        >
          <template #icon
            ><NIcon :size="14"><ExternalLink /></NIcon
          ></template>
          {{ t('common.promptGarden.openGarden') }}
        </NButton>
        <NButton
          size="tiny"
          text
          :data-testid="`${rootTestId}-import`"
          @click="handleOpenImport"
        >
          <template #icon
            ><NIcon :size="14"><FileImport /></NIcon
          ></template>
          {{ t('common.promptGarden.importShort') }}
        </NButton>
      </div>
    </div>
  </NPopover>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch, type Ref } from 'vue'
import {
  NButton,
  NCard,
  NEmpty,
  NSkeleton,
  NIcon,
  NPopover,
  NSpin,
  NText,
  NInput,
  NRadioGroup,
  NRadioButton,
  NScrollbar,
  useThemeVars,
} from 'naive-ui'
import {
  ExternalLink,
  FileInput as FileImport,
  Sprout as Plant2,
  RefreshCw as Refresh,
  Search,
  ChevronDown,
} from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import { getEnvVar } from '@prompt-optimizer/core'
import { openExternalUrl } from '../../utils/open-external-url'
import type { PromptGardenImportRequest } from '../../utils/prompt-garden-import'
import {
  fetchPromptGardenSuggestions,
  fetchPromptGardenCatalog,
  fetchPromptGardenPreview,
  type PromptGardenSuggestionItem,
} from '../../utils/prompt-garden-suggestions'
import { useSelectMenuViewport } from '../../composables/ui/useSelectMenuViewport'
import AppPreviewImage from '../media/AppPreviewImage.vue'
import AppPreviewImageGroup from '../media/AppPreviewImageGroup.vue'

type PopoverInst = {
  syncPosition?: () => void
}

const props = withDefaults(
  defineProps<{
    mode: string
    label?: string
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
  t: (key: string, params?: Record<string, unknown>) => string
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
const isImageMode = computed(
  () => props.mode === 'image-text2image' || props.mode === 'image-image2image',
)
const view = ref<'recommended' | 'all'>(
  props.mode === 'arena' ? 'all' : 'recommended',
)
const searchQuery = ref('')
const catalog = ref<PromptGardenSuggestionItem[]>([])
const catalogLoaded = ref(false)
const catalogLoading = ref(false)
const catalogError = ref(false)
const suggestionsError = ref(false)
const total = ref(0)
const nextOffset = ref<number | null>(null)
const expandedCode = ref('')
const previews = ref<
  Record<string, { loading: boolean; text: string; error: boolean }>
>({})
const scrollbarRef = ref<{
  scrollTo: (options: { top: number }) => void
} | null>(null)
const triggerRef = ref<{ $el: HTMLElement } | null>(null)
const scrollPositions = { recommended: 0, all: 0 }
const theme = useThemeVars()
const viewport = useSelectMenuViewport({
  show: popoverVisible,
  isCompact: ref(true),
  maxHeight: 640,
  getTrigger: () => triggerRef.value?.$el ?? null,
  getMenu: () => popoverBodyRef.value,
  getPlacement: () => 'bottom-end',
})
const scrollStyle = computed(() => ({
  maxHeight: viewport.layout.value
    ? `${Math.max(40, viewport.layout.value.bodyMaxHeight - 56)}px`
    : 'min(540px, calc(100dvh - 220px))',
}))
const items = computed(() =>
  view.value === 'all' ? catalog.value : suggestions.value,
)
const loading = computed(() =>
  view.value === 'all' ? catalogLoading.value : isLoading.value,
)
const loadError = computed(() =>
  view.value === 'all' ? catalogError.value : suggestionsError.value,
)
let catalogSequence = 0
let previewScope = 0
let searchTimer: ReturnType<typeof setTimeout> | null = null

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
  if (searchTimer) clearTimeout(searchTimer)
  ++loadSequence
  ++catalogSequence
  ++previewScope
})

const isPromptGardenEnabled = computed(() => {
  const value = getEnvVar('VITE_ENABLE_PROMPT_GARDEN_IMPORT')
    .trim()
    .toLowerCase()
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

watch([() => props.mode, promptGardenLocale], () => {
  ++loadSequence
  ++catalogSequence
  ++previewScope
  if (searchTimer) clearTimeout(searchTimer)
  suggestions.value = []
  catalog.value = []
  browseUrl.value = ''
  shownExclude.value = []
  cacheExpiresAt.value = 0
  catalogLoaded.value = false
  catalogLoading.value = false
  catalogError.value = false
  suggestionsError.value = false
  isLoading.value = false
  total.value = 0
  nextOffset.value = null
  expandedCode.value = ''
  previews.value = {}
  scrollPositions.recommended = scrollPositions.all = 0
  // Search changes below are not allowed to issue a second request during reset.
  view.value = props.mode === 'arena' ? 'all' : 'recommended'
  searchQuery.value = ''
  if (searchTimer) clearTimeout(searchTimer)
  catalogLoading.value = false
  if (popoverVisible.value) void loadCurrentView()
})

const dedupe = (items: string[]): string[] =>
  Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)))

const rememberShown = (
  items: PromptGardenSuggestionItem[],
  nextExclude: string[],
) => {
  shownExclude.value = dedupe([
    ...shownExclude.value,
    ...nextExclude,
    ...items.map((item) => item.importCode),
  ])
}

const loadSuggestions = async (options: { force?: boolean } = {}) => {
  if (
    props.disabled ||
    !isPromptGardenEnabled.value ||
    !promptGardenBaseUrl.value
  )
    return

  if (isLoading.value && !options.force) return
  if (
    !options.force &&
    suggestions.value.length > 0 &&
    cacheExpiresAt.value > Date.now()
  ) {
    return
  }

  const sequence = ++loadSequence
  isLoading.value = true
  suggestionsError.value = false

  try {
    const result = await fetchPromptGardenSuggestions({
      gardenBaseUrl: promptGardenBaseUrl.value,
      mode: props.mode,
      limit: isImageMode.value ? 4 : 3,
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
    suggestionsError.value = true
    browseUrl.value = fallbackBrowseUrl.value
    cacheExpiresAt.value = Date.now() + 60 * 1000
  } finally {
    if (sequence === loadSequence) {
      isLoading.value = false
      syncPopoverPosition()
    }
  }
}

const restoreScroll = () =>
  scrollbarRef.value?.scrollTo({ top: scrollPositions[view.value] })
const handleScroll = (event: Event) => {
  const container = event.target as HTMLElement
  scrollPositions[view.value] = container.scrollTop
  if (
    popoverVisible.value &&
    view.value === 'all' &&
    catalogLoaded.value &&
    !catalogLoading.value &&
    !catalogError.value &&
    nextOffset.value !== null &&
    container.scrollHeight - container.clientHeight - container.scrollTop <= 120
  ) {
    void loadCatalog()
  }
}

const loadCatalog = async (reset = false) => {
  if (
    props.disabled ||
    !promptGardenBaseUrl.value ||
    !isPromptGardenEnabled.value
  ) {
    catalogLoading.value = false
    return
  }
  if (!reset && (catalogLoading.value || nextOffset.value === null)) return
  const sequence = ++catalogSequence
  const offset = reset ? 0 : (nextOffset.value ?? 0)
  catalogLoading.value = true
  catalogError.value = false
  if (reset) {
    catalog.value = []
    catalogLoaded.value = false
    scrollPositions.all = 0
  }
  try {
    const result = await fetchPromptGardenCatalog({
      gardenBaseUrl: promptGardenBaseUrl.value,
      mode: props.mode,
      locale: promptGardenLocale.value,
      query: searchQuery.value.trim(),
      offset,
      limit: 20,
    })
    if (sequence !== catalogSequence) return
    const seen = new Set(catalog.value.map((item) => item.importCode))
    catalog.value = reset
      ? result.items
      : [
          ...catalog.value,
          ...result.items.filter((item) => !seen.has(item.importCode)),
        ]
    total.value = result.total
    nextOffset.value = result.nextOffset
    browseUrl.value = result.browseUrl
    catalogLoaded.value = true
  } catch {
    if (sequence === catalogSequence) catalogError.value = true
  } finally {
    if (sequence === catalogSequence) {
      catalogLoading.value = false
      syncPopoverPosition()
    }
  }
}

const loadCurrentView = () =>
  view.value === 'recommended'
    ? loadSuggestions()
    : !catalogLoaded.value && !catalogLoading.value
      ? loadCatalog(true)
      : Promise.resolve()

const handleViewChange = (value: 'recommended' | 'all') => {
  if (value === view.value) return
  view.value = value
  expandedCode.value = ''
  void loadCurrentView()
  void nextTick(() => {
    restoreScroll()
    syncPopoverPosition()
  })
}

watch(
  searchQuery,
  () => {
    if (searchTimer) clearTimeout(searchTimer)
    ++catalogSequence
    catalogLoaded.value = false
    catalogLoading.value = false
    catalogError.value = false
    catalog.value = []
    nextOffset.value = null
    total.value = 0
    expandedCode.value = ''
    if (popoverVisible.value && view.value === 'all') {
      catalogLoading.value = true
      searchTimer = setTimeout(() => {
        void loadCatalog(true)
      }, 250)
    }
  },
  { flush: 'sync' },
)

const handlePreview = async (item: PromptGardenSuggestionItem) => {
  if (
    expandedCode.value === item.importCode &&
    !previews.value[item.importCode]?.error
  ) {
    expandedCode.value = ''
    return
  }
  expandedCode.value = item.importCode
  const cached = previews.value[item.importCode]
  if (cached && !cached.error) return
  const scope = previewScope
  previews.value[item.importCode] = { loading: true, text: '', error: false }
  try {
    const text = await fetchPromptGardenPreview(
      promptGardenBaseUrl.value,
      item.importCode,
    )
    if (scope === previewScope)
      previews.value[item.importCode] = { loading: false, text, error: false }
  } catch {
    if (scope === previewScope)
      previews.value[item.importCode] = {
        loading: false,
        text: '',
        error: true,
      }
  } finally {
    syncPopoverPosition()
  }
}

const retryLoading = () =>
  view.value === 'all'
    ? loadCatalog(!catalogLoaded.value)
    : loadSuggestions({ force: true })

const openPopover = (
  options: { pinned?: boolean; immediate?: boolean } = {},
) => {
  if (props.disabled) return

  clearCloseTimer()
  clearOpenTimer()

  const open = () => {
    popoverVisible.value = true
    if (options.pinned) {
      isPinnedByClick.value = true
    }
    void loadCurrentView()
    void nextTick(restoreScroll)
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
  void openExternalUrl(
    browseUrl.value || fallbackBrowseUrl.value || promptGardenBaseUrl.value,
    {
      logPrefix: 'PromptGarden',
    },
  )
  closePopover()
}

const handleOpenImport = () => {
  emit('open-import')
  closePopover()
}
</script>

<style scoped>
.prompt-garden-inspiration-trigger {
  white-space: nowrap;
}
.prompt-garden-inspiration-popover {
  box-sizing: border-box;
  width: min(680px, calc(100vw - 32px));
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
}
.prompt-garden-inspiration-popover__header,
.prompt-garden-inspiration-popover__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-shrink: 0;
}
.prompt-garden-inspiration-popover__count {
  font-size: 12px;
  white-space: nowrap;
}
.prompt-garden-inspiration-popover__scroll {
  min-height: 0;
}
.prompt-garden-inspiration-popover__status {
  min-height: 76px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.prompt-garden-inspiration-list {
  display: flex;
  flex-direction: column;
}
.prompt-garden-inspiration-item {
  padding: 10px 2px;
}
.prompt-garden-inspiration-item + .prompt-garden-inspiration-item {
  border-top: 1px solid var(--garden-border);
}
.prompt-garden-inspiration-item__row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}
.prompt-garden-inspiration-list--images {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.prompt-garden-inspiration-item--image {
  padding: 0;
  overflow: hidden;
}
.prompt-garden-inspiration-item--image
  + .prompt-garden-inspiration-item--image {
  border-top: 1px solid var(--garden-border);
}
.prompt-garden-inspiration-item--image :deep(.n-card__content) {
  display: flex;
  flex-direction: column;
}
.prompt-garden-inspiration-item--image .prompt-garden-inspiration-item__row {
  flex: 1;
  flex-direction: column;
  align-items: stretch;
  gap: 0;
}
.prompt-garden-inspiration-item__media {
  position: relative;
  height: 180px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--garden-surface);
  border-bottom: 1px solid var(--garden-border);
}
.prompt-garden-inspiration-item__thumb {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  cursor: zoom-in;
}
.prompt-garden-inspiration-item__thumb :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.prompt-garden-inspiration-item--image .prompt-garden-inspiration-item__body {
  box-sizing: border-box;
  width: 100%;
  padding: 12px;
  gap: 6px;
}
.prompt-garden-inspiration-item--image .prompt-garden-inspiration-item__apply {
  align-self: flex-end;
  margin: 0 12px 12px;
}
.prompt-garden-inspiration-item--image.prompt-garden-inspiration-item--expanded {
  grid-column: 1 / -1;
}
.prompt-garden-inspiration-item--image .prompt-garden-inspiration-item__detail {
  margin: 0 12px 12px;
}
.prompt-garden-inspiration-item__heading {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  width: 100%;
}
.prompt-garden-inspiration-item__chevron {
  flex-shrink: 0;
  margin-top: 3px;
}
.prompt-garden-inspiration-item--expanded
  .prompt-garden-inspiration-item__chevron {
  transform: rotate(180deg);
}
@media (max-width: 639px) {
  .prompt-garden-inspiration-list--images {
    grid-template-columns: minmax(0, 1fr);
  }
}
.prompt-garden-inspiration-item__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
  border: 0;
  border-radius: 2px;
  padding: 0;
  color: inherit;
  background: transparent;
  font: inherit;
  text-align: start;
  cursor: pointer;
}
.prompt-garden-inspiration-item__body:hover
  .prompt-garden-inspiration-item__title {
  text-decoration: underline;
  text-underline-offset: 3px;
}
.prompt-garden-inspiration-item__body:focus-visible {
  outline: 2px solid var(--garden-focus);
  outline-offset: 3px;
}
.prompt-garden-inspiration-item__title {
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  white-space: normal;
  line-height: 1.5;
  font-weight: 600;
  color: var(--garden-title);
}
.prompt-garden-inspiration-item__summary {
  width: 100%;
  display: -webkit-box;
  overflow: hidden;
  line-height: 1.5;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow-wrap: anywhere;
}
.prompt-garden-inspiration-item__category {
  font-size: 12px;
  line-height: 1.5;
}
.prompt-garden-inspiration-item__apply {
  flex-shrink: 0;
}
.prompt-garden-inspiration-item__detail {
  margin-top: 10px;
  padding: 10px;
  background: var(--garden-surface);
  border-radius: 4px;
}
.prompt-garden-inspiration-item__source {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.6;
}
.prompt-garden-inspiration-popover__more {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: center;
  padding-top: 8px;
}
.prompt-garden-inspiration-popover__footer {
  border-top: 1px solid var(--garden-border);
  padding-top: 10px;
}
</style>
