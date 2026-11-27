<template>
  <NCard size="small" class="video-result-card" :data-testid="'video-result-' + group"
    header-style="padding: 12px 12px 4px;" content-style="padding: 8px 12px 12px; overflow: auto;">
    <template #header><slot name="header" /></template>
    <NEmpty v-if="!run" class="result-empty" :description="t('imageWorkspace.results.noGenerationResult')" />
    <template v-else>
      <div class="result-meta">
        <NText v-if="!hasPlayableVideo" :data-testid="'video-status-' + group" role="status">{{ t('video.status.' + status) }}</NText>
        <span v-if="elapsed" class="task-elapsed" :data-testid="'video-elapsed-' + group"
          :title="t('video.taskElapsedHint')">{{ t('video.taskElapsed', { time: elapsed }) }}</span>
        <span>{{ specs }}<template v-if="modelName && modelName !== headerModelName"> · {{ modelName }}</template></span>
      </div>
      <video v-if="hasPlayableVideo" :key="videoRunKey(run)" controls playsinline preload="metadata"
        :aria-label="group.toUpperCase() + ' · ' + (origin || sourceLabel)" :src="run.videoUrl" />
      <p v-if="origin" class="result-origin" :data-testid="'video-origin-' + group">{{ origin }}</p>
      <p v-if="expired">{{ t('video.linkExpired') }}</p>
      <p v-if="status === 'unknown'">{{ t('video.unknownHint') }}</p>
      <p v-if="run.error">{{ run.error.startsWith('video.error.') ? t(run.error) : run.error }}</p>
      <p v-if="pollError" role="alert">{{ pollError }}</p>
      <div class="result-footer">
        <div v-if="run.usage || status === 'succeeded'" :data-testid="'video-usage-' + group" class="usage" :title="usageTooltip">
          <span v-if="showCost">{{ run.cost!.estimated ? t('video.estimatedCost', { price: formatMoney(run.cost!.amount, run.cost!.currency) }) : formatMoney(run.cost!.amount, run.cost!.currency) }}</span>
          <span v-else>{{ t('video.billAtProvider') }}</span>
        </div>
        <NFlex align="center" :size="[6, 4]" class="result-actions">
          <template v-if="hasPlayableVideo">
            <NButton size="tiny" secondary :loading="downloading" @click="download">
              <template #icon><Download :size="13" /></template>
              {{ t('video.download') }}
            </NButton>
            <NButton size="tiny" quaternary tag="a" :href="run.videoUrl" rel="noopener noreferrer" target="_blank"
              :title="t('video.open')" :aria-label="t('video.open')">
              <template #icon><ExternalLink :size="13" /></template>
            </NButton>
          </template>
          <NButton v-if="!extension && status !== 'untracked' && run.id && (['queued', 'running'].includes(status) || expired || missingUsage)"
            size="tiny" :loading="querying" @click="emit('refresh', run)">{{ t(missingUsage && !expired ? 'video.refreshUsage' : 'video.refresh') }}</NButton>
          <NButton v-if="!extension && status === 'queued' && supportsCancel" size="tiny" :disabled="querying" @click="emit('cancel', run)">{{ t('video.cancel') }}</NButton>
          <NButton v-if="canAcknowledge" size="tiny" @click="emit('acknowledge', run)">{{ t('video.acknowledge') }}</NButton>
        </NFlex>
      </div>
    </template>
    <details v-if="run">
      <summary>{{ t('video.submission') }}</summary>
      <p><template v-if="modelName && modelName !== run.model">{{ modelName }} · </template>{{ run.model }} · {{ date(run.submittedAt) }}<template v-if="run.id"> · {{ run.id }}</template></p>
      <p v-if="usageSummary">{{ usageSummary }}</p>
      <p v-if="run.images.length" class="ref-list" :title="run.images.map(i => t('video.roles.' + i.role) + ' · ' + i.name).join(', ')">
        {{ run.images.map(i => t('video.roles.' + i.role) + ' · ' + shortName(i.name)).join(', ') }}
      </p>
      <p class="snapshot">{{ submittedPrompt }}</p>
      <p v-if="run.expiresAt && !expired">{{ t('video.expires', { time: date(run.expiresAt) }) }}</p>
    </details>
  </NCard>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { NButton, NCard, NEmpty, NFlex, NText, useThemeVars } from 'naive-ui'
import { Download, ExternalLink } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import { getVideoModelSpec, videoRunKey,
  type VideoRun, type VideoVariantId } from '@prompt-optimizer/core'
import { useVideoSettings } from './useVideoSettings'
import { useToast } from '../../composables/ui/useToast'

const props = defineProps<{
  group: VideoVariantId; run?: VideoRun
  extension: boolean; querying: boolean; origin: string; headerModelName?: string
  sourceLabel: string; specs: string; status: string; now: number; pollError?: string; canAcknowledge?: boolean
}>()
const emit = defineEmits<{
  refresh: [run: VideoRun]; cancel: [run: VideoRun]; acknowledge: [run: VideoRun]
}>()
const { t, locale } = useI18n()
const { formatMoney } = useVideoSettings()
const toast = useToast()
const submittedPrompt = computed(() => {
  const run = props.run
  // Earlier tests added all role descriptions, even when the prompt already named the image.
  return run ? run.submittedPrompt ?? run.prompt : ''
})
const theme = useThemeVars()
const date = (time: number) => new Date(time).toLocaleString(locale.value)
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
const usageSummary = computed(() => {
  const usage = props.run?.usage
  if (!usage) return ''
  return [
    usage.outputTokens != null ? t('video.outputTokens', { n: tokenCount(usage.outputTokens) }) : '',
    usage.totalTokens != null ? t('video.totalTokens', { n: tokenCount(usage.totalTokens) }) : '',
  ].filter(Boolean).join(' · ')
})
const usageTooltip = computed(() => [
  usageSummary.value,
  showCost.value && props.run?.cost
    ? t('video.costBasis.' + props.run.cost.basis) + ' · ' + formatMoney(props.run.cost.amount, props.run.cost.currency, 6)
    : '',
].filter(Boolean).join(' · '))
const shortName = (name: string) => name.length > 24 ? name.slice(0, 14) + '…' + name.slice(-8) : name
const missingUsage = computed(() => props.status === 'succeeded' && !!spec.value?.pricing.actual && (props.run?.usage?.outputTokens == null || props.run?.usage?.totalTokens == null))
const supportsCancel = computed(() => spec.value?.capabilities.supportsCancel)
const modelName = computed(() => props.run?.modelName || spec.value?.name || props.run?.model)
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
.usage { font-size: 12px; color: v-bind('theme.textColor2'); font-variant-numeric: tabular-nums; }
.result-origin { color: v-bind('theme.textColor2'); }
.result-meta, .result-origin, details, p { margin-block: 6px; font-size: 12px; overflow-wrap: anywhere; }
.result-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; color: v-bind('theme.textColor3'); }
.task-elapsed { font-variant-numeric: tabular-nums; white-space: nowrap; }
.result-empty { padding: 28px 0; }
video { display: block; width: 100%; max-height: 50vh; object-fit: contain; background: #000; border-radius: v-bind('theme.borderRadius'); }
details { color: v-bind('theme.textColor2'); }
.result-actions:empty { display: none; }
.ref-list { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
summary { cursor: pointer; }
.snapshot { white-space: pre-wrap; }
</style>
