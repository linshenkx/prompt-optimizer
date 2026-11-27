<template>
  <NCard size="small" class="video-result-card" :data-testid="'video-result-' + group"
    header-style="padding: 12px 12px 4px;" content-style="padding: 8px 12px 12px; overflow: auto;">
    <template #header><slot name="header" /></template>
    <NEmpty v-if="!run" class="result-empty" :description="t('imageWorkspace.results.noGenerationResult')" />
    <template v-else>
      <div class="result-meta">
        <NText :data-testid="'video-status-' + group" role="status">{{ t('video.status.' + status) }}</NText>
        <span v-if="elapsed" class="task-elapsed" :data-testid="'video-elapsed-' + group"
          :title="t('video.taskElapsedHint')">{{ t('video.taskElapsed', { time: elapsed }) }}</span>
        <span>{{ specs }}<template v-if="modelName && modelName !== headerModelName"> · {{ modelName }}</template></span>
      </div>
      <video v-if="run.videoUrl && !expired" :key="videoRunKey(run)" controls playsinline preload="metadata"
        :aria-label="group.toUpperCase() + ' · ' + (origin || sourceLabel)" :src="run.videoUrl" />
      <p v-if="origin" class="result-origin" :data-testid="'video-origin-' + group">{{ origin }}</p>
      <p v-if="expired">{{ t('video.linkExpired') }}</p>
      <p v-if="status === 'unknown'">{{ t('video.unknownHint') }}</p>
      <p v-if="run.error">{{ run.error.startsWith('video.error.') ? t(run.error) : run.error }}</p>
      <p v-if="pollError" role="alert">{{ pollError }}</p>
      <div v-if="run.usage || status === 'succeeded'" :data-testid="'video-usage-' + group" class="usage">
        <span v-if="run.usage?.outputTokens != null">{{ t('video.outputTokens', { n: tokenCount(run.usage.outputTokens) }) }}</span>
        <span v-if="run.usage?.totalTokens != null">{{ t('video.totalTokens', { n: tokenCount(run.usage.totalTokens) }) }}</span>
        <span v-if="showCost" :title="t('video.costBasis.' + run.cost!.basis) + ' · ' + formatMoney(run.cost!.amount, run.cost!.currency, 6)">{{ t('video.displayCost', { price: formatMoney(run.cost!.amount, run.cost!.currency) }) }}</span>
        <span v-else>{{ t('video.billAtProvider') }}</span>
      </div>
    </template>
    <NFlex v-if="run" align="center" :size="[8, 4]" class="result-actions">
      <template v-if="run.videoUrl && !expired">
        <NButton size="tiny" :loading="downloading" @click="download">{{ t('video.download') }}</NButton>
        <a :href="run.videoUrl" rel="noopener noreferrer" target="_blank">{{ t('video.open') }}</a>
      </template>
      <NButton v-if="!extension && run.id && (['queued', 'running'].includes(status) || expired || missingUsage)"
        size="tiny" :loading="querying" @click="emit('refresh', run)">{{ t(missingUsage && !expired ? 'video.refreshUsage' : 'video.refresh') }}</NButton>
      <NButton v-if="!extension && status === 'queued' && supportsCancel" size="tiny" :disabled="querying" @click="emit('cancel', run)">{{ t('video.cancel') }}</NButton>
      <NButton v-if="!extension && status === 'unknown'" size="tiny" @click="emit('acknowledge', run)">{{ t('video.acknowledge') }}</NButton>
    </NFlex>
    <details v-if="run">
      <summary>{{ t('video.submission') }}</summary>
      <p><template v-if="modelName && modelName !== run.model">{{ modelName }} · </template>{{ run.model }} · {{ date(run.submittedAt) }}<template v-if="run.id"> · {{ run.id }}</template></p>
      <p v-if="run.images.length">{{ run.images.map(i => t('video.roles.' + i.role) + ' · ' + i.name).join(', ') }}</p>
      <p class="snapshot">{{ submittedPrompt }}</p>
      <p v-if="run.expiresAt && !expired">{{ t('video.expires', { time: date(run.expiresAt) }) }}</p>
    </details>
  </NCard>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { NButton, NCard, NEmpty, NFlex, NText, useThemeVars } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { getVideoModelSpec, videoRunKey,
  type VideoRun, type VideoVariantId } from '@prompt-optimizer/core'
import { useVideoSettings } from './useVideoSettings'
import { useToast } from '../../composables/ui/useToast'

const props = defineProps<{
  group: VideoVariantId; run?: VideoRun
  extension: boolean; querying: boolean; origin: string; headerModelName?: string
  sourceLabel: string; specs: string; status: string; now: number; pollError?: string
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
const elapsed = computed(() => {
  if (!props.run || !['submitting', 'queued', 'running'].includes(props.status)) return ''
  const seconds = Math.max(0, Math.floor((props.now - props.run.submittedAt) / 1000))
  const minutes = String(Math.floor(seconds / 60)).padStart(2, '0')
  return minutes + ':' + String(seconds % 60).padStart(2, '0')
})
const spec = computed(() => props.run && getVideoModelSpec(props.run.modelId, props.run.providerId))
const showCost = computed(() => !!props.run?.cost && (props.status === 'succeeded' || (!props.run.cost.estimated && !!props.run.usage)))
const missingUsage = computed(() => props.status === 'succeeded' && !!spec.value?.pricing.actual && (props.run?.usage?.outputTokens == null || props.run?.usage?.totalTokens == null))
const supportsCancel = computed(() => spec.value?.capabilities.supportsCancel)
const modelName = computed(() => props.run?.modelName || spec.value?.name || props.run?.model)
const downloading = ref(false)
const download = async () => {
  const item = props.run
  if (!item?.videoUrl || downloading.value) return
  downloading.value = true
  try {
    const response = await fetch(item.videoUrl)
    if (!response.ok) throw new Error(String(response.status))
    const url = URL.createObjectURL(await response.blob())
    const link = document.createElement('a')
    link.href = url
    link.download = (item.id ?? 'video') + '.mp4'
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch { toast.error(t('video.downloadFallback')) } finally { downloading.value = false }
}
</script>

<style scoped>
.video-result-card { min-width: 0; min-height: 0; height: 100%; }
.usage { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; }
.result-origin { color: v-bind('theme.textColor2'); }
.result-meta, .usage, .result-actions, details, p { margin-block: 8px; font-size: 12px; overflow-wrap: anywhere; }
.result-meta { display: flex; flex-wrap: wrap; gap: 2px 8px; color: v-bind('theme.textColor3'); }
.task-elapsed { font-variant-numeric: tabular-nums; white-space: nowrap; }
.result-empty { padding: 28px 0; }
video { display: block; width: 100%; max-height: 50vh; object-fit: contain; background: #000; border-radius: v-bind('theme.borderRadius'); }
.usage, details { color: v-bind('theme.textColor2'); }
.result-actions:empty { display: none; }
.result-actions a { color: v-bind('theme.primaryColor'); }
summary { cursor: pointer; }
.snapshot { white-space: pre-wrap; }
</style>
