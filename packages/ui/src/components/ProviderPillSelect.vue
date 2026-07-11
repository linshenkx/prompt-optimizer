<template>
  <div
    class="provider-pill-select"
    role="radiogroup"
    :aria-label="ariaLabel"
    :aria-busy="loading ? 'true' : 'false'"
  >
    <template v-if="loading && normalizedOptions.length === 0">
      <span
        v-for="index in 4"
        :key="index"
        class="provider-pill-select__skeleton"
      />
    </template>
    <button
      v-for="option in leadingOptions"
      v-else
      :key="option.value"
      class="provider-pill-select__pill"
      :class="{ 'provider-pill-select__pill--selected': option.value === value }"
      type="button"
      role="radio"
      :aria-checked="option.value === value"
      :disabled="loading || option.disabled"
      :title="option.label"
      @click="selectOption(option)"
    >
      <span class="provider-pill-select__label">{{ option.label }}</span>
    </button>
    <button
      v-if="customOption"
      :key="customOption.value"
      class="provider-pill-select__pill"
      :class="{
        'provider-pill-select__pill--selected': customOption.value === value,
        'provider-pill-select__pill--custom': true
      }"
      type="button"
      role="radio"
      :aria-checked="customOption.value === value"
      :disabled="loading || customOption.disabled"
      :title="customOption.label"
      @click="selectOption(customOption)"
    >
      <span class="provider-pill-select__label">{{ customOption.label }}</span>
    </button>
    <button
      v-if="overflowOptions.length > 0"
      class="provider-pill-select__pill provider-pill-select__pill--more"
      :class="{ 'provider-pill-select__pill--selected': isOverflowSelected }"
      type="button"
      :disabled="loading"
      :title="moreLabel"
      :aria-expanded="isOverflowExpanded"
      @click="toggleOverflow"
    >
      <span class="provider-pill-select__label">{{ moreButtonText }}</span>
    </button>
    <button
      v-for="option in visibleOverflowOptions"
      :key="option.value"
      class="provider-pill-select__pill provider-pill-select__pill--overflow"
      :class="{ 'provider-pill-select__pill--selected': option.value === value }"
      type="button"
      role="radio"
      :aria-checked="option.value === value"
      :disabled="loading || option.disabled"
      :title="option.label"
      @click="selectOption(option)"
    >
      <span class="provider-pill-select__label">{{ option.label }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

interface ProviderOption {
  label?: unknown
  value?: unknown
  disabled?: boolean
}

interface NormalizedProviderOption {
  label: string
  value: string
  disabled: boolean
}

const props = defineProps<{
  value: string
  options: ProviderOption[]
  loading?: boolean
  ariaLabel?: string
  moreLabel?: string
  labelOverrides?: Record<string, string>
}>()

const emit = defineEmits<{
  'update:value': [value: string]
}>()

const isOverflowExpanded = ref(false)

const providerOrder = [
  'openai',
  'deepseek',
  'gemini',
  'google-gemini',
  'anthropic',
  'dashscope',
  'openrouter',
  'requesty',
  'zhipu',
  'zhipuai',
  'chrome-built-in',
  'ollama',
  'seedream',
  'volcengine',
  'volcano',
  'siliconflow',
  'minimax',
  'xiaomi-mimo-token-plan',
  'modelscope',
  'cloudflare',
  'openai-compatible'
]

const overflowProviderIds = new Set([
  'siliconflow',
  'minimax',
  'xiaomi-mimo-token-plan',
  'modelscope',
  'cloudflare'
])

const normalizeProviderId = (value: string) => value.trim().toLowerCase()

const getProviderOrderIndex = (value: string) => {
  const normalizedValue = normalizeProviderId(value)
  const index = providerOrder.findIndex(id => id === normalizedValue)
  return index === -1 ? providerOrder.length : index
}

const isCustomProvider = (value: string) => normalizeProviderId(value) === 'openai-compatible'

const shouldOverflowProvider = (value: string) => {
  const normalizedValue = normalizeProviderId(value)
  return !isCustomProvider(normalizedValue) && (
    overflowProviderIds.has(normalizedValue) ||
    getProviderOrderIndex(normalizedValue) === providerOrder.length
  )
}

const normalizedOptions = computed<NormalizedProviderOption[]>(() =>
  props.options
    .map((option) => {
      const value = String(option.value ?? '')
      const rawLabel = typeof option.label === 'string' || typeof option.label === 'number'
        ? String(option.label)
        : value
      const label = props.labelOverrides?.[normalizeProviderId(value)] ?? rawLabel

      return {
        label,
        value,
        disabled: !!option.disabled || !value
      }
    })
    .filter(option => option.value)
    .sort((a, b) => {
      const orderDelta = getProviderOrderIndex(a.value) - getProviderOrderIndex(b.value)
      if (orderDelta !== 0) return orderDelta
      return a.label.localeCompare(b.label)
    })
)

const primaryOptions = computed(() =>
  normalizedOptions.value.filter(option =>
    !shouldOverflowProvider(option.value)
  )
)

const customOption = computed(() =>
  primaryOptions.value.find(option => isCustomProvider(option.value)) || null
)

const leadingOptions = computed(() =>
  primaryOptions.value.filter(option => !isCustomProvider(option.value))
)

const overflowOptions = computed(() =>
  normalizedOptions.value.filter(option =>
    shouldOverflowProvider(option.value)
  )
)

const isOverflowSelected = computed(() =>
  overflowOptions.value.some(option => option.value === props.value)
)

const moreLabel = computed(() => props.moreLabel || '更多')

const moreButtonText = computed(() => {
  const selected = overflowOptions.value.find(option => option.value === props.value)
  return selected && !isOverflowExpanded.value ? selected.label : moreLabel.value
})

const visibleOverflowOptions = computed(() =>
  isOverflowExpanded.value ? overflowOptions.value : []
)

const selectOption = (option: NormalizedProviderOption) => {
  if (props.loading || option.disabled || option.value === props.value) return
  emit('update:value', option.value)
}

const toggleOverflow = () => {
  if (props.loading) return
  isOverflowExpanded.value = !isOverflowExpanded.value
}
</script>

<style scoped>
.provider-pill-select {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  width: 100%;
}

.provider-pill-select__pill {
  max-width: 100%;
  min-height: 32px;
  padding: 5px 13px;
  border: 1px solid var(--n-border-color);
  border-radius: 999px;
  background: var(--n-color);
  color: var(--n-text-color);
  cursor: pointer;
  font: inherit;
  line-height: 1.4;
  transition:
    color 0.2s ease,
    background-color 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.provider-pill-select__pill:hover:not(:disabled) {
  border-color: var(--n-border-hover-color);
  color: var(--n-text-color-hover);
}

.provider-pill-select__pill:focus-visible {
  outline: none;
  box-shadow: var(--n-box-shadow-focus);
}

.provider-pill-select__pill:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.provider-pill-select__pill--selected {
  border-color: var(--n-border-pressed-color);
  background: var(--n-color-pressed);
  color: var(--n-text-color-pressed);
}

.provider-pill-select__pill--more {
  border-style: dashed;
}

.provider-pill-select__pill--overflow {
  background: transparent;
}

.provider-pill-select__pill--custom .provider-pill-select__label {
  max-width: none;
}

.provider-pill-select__label {
  display: block;
  overflow: hidden;
  max-width: 180px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.provider-pill-select__skeleton {
  width: 92px;
  height: 32px;
  border-radius: 999px;
  background: var(--n-color-disabled);
}
</style>
