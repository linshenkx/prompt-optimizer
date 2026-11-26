<template>
  <NCard size="small" class="video-result-card" :data-testid="'video-result-' + group"
    content-style="padding: 12px; overflow: auto;">
    <MobileTestResultHeader v-if="compact && !extension" :variant="{ id: group, sourceLabel, promptContent: run ? submittedPrompt : plannedPrompt,
      hasPromptSnapshot: !!run, running, disabled: runDisabled }" :busy="false" @run="emit('run')" />
    <div v-else class="result-heading">
      <NText strong>{{ group.toUpperCase() }}</NText>
      <NText depth="2">{{ sourceLabel }}</NText>
    </div>
    <NEmpty v-if="!run" class="result-empty" :description="t('imageWorkspace.results.noGenerationResult')" />
    <template v-else>
      <div class="result-meta">
        <NText :data-testid="'video-status-' + group" role="status">{{ t('video.status.' + status) }}</NText>
        <span>{{ specs }} · {{ modelName }}</span>
      </div>
      <video v-if="run.videoUrl && !expired" :key="videoRunKey(run)" controls playsinline preload="metadata"
        :aria-label="group.toUpperCase() + ' · ' + sourceLabel" :src="run.videoUrl" />
      <p v-if="expired">{{ t('video.linkExpired') }}</p>
      <p v-if="status === 'unknown'">{{ t('video.unknownHint') }}</p>
      <p v-if="run.error">{{ run.error.startsWith('video.error.') ? t(run.error) : run.error }}</p>
      <p v-if="pollError" role="alert">{{ pollError }}</p>
      <div v-if="run.tokens != null || run.totalTokens != null || terminal" :data-testid="'video-usage-' + group" class="usage">
        <span>{{ t('video.outputTokens', { n: tokenCount(run.tokens) }) }}</span>
        <span>{{ t('video.totalTokens', { n: tokenCount(run.totalTokens) }) }}</span>
        <span v-if="amount != null" :title="t('video.rateBasis', { rate, price: price(amount, 6) })">{{ t('video.referenceCost', { price: price(amount, amount > 0 && amount < 0.01 ? 6 : 2) }) }}</span>
        <span v-else>{{ t('video.billAtProvider') }}</span>
      </div>
    </template>
    <NFlex align="center" :size="[8, 4]" class="result-actions">
      <template v-if="run">
        <template v-if="run.videoUrl && !expired">
          <NButton size="tiny" :loading="downloading" @click="download">{{ t('video.download') }}</NButton>
          <a :href="run.videoUrl" rel="noopener noreferrer" target="_blank">{{ t('video.open') }}</a>
        </template>
        <NButton v-if="!extension && run.id && (['queued', 'running'].includes(status) || expired || missingUsage)"
          size="tiny" :loading="querying" @click="emit('refresh', run)">{{ t(missingUsage && !expired ? 'video.refreshUsage' : 'video.refresh') }}</NButton>
        <NButton v-if="!extension && status === 'queued'" size="tiny" :disabled="querying" @click="emit('cancel', run)">{{ t('video.cancel') }}</NButton>
        <NButton v-if="!extension && status === 'unknown'" size="tiny" @click="emit('acknowledge', run)">{{ t('video.acknowledge') }}</NButton>
      </template>
      <NDropdown v-if="options.length && (options.length > 1 || !run)" trigger="click" placement="bottom-start"
        :value="run && videoRunKey(run)" :options="options" @select="emit('select', $event)">
        <NButton size="tiny" :data-testid="'video-record-' + group" aria-haspopup="menu">{{ t('video.chooseResult') }}</NButton>
      </NDropdown>
    </NFlex>
    <details v-if="run">
      <summary>{{ t('video.submission') }}</summary>
      <p>{{ run.model }} · {{ date(run.submittedAt) }}<template v-if="run.id"> · {{ run.id }}</template></p>
      <p v-if="run.images.length">{{ run.images.map(i => t('video.roles.' + i.role) + ' · ' + i.name).join(', ') }}</p>
      <p v-if="!compact || extension" class="snapshot">{{ submittedPrompt }}</p>
      <p v-if="run.expiresAt && !expired">{{ t('video.expires', { time: date(run.expiresAt) }) }}</p>
    </details>
  </NCard>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { NButton, NCard, NDropdown, NEmpty, NFlex, NText, useThemeVars } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { ARK_VIDEO_BASE_URL, defaultVideoConfig, seedancePromptText, videoRunKey, videoTokenRate, videoUsageCost,
  type VideoRun, type VideoVariantId } from '@prompt-optimizer/core'
import MobileTestResultHeader from '../common/MobileTestResultHeader.vue'
import { useToast } from '../../composables/ui/useToast'

const props = defineProps<{
  group: VideoVariantId; run?: VideoRun; options: { key: string; label: string }[]
  compact: boolean; extension: boolean; running: boolean; runDisabled: boolean; querying: boolean
  sourceLabel: string; plannedPrompt: string; specs: string; status: string; now: number; pollError?: string
}>()
const emit = defineEmits<{
  run: []; select: [key: string]; refresh: [run: VideoRun]; cancel: [run: VideoRun]; acknowledge: [run: VideoRun]
}>()
const { t, locale } = useI18n()
const submittedPrompt = computed(() => {
  const run = props.run
  // Earlier tests added all role descriptions, even when the prompt already named the image.
  return run ? run.submittedPrompt ?? seedancePromptText(run.prompt, run.images, true) : ''
})
const theme = useThemeVars()
const toast = useToast()
const date = (time: number) => new Date(time).toLocaleString(locale.value)
const tokenCount = (value?: number) => value == null ? t('video.notReported') : value.toLocaleString(locale.value)
const price = (value: number, digits: number) => value.toLocaleString(locale.value, { minimumFractionDigits: 2, maximumFractionDigits: digits })
const expired = computed(() => !!props.run?.expiresAt && props.run.expiresAt <= props.now)
const terminal = computed(() => ['succeeded', 'failed', 'expired', 'cancelled'].includes(props.status))
const missingUsage = computed(() => terminal.value && (props.run?.tokens == null || props.run?.totalTokens == null))
const defaultModel = defaultVideoConfig()
const modelName = computed(() => {
  const run = props.run
  if (!run || run.modelName) return run?.modelName
  return run.model === defaultModel.model && (!run.baseURL || run.baseURL === defaultModel.baseURL) ? defaultModel.name : run.model
})
const rate = computed(() => {
  const run = props.run
  if (!run) return null
  if (run.cnyPerMillionTokens !== undefined) return run.cnyPerMillionTokens
  // Before configurable endpoints, every task used the official Ark endpoint.
  return videoTokenRate(run.model, run.baseURL ?? (run.configId ? undefined : ARK_VIDEO_BASE_URL))
})
const amount = computed(() => props.run?.tokens != null && rate.value != null ? videoUsageCost(props.run.tokens, rate.value) : null)
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
.result-heading, .usage { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; }
.result-meta, .usage, .result-actions, details, p { margin-block: 8px; font-size: 12px; overflow-wrap: anywhere; }
.result-meta { display: flex; flex-wrap: wrap; gap: 2px 8px; color: v-bind('theme.textColor3'); }
.result-empty { padding: 28px 0; }
video { display: block; width: 100%; max-height: 50vh; object-fit: contain; background: #000; border-radius: v-bind('theme.borderRadius'); }
.usage, details { color: v-bind('theme.textColor2'); }
.result-actions:empty { display: none; }
.result-actions a { color: v-bind('theme.primaryColor'); }
summary { cursor: pointer; }
.snapshot { white-space: pre-wrap; }
</style>
