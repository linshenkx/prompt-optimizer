<template>
  <NTooltip
    trigger="hover"
    :overlay-style="tooltipOverlayStyle"
    :content-style="tooltipContentStyle"
    :theme-overrides="tooltipThemeOverrides"
  >
    <template #trigger>
      <NButton
        quaternary
        circle
        size="small"
        class="compare-help-button"
        :title="tooltipText"
        @click="showHelp = true"
      >
        <template #icon>
          <NIcon :size="16">
            <UiCircleHelp />
          </NIcon>
        </template>
      </NButton>
    </template>
    <span>{{ tooltipText }}</span>
  </NTooltip>

  <NModal
    :show="showHelp"
    preset="card"
    :style="{ width: 'min(92vw, 880px)' }"
    :title="t('evaluation.compareHelp.title')"
    size="large"
    :bordered="false"
    :segmented="true"
    @update:show="handleUpdateShow"
  >
    <div class="compare-help-button__content">
      <MarkdownRenderer :content="helpMarkdown" />
    </div>

    <template #action>
      <NButton type="primary" @click="showHelp = false">
        {{ t('common.close') }}
      </NButton>
    </template>
  </NModal>
</template>

<script setup lang="ts">
import { CircleHelp as UiCircleHelp } from '@lucide/vue'
import { computed, ref, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, NIcon, NModal, NTooltip } from 'naive-ui'
import MarkdownRenderer from '../MarkdownRenderer.vue'
import { compareHelpContent } from '../../docs/compare-help'
import { useTooltipTheme } from '../../composables/ui/useTooltipTheme'

const { locale, t } = useI18n() as unknown as {
  locale: Ref<string>
  t: (key: string) => string
}

const showHelp = ref(false)
const {
  tooltipThemeOverrides,
  tooltipOverlayStyle,
  tooltipContentStyle,
} = useTooltipTheme({
  maxWidth: '260px',
  whiteSpace: 'normal',
  overflowWrap: 'break-word',
})

const normalizedLocale = computed<keyof typeof compareHelpContent>(() => {
  const raw = String(locale.value || 'zh-CN')
  if (raw in compareHelpContent) {
    return raw as keyof typeof compareHelpContent
  }
  if (raw.startsWith('zh-TW') || raw.startsWith('zh-HK')) {
    return 'zh-TW'
  }
  if (raw.startsWith('zh')) {
    return 'zh-CN'
  }
  return 'en-US'
})

const helpMarkdown = computed(() => compareHelpContent[normalizedLocale.value])
const tooltipText = computed(() => t('evaluation.compareHelp.tooltip'))

const handleUpdateShow = (value: boolean) => {
  showHelp.value = value
}
</script>

<style scoped>
.compare-help-button {
  opacity: 0.86;
}

.compare-help-button__content {
  max-height: min(70vh, 760px);
  overflow: auto;
  padding-right: 4px;
}
</style>
