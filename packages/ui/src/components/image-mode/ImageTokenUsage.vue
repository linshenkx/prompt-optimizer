<template>
  <div v-if="hasAnyData" class="image-token-usage" :class="{ 'image-token-usage--compact': compact }"
    :style="{ '--usage-muted': themeVars.textColor3, '--usage-text': themeVars.textColor2 }">
    <div v-if="inputTokens != null || outputTokens != null || totalTokens != null" class="usage-overview" :aria-label="t('imageWorkspace.usage.tokens')">
      <span aria-hidden="true">Token</span>
      <span v-if="inputTokens != null">{{ t('imageWorkspace.usage.promptTokens') }}: {{ inputTokens }}</span>
      <span v-if="outputTokens != null">{{ t('imageWorkspace.usage.imageTokens') }}: {{ outputTokens }}</span>
      <span v-if="totalTokens != null">{{ t('imageWorkspace.usage.totalTokens') }}: {{ totalTokens }}</span>
    </div>
    <details v-if="hasDetails" class="usage-details">
      <summary>{{ t('workspace.generationDetails') }}</summary>
      <div v-if="normalizedInputImagesInfo.length > 0 || inputImageDimensions" class="usage-section">
        <span class="section-label">{{ t('imageWorkspace.usage.input') }}</span>
        <div class="usage-values">
          <template v-if="normalizedInputImagesInfo.length > 0">
            <span v-for="(item, index) in normalizedInputImagesInfo" :key="index">
              {{ t('imageWorkspace.usage.image') }} {{ index + 1 }}{{ item.imageType ? ' (' + item.imageType + ')' : '' }}: {{ item.width }}x{{ item.height }}px,
              {{ t('imageWorkspace.usage.aspect') }}: {{ formatAspectRatio(item) }}, {{ t('imageWorkspace.usage.tier') }}: {{ sizeMultiplier(item) }}
            </span>
          </template>
          <span v-else-if="inputImageDimensions">
            {{ t('imageWorkspace.usage.image') }}{{ inputImageType ? ' (' + inputImageType + ')' : '' }}: {{ inputImageDimensions.width }}x{{ inputImageDimensions.height }}px,
            {{ t('imageWorkspace.usage.aspect') }}: {{ formatAspectRatio(inputImageDimensions) }}, {{ t('imageWorkspace.usage.tier') }}: {{ sizeMultiplier(inputImageDimensions) }}
          </span>
        </div>
      </div>
      <div v-if="outputImageDimensions || thinkingTokens != null || inferenceTime != null" class="usage-section">
        <span class="section-label">{{ t('imageWorkspace.usage.output') }}</span>
        <div class="usage-values">
          <span v-if="outputImageDimensions">
            {{ t('imageWorkspace.usage.image') }}{{ outputImageType ? ' (' + outputImageType + ')' : '' }}: {{ outputImageDimensions.width }}x{{ outputImageDimensions.height }}px,
            {{ t('imageWorkspace.usage.aspect') }}: {{ formatAspectRatio(outputImageDimensions) }}, {{ t('imageWorkspace.usage.tier') }}: {{ sizeMultiplier(outputImageDimensions) }}
          </span>
          <span v-if="thinkingTokens != null">{{ t('imageWorkspace.usage.thinkingTokens') }}: {{ thinkingTokens }}</span>
          <span v-if="inferenceTime != null">{{ t('imageWorkspace.usage.inference') }}: {{ inferenceTime }}s</span>
        </div>
      </div>
    </details>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useThemeVars } from 'naive-ui'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const themeVars = useThemeVars()

interface ImageRefLike {
    b64?: string
    url?: string
    mimeType?: string
}

interface InputImageInfo {
    width?: number
    height?: number
    mimeType?: string
}

interface NormalizedInputImageInfo extends Dimensions {
    mimeType?: string
    imageType: string
}

interface NormalizedUsage {
    inputTokens: number | null
    outputTokens: number | null
    thinkingTokens: number | null
    totalTokens: number | null
    inferenceTime: number | null
}

const props = defineProps<{
    compact?: boolean
    metadata?: {
        usage?: unknown
        [key: string]: unknown
    } | null
    image?: ImageRefLike | null
    inputImage?: ImageRefLike | null
    inputImageInfo?: InputImageInfo | null
    inputImagesInfo?: InputImageInfo[] | null
}>()

interface Dimensions {
    width: number
    height: number
}

function gcd(a: number, b: number): number {
    return b === 0 ? a : gcd(b, a % b)
}

function formatAspectRatio(dim: Dimensions): string {
    const d = gcd(dim.width, dim.height)
    return `${dim.width / d}:${dim.height / d}`
}

function sizeMultiplier(dim: Dimensions): string {
    const maxDim = Math.max(dim.width, dim.height)
    const multiple = maxDim / 1024
    return `${multiple.toFixed(1)}K`
}

function formatImageType(mimeType?: string): string {
    if (!mimeType) return ''
    const type = mimeType.replace('image/', '').toUpperCase()
    // Normalize common variants
    if (type === 'JPEG' || type === 'JPG') return 'JPEG'
    if (type === 'SVG+XML') return 'SVG'
    return type
}

function toRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' ? value as Record<string, unknown> : null
}

function toFiniteNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value)
        return Number.isFinite(parsed) ? parsed : null
    }
    return null
}

function toDimensions(value: InputImageInfo | null | undefined): Dimensions | null {
    const width = toFiniteNumber(value?.width)
    const height = toFiniteNumber(value?.height)
    if (width == null || height == null || width <= 0 || height <= 0) {
        return null
    }
    return { width, height }
}

function toNormalizedInputImageInfo(value: InputImageInfo | null | undefined): NormalizedInputImageInfo | null {
    const dimensions = toDimensions(value)
    if (!dimensions) return null

    return {
        ...dimensions,
        mimeType: value?.mimeType,
        imageType: formatImageType(value?.mimeType),
    }
}

function toInputImageInfoList(value: unknown): InputImageInfo[] {
    if (!Array.isArray(value)) return []
    return value.filter((item): item is InputImageInfo => !!item && typeof item === 'object')
}

function pickNumber(record: Record<string, unknown> | null, keys: string[]): number | null {
    if (!record) return null
    for (const key of keys) {
        const value = toFiniteNumber(record[key])
        if (value != null) return value
    }
    return null
}

function normalizeUsage(usage: unknown): NormalizedUsage {
    const record = toRecord(usage)
    return {
        inputTokens: pickNumber(record, [
            'promptTokenCount',
            'promptTokens',
            'inputTokenCount',
            'inputTokens',
            'prompt_tokens',
            'input_tokens',
        ]),
        outputTokens: pickNumber(record, [
            'responseTokenCount',
            'responseTokens',
            'outputTokenCount',
            'outputTokens',
            'candidatesTokenCount',
            'candidatesTokens',
            'completion_tokens',
            'output_tokens',
        ]),
        thinkingTokens: pickNumber(record, [
            'thoughtsTokenCount',
            'thoughtTokens',
            'thinkingTokenCount',
            'thinkingTokens',
        ]),
        totalTokens: pickNumber(record, [
            'totalTokenCount',
            'totalTokens',
            'total_tokens',
        ]),
        inferenceTime: pickNumber(record, [
            'inference_time',
            'inferenceTime',
        ]),
    }
}

const outputImageType = computed(() => formatImageType(props.image?.mimeType))
const inputImageType = computed(() =>
    formatImageType(props.inputImageInfo?.mimeType || props.inputImage?.mimeType),
)

function resolveImageDimensions(
    imageRef: () => ImageRefLike | null | undefined,
    target: typeof outputImageDimensions
) {
    return watch(imageRef, (img) => {
        target.value = null
        if (!img) return
        const src = img.url || (img.b64 ? `data:${img.mimeType || 'image/png'};base64,${img.b64}` : null)
        if (!src) return
        const el = new Image()
        el.onload = () => { target.value = { width: el.naturalWidth, height: el.naturalHeight } }
        el.src = src
    }, { immediate: true })
}

const outputImageDimensions = ref<Dimensions | null>(null)
const loadedInputImageDimensions = ref<Dimensions | null>(null)

resolveImageDimensions(() => props.image, outputImageDimensions)
resolveImageDimensions(() => props.inputImage, loadedInputImageDimensions)

const inputImageDimensions = computed(() =>
    toDimensions(props.inputImageInfo) ?? loadedInputImageDimensions.value,
)
const normalizedInputImagesInfo = computed<NormalizedInputImageInfo[]>(() => {
    const source = props.inputImagesInfo && props.inputImagesInfo.length > 0
        ? props.inputImagesInfo
        : toInputImageInfoList(props.metadata?.inputImagesInfo)

    return source
        .map((item) => toNormalizedInputImageInfo(item))
        .filter((item): item is NormalizedInputImageInfo => item != null)
})

const usage = computed(() => normalizeUsage(props.metadata?.usage))

const inputTokens = computed(() => usage.value.inputTokens)
const outputTokens = computed(() => usage.value.outputTokens)
const thinkingTokens = computed(() => usage.value.thinkingTokens)
const totalTokens = computed(() => usage.value.totalTokens)
const inferenceTime = computed(() => {
    const t = usage.value.inferenceTime
    return t != null ? Number(t).toFixed(1) : null
})

const hasInputData = computed(() =>
    normalizedInputImagesInfo.value.length > 0 ||
    inputImageDimensions.value != null ||
    inputTokens.value != null,
)
const hasOutputData = computed(() =>
    outputImageDimensions.value != null || outputTokens.value != null ||
    thinkingTokens.value != null || inferenceTime.value != null
)
const hasDetails = computed(() => normalizedInputImagesInfo.value.length > 0 || inputImageDimensions.value != null || outputImageDimensions.value != null || thinkingTokens.value != null || inferenceTime.value != null)

const hasAnyData = computed(() => hasInputData.value || hasOutputData.value || totalTokens.value != null)
</script>

<style scoped>
.image-token-usage { width: 100%; min-width: 0; padding: 4px 0; color: var(--usage-muted); font-size: 12px; line-height: 1.6; }
.usage-overview { display: flex; flex-wrap: wrap; column-gap: 12px; row-gap: 2px; font-variant-numeric: tabular-nums; }
.usage-overview > span { white-space: nowrap; }
.usage-details { margin-top: 4px; }
.usage-details summary { cursor: pointer; width: fit-content; color: var(--usage-text); padding: 2px 0; }
.usage-details summary:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; border-radius: 3px; }
.usage-section { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 8px; margin-top: 6px; }
.section-label { color: var(--usage-text); }
.usage-values { display: flex; flex-direction: column; gap: 4px; overflow-wrap: anywhere; }
.image-token-usage--compact { padding: 0 8px; box-sizing: border-box; }
.image-token-usage--compact summary { min-height: 36px; align-content: center; }
</style>
