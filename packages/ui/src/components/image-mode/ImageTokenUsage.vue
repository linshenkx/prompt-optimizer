<template>
    <div v-if="hasAnyData" class="image-token-usage">
        <!-- Input section -->
        <div v-if="hasInputData" class="usage-section">
            <NText depth="3" class="section-label">Input</NText>
            <div class="usage-tags">
                <NTag v-if="inputImageDimensions" size="small" :bordered="false" type="default">
                    Image{{ inputImageType ? ` (${inputImageType})` : '' }}:
                    {{ inputImageDimensions.width }}x{{ inputImageDimensions.height }}px,
                    Aspect: {{ formatAspectRatio(inputImageDimensions) }},
                    Pricing Tier: {{ sizeMultiplier(inputImageDimensions) }}
                </NTag>
                <NTag v-if="inputTokens != null" size="small" :bordered="false" type="info">
                    Prompt tokens: {{ inputTokens }}
                </NTag>
            </div>
        </div>

        <!-- Output section -->
        <div v-if="hasOutputData" class="usage-section">
            <NText depth="3" class="section-label">Output</NText>
            <div class="usage-tags">
                <NTag v-if="outputImageDimensions" size="small" :bordered="false" type="default">
                    Image{{ outputImageType ? ` (${outputImageType})` : '' }}:
                    {{ outputImageDimensions.width }}x{{ outputImageDimensions.height }}px,
                    Aspect: {{ formatAspectRatio(outputImageDimensions) }},
                    Pricing Tier: {{ sizeMultiplier(outputImageDimensions) }}
                </NTag>
                <NTag v-if="outputTokens != null" size="small" :bordered="false" type="info">
                    Image tokens: {{ outputTokens }}
                </NTag>
                <NTag v-if="thinkingTokens != null" size="small" :bordered="false" type="info">
                    Thinking tokens: {{ thinkingTokens }}
                </NTag>
                <NTag v-if="inferenceTime != null" size="small" :bordered="false" type="info">
                    Inference: {{ inferenceTime }}s
                </NTag>
            </div>
        </div>

        <!-- Total -->
        <div v-if="totalTokens != null" class="usage-section">
            <NText depth="3" class="section-label">Total</NText>
            <div class="usage-tags">
                <NTag size="small" :bordered="false" type="info">
                    All tokens: {{ totalTokens }}
                </NTag>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

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

interface NormalizedUsage {
    inputTokens: number | null
    outputTokens: number | null
    thinkingTokens: number | null
    totalTokens: number | null
    inferenceTime: number | null
}

const props = defineProps<{
    metadata?: {
        usage?: unknown
        [key: string]: unknown
    } | null
    image?: ImageRefLike | null
    inputImage?: ImageRefLike | null
    inputImageInfo?: InputImageInfo | null
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

const usage = computed(() => normalizeUsage(props.metadata?.usage))

const inputTokens = computed(() => usage.value.inputTokens)
const outputTokens = computed(() => usage.value.outputTokens)
const thinkingTokens = computed(() => usage.value.thinkingTokens)
const totalTokens = computed(() => usage.value.totalTokens)
const inferenceTime = computed(() => {
    const t = usage.value.inferenceTime
    return t != null ? Number(t).toFixed(1) : null
})

const hasInputData = computed(() => inputImageDimensions.value != null || inputTokens.value != null)
const hasOutputData = computed(() =>
    outputImageDimensions.value != null || outputTokens.value != null ||
    thinkingTokens.value != null || inferenceTime.value != null
)
const hasAnyData = computed(() => hasInputData.value || hasOutputData.value || totalTokens.value != null)
</script>

<style scoped>
.image-token-usage {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 4px 0;
    width: 100%;
    overflow: hidden;
}

.usage-section {
    display: flex;
    align-items: center;
    gap: 8px;
}

.section-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    min-width: 48px;
}

.usage-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    flex: 1;
    min-width: 0;
}
</style>
