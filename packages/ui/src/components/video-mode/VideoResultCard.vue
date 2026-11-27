<template>
  <NCard size="small" class="video-result-card" :data-testid="'video-result-' + group"
    header-style="padding: 12px 12px 4px;" content-style="padding: 8px 12px 12px; overflow: auto;">
    <template #header><slot name="header" /></template>
    <NEmpty v-if="!run" class="result-empty" :description="t('imageWorkspace.results.noGenerationResult')" />
    <template v-else>
      <div class="result-meta">
        <NText v-if="!hasPlayableVideo" :data-testid="'video-status-' + group" role="status">{{ t('video.status.' + status) }}</NText>
        <ThemedTooltip v-if="elapsed" :label="t('video.taskElapsedHint')">
          <span class="task-elapsed" :data-testid="'video-elapsed-' + group">{{ t('video.taskElapsed', { time: elapsed }) }}</span>
        </ThemedTooltip>
        <span v-if="specsLabel">{{ specsLabel }}</span>
      </div>
      <video v-if="hasPlayableVideo" :key="videoRunKey(run)" controls playsinline preload="metadata"
        :aria-label="group.toUpperCase() + ' · ' + sourceLabel" :src="run.videoUrl" />
      <p v-if="expired">{{ t('video.linkExpired') }}</p>
      <p v-if="status === 'unknown'">{{ t('video.unknownHint') }}</p>
      <p v-if="run.error">{{ run.error.startsWith('video.error.') ? t(run.error) : run.error }}</p>
      <p v-if="pollError" role="alert">{{ pollError }}</p>
      <div class="result-footer">
        <template v-if="run.usage || status === 'succeeded'">
          <ThemedTooltip v-if="usageTooltip" v-model:show="showUsage" :label="usageTooltip"
            :trigger="canHover ? 'hover' : 'click'" placement="top-start">
            <button type="button" class="usage" :data-testid="'video-usage-' + group" :aria-label="costLabel + ' · ' + usageTooltip"
              @focus="canHover && (showUsage = true)" @blur="showUsage = false" @keydown.esc="showUsage = false">{{ costLabel }}</button>
          </ThemedTooltip>
          <span v-else class="usage" :data-testid="'video-usage-' + group">{{ costLabel }}</span>
        </template>
        <NFlex align="center" :size="[6, 4]" class="result-actions">
          <template v-if="hasPlayableVideo">
            <NButton size="tiny" secondary :loading="downloading" @click="download">
              <template #icon><Download :size="13" /></template>
              {{ t('video.download') }}
            </NButton>
            <ThemedTooltip :label="t('video.open')">
              <NButton size="tiny" quaternary tag="a" :href="run.videoUrl" rel="noopener noreferrer" target="_blank" :aria-label="t('video.open')">
                <template #icon><ExternalLink :size="13" /></template>
              </NButton>
            </ThemedTooltip>
          </template>
          <NButton v-if="!extension && status !== 'untracked' && run.id && (['queued', 'running'].includes(status) || expired || missingUsage)"
            size="tiny" :loading="querying" @click="emit('refresh', run)">{{ t(missingUsage && !expired ? 'video.refreshUsage' : 'video.refresh') }}</NButton>
          <NButton v-if="!extension && status === 'queued' && supportsCancel" size="tiny" :disabled="querying" @click="emit('cancel', run)">{{ t('video.cancel') }}</NButton>
          <NButton v-if="canAcknowledge" size="tiny" @click="emit('acknowledge', run)">{{ t('video.acknowledge') }}</NButton>
        </NFlex>
      </div>
    </template>
  </NCard>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import { NButton, NCard, NEmpty, NFlex, NText, useThemeVars } from 'naive-ui'
import { Download, ExternalLink } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import { getVideoModelSpec, videoRunKey,
  type VideoRun, type VideoVariantId } from '@prompt-optimizer/core'
import { useVideoSettings } from './useVideoSettings'
import { useToast } from '../../composables/ui/useToast'
import { videoModelLabel } from '../../utils/video-model-label'
import ThemedTooltip from '../common/ThemedTooltip.vue'

const props = defineProps<{
  group: VideoVariantId; run?: VideoRun
  extension: boolean; querying: boolean; headerModelName?: string
  sourceLabel: string; specs: string; status: string; now: number; pollError?: string; canAcknowledge?: boolean
}>()
const emit = defineEmits<{
  refresh: [run: VideoRun]; cancel: [run: VideoRun]; acknowledge: [run: VideoRun]
}>()
const { t, locale } = useI18n()
const { formatMoney } = useVideoSettings()
const toast = useToast()
const theme = useThemeVars()
const tokenCount = (value: number) => value.toLocaleString(locale.value)
const expired = computed(() => !!props.run?.expiresAt && props.run.expiresAt <= props.now)
const hasPlayableVideo = computed(() => !!props.run?.videoUrl && !expired.value)
const elapsed = computed(() => {
  if (!props.run || !['submitting', 'queued', 'running'].includes(props.status)) return ''
  const seconds = Math.max(0, Math.floor((props.now - props.run.submittedAt) / 1000))
  const minutes = String(Math.floor(seconds / 60)).padStart(2, '0')
  return minutes + ':' + String(seconds % 60).padStart(2, '0')
})
const spec = computed(() => props.run && getVideoModelSpec(props.run.modelId, props.run.providerId))
const showCost = computed(() => !!props.run?.cost && (props.status === 'succeeded' || (!props.run.cost.estimated && !!props.run.usage)))
const costLabel = computed(() => {
  const cost = props.run?.cost
  if (!showCost.value || !cost) return t('video.billAtProvider')
  const price = formatMoney(cost.amount, cost.currency)
  return cost.estimated ? t('video.estimatedCost', { price }) : price
})
const showUsage = ref(false)
const canHover = useMediaQuery('(hover: hover)')
const usageTooltip = computed(() => {
  const usage = props.run?.usage
  const cost = props.run?.cost
  return [
    usage?.outputTokens != null && t('video.outputTokens', { n: tokenCount(usage.outputTokens) }),
    usage?.totalTokens != null && t('video.totalTokens', { n: tokenCount(usage.totalTokens) }),
    showCost.value && cost && t('video.costBasis.' + cost.basis) + ' · ' + formatMoney(cost.amount, cost.currency, 6),
  ].filter(Boolean).join('\n')
})
const missingUsage = computed(() => props.status === 'succeeded' && !!spec.value?.pricing.actual && (props.run?.usage?.outputTokens == null || props.run?.usage?.totalTokens == null))
const supportsCancel = computed(() => spec.value?.capabilities.supportsCancel)
const modelName = computed(() => {
  const run = props.run
  if (!run) return undefined
  // Older runs stored the config name. The wire model and preset preserve the actual selection.
  const customModel = run.model !== run.modelId || run.modelName === run.model ? run.model : undefined
  return videoModelLabel({ modelId: run.modelId, providerId: run.providerId, customModel })
})
const specsLabel = computed(() => [props.specs, modelName.value !== props.headerModelName && modelName.value].filter(Boolean).join(' · '))
const downloading = ref(false)
const clickDownloadLink = (url: string, filename: string, external = false) => {
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  if (external) {
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
  }
  document.body.appendChild(link)
  link.click()
  link.remove()
}
const download = async () => {
  const run = props.run
  if (!run?.videoUrl || downloading.value) return
  const { videoUrl } = run
  const filename = (run.id ?? 'video') + '.mp4'
  downloading.value = true
  try {
    if (window.electronAPI?.video?.downloadResult) {
      await window.electronAPI.video.downloadResult(videoUrl)
      return
    }
    // Playback can cache a non-CORS response. Ask for a fresh response with Origin.
    const response = await fetch(videoUrl, { cache: 'no-store' })
    if (!response.ok) throw new Error(String(response.status))
    const url = URL.createObjectURL(await response.blob())
    clickDownloadLink(url, filename)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch {
    // Browsers can deny a new tab if the request outlasted the user's click.
    if (navigator.userActivation?.isActive === false) toast.warning(t('video.downloadFallbackBlocked'))
    else {
      clickDownloadLink(videoUrl, filename, true)
      toast.info(t('video.downloadFallback'))
    }
  } finally { downloading.value = false }
}
</script>

<style scoped>
.video-result-card { min-width: 0; min-height: 0; height: 100%; }
.result-footer { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px 10px; margin-block: 8px; }
.usage { font: inherit; font-size: 12px; color: v-bind('theme.textColor2'); font-variant-numeric: tabular-nums; }
button.usage { padding: 2px 0; background: none; border: 0; cursor: pointer; }
.usage:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
.result-meta, p { margin-block: 6px; font-size: 12px; overflow-wrap: anywhere; }
.result-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; color: v-bind('theme.textColor3'); }
.task-elapsed { font-variant-numeric: tabular-nums; white-space: nowrap; }
.result-empty { padding: 28px 0; }
video { display: block; width: 100%; max-height: 50vh; object-fit: contain; background: #000; border-radius: v-bind('theme.borderRadius'); }
.result-actions:empty { display: none; }
</style>
