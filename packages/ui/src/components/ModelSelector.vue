<template>
  <NPopover v-model:show="open" trigger="click" :placement="menuPlacement" :show-arrow="false"
    :disabled="disabled" :style="{ padding: '0' }">
    <template #trigger>
      <button v-bind="$attrs" ref="trigger" type="button" class="text-model-selector"
        :class="{ 'text-model-selector--small': size === 'small', 'is-open': open }"
        :style="colors" :disabled="disabled" :aria-expanded="open" aria-haspopup="dialog"
        :aria-label="ariaLabel || t('model.selector.choose')" :title="selectionTitle"
        @focus="emit('focus')" @keydown.down.prevent="showFromKeyboard" @keydown.esc="close">
        <span v-if="selectedLabel" class="text-model-selector__value">
          <span v-if="selectedConfig" class="text-model-selector__config">{{ selectedConfig }}</span>
          <span v-if="selectedConfig" class="text-model-selector__separator">·</span>
          <span class="text-model-selector__name">{{ selectedLabel }}</span>
        </span>
        <span v-else class="text-model-selector__placeholder">{{ placeholder || t('model.select.placeholder') }}</span>
        <ChevronDown class="text-model-selector__chevron" :size="14" :class="{ rotated: open }" />
      </button>
    </template>
    <section ref="menu" class="text-model-menu" :style="[colors, { '--selector-list-height': listHeight + 'px' }]" role="dialog" :aria-label="ariaLabel || t('model.selector.choose')"
      @keydown="navigate">
      <div class="text-model-menu__search" data-header>
        <NButton v-if="expanded" quaternary size="small" :aria-label="t('model.selector.back')" @click="expanded = ''; query = ''">
          <template #icon><ArrowLeft /></template>
        </NButton>
        <NInput ref="searchInput" v-model:value="query" clearable size="small" :placeholder="t('model.selector.search')"
          :input-props="{ 'aria-label': t('model.selector.search') }">
          <template #prefix><Search :size="15" /></template>
        </NInput>
      </div>
      <div class="text-model-menu__list">
        <span v-if="loading" class="text-model-menu__status" role="status">{{ t('model.selector.loading') }}</span>
        <section v-for="group in visibleGroups" :key="group.value" class="text-model-menu__group"
          :aria-label="group.label" :data-config-id="group.value">
          <div class="text-model-menu__heading">
            <span>{{ group.label }}</span>
            <button v-if="group.configurable" type="button" class="text-model-menu__configure"
              :aria-label="t('model.selector.manage') + ' ' + group.label"
              @click="configure(group.value)">{{ t('model.selector.configuration') }}</button>
          </div>
          <button v-for="model in group.visible" :key="model.value" type="button" data-model-choice
            class="text-model-menu__choice" :class="{ 'is-selected': modelValue === model.value }"
            :aria-pressed="modelValue === model.value"
            :title="model.label + ' · ' + group.label"
            :disabled="model.disabled" @click="choose(model.value)">
            <span>{{ model.label }}</span><Check v-if="modelValue === model.value" :size="15" />
          </button>
          <button v-if="group.hidden > 0" type="button" class="text-model-menu__more"
            @click="expanded = group.value">{{ t('model.selector.more', { count: group.hidden }) }}<ChevronRight :size="13" /></button>
          <span v-if="group.loading" role="status" class="text-model-menu__status">{{ t('model.selector.loading') }}</span>
          <button v-else-if="group.failed" type="button" class="text-model-menu__status"
            @click="emit('retry', group.value)">{{ t('model.selector.retry') }}</button>
        </section>
        <button v-if="customValue" type="button" data-model-choice class="text-model-menu__choice" @click="choose(customValue)">{{ t('model.selector.useCustom', { model: customValue }) }}</button>
        <div v-if="!visibleGroups.length && !customValue" role="status" class="text-model-menu__empty">{{ t('model.selector.empty') }}</div>
      </div>
      <footer v-if="scopeText || clearable || showConfigAction" class="text-model-menu__footer" data-action>
        <span>{{ scopeText }}</span>
        <button v-if="clearable && modelValue" type="button" @click="choose('')">{{ clearLabel || t('model.selector.clear') }}</button>
        <button v-if="showConfigAction" type="button" @click="configure()">{{ t('model.selector.manage') }}</button>
      </footer>
    </section>
  </NPopover>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, NInput, NPopover, useThemeVars } from 'naive-ui'
import { ArrowLeft, Check, ChevronDown, ChevronRight, Search } from '@lucide/vue'
import { useSelectMenuViewport } from '../composables/ui/useSelectMenuViewport'
import type { ModelSelectorGroup } from '../types/model-selector'

defineOptions({ inheritAttrs: false })
const props = withDefaults(defineProps<{
  modelValue?: string
  groups: ModelSelectorGroup[]
  selectedConfig?: string
  selectedLabel?: string
  disabled?: boolean
  size?: 'small' | 'medium' | 'large'
  placeholder?: string
  ariaLabel?: string
  scopeText?: string
  showConfigAction?: boolean
  clearable?: boolean
  clearLabel?: string
  allowCustom?: boolean
  loading?: boolean
}>(), { modelValue: '', disabled: false, size: 'medium' })
const emit = defineEmits<{
  'update:modelValue': [value: string]; 'update:show': [value: boolean]; focus: []
  config: [id?: string]; retry: [id: string]
}>()
const { t } = useI18n()
const theme = useThemeVars()
const open = ref(false)
const query = ref('')
const expanded = ref('')
const trigger = ref<HTMLButtonElement>()
const searchInput = ref<InstanceType<typeof NInput>>()
const menu = ref<HTMLElement>()
// The shared surface must also fit the visual viewport above an on-screen keyboard.
const viewport = useSelectMenuViewport({
  show: open, isCompact: ref(true), getTrigger: () => trigger.value || null,
  getMenu: () => menu.value || null, getPlacement: () => 'bottom-start',
})
const menuPlacement = computed(() => viewport.layout.value?.placement || 'bottom-start')
const listHeight = computed(() => viewport.layout.value?.bodyMaxHeight ?? 340)
const selectionTitle = computed(() => [props.selectedConfig, props.selectedLabel].filter(Boolean).join(' · '))
const colors = computed(() => ({
  '--selector-text': theme.value.textColor2, '--selector-muted': theme.value.textColor3,
  '--selector-border': theme.value.borderColor, '--selector-bg': theme.value.inputColor,
  '--selector-hover': theme.value.hoverColor, '--selector-focus': theme.value.primaryColor,
}))
const visibleGroups = computed(() => props.groups.flatMap(group => {
  if (expanded.value && group.value !== expanded.value) return []
  const search = query.value.trim().toLocaleLowerCase()
  const matches = search ? group.choices.filter(choice =>
    [group.label, group.searchText, choice.label, choice.value, choice.searchText].join(' ').toLocaleLowerCase().includes(search)
  ) : group.choices
  if (!matches.length && (search || (!group.loading && !group.failed))) return []
  const visible = expanded.value ? matches : matches.slice(0, 3)
  return [{ ...group, visible, hidden: matches.length - visible.length }]
}))
const customValue = computed(() => {
  const value = query.value.trim()
  return props.allowCustom && value && !props.groups.some(group => group.choices.some(choice => choice.value === value)) ? value : ''
})
async function onShow(show: boolean) {
  emit('update:show', show)
  if (!show) return
  query.value = ''
  expanded.value = ''
  emit('focus')
  await nextTick()
  if (open.value) {
    resetListScroll()
    searchInput.value?.focus()
  }
}
function resetListScroll() {
  const list = menu.value?.querySelector('.text-model-menu__list')
  if (list) list.scrollTop = 0
}
watch([query, expanded], resetListScroll, { flush: 'post' })
watch(open, onShow)
function showFromKeyboard() {
  if (!props.disabled) open.value = true
}
function close() { open.value = false; trigger.value?.focus() }
function choose(value: string) {
  if (props.disabled) return
  emit('update:modelValue', value)
  close()
}
async function configure(id?: string) {
  open.value = false
  await nextTick()
  emit('config', id)
}
function navigate(event: KeyboardEvent) {
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return }
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
  const buttons = Array.from((event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('button[data-model-choice]:not(:disabled)'))
  if (!buttons.length) return
  event.preventDefault()
  const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
  const next = event.key === 'ArrowDown' ? (current + 1) % buttons.length : (current <= 0 ? buttons.length - 1 : current - 1)
  buttons[next]?.focus()
}
watch(() => props.disabled, disabled => { if (disabled) open.value = false })
</script>
<style scoped>
.text-model-selector { display: flex; align-items: center; gap: 8px; width: 100%; min-width: 0; height: 34px; padding: 0 10px; border: 1px solid var(--selector-border); border-radius: 5px; color: var(--selector-text); background: var(--selector-bg); font: inherit; font-size: 14px; text-align: start; cursor: pointer; }
.text-model-selector--small { height: 28px; font-size: 13px; padding-inline: 8px; }
.text-model-selector { container-type: inline-size; }
@container (max-width: 190px) {
  .text-model-selector__config, .text-model-selector__separator { display: none; }
}
.text-model-selector:hover:not(:disabled) { border-color: var(--selector-muted); }
.text-model-selector:focus-visible, .text-model-selector.is-open { outline: 1px solid var(--selector-focus); outline-offset: 1px; }
.text-model-selector:disabled { opacity: .5; cursor: not-allowed; }
.text-model-selector__value { display: flex; align-items: baseline; gap: 6px; flex: 1; min-width: 0; white-space: nowrap; }
.text-model-selector__config { flex: 0 1 auto; max-width: 42%; color: var(--selector-muted); overflow: hidden; text-overflow: ellipsis; }
.text-model-selector__separator { color: var(--selector-muted); }
.text-model-selector__name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; font-weight: 500; }
.text-model-selector__placeholder { flex: 1; color: var(--selector-muted); }
.text-model-selector__chevron { flex: none; color: var(--selector-muted); }
.text-model-selector__chevron.rotated { transform: rotate(180deg); }
.text-model-menu { width: min(360px, calc(100vw - 32px)); color: var(--selector-text); font-size: 13px; }
.text-model-menu__search { display: flex; gap: 4px; padding: 10px; }
.text-model-menu__list { max-height: min(var(--selector-list-height, 340px), 50vh); overflow-y: auto; overscroll-behavior: contain; padding: 0 6px 6px; }
.text-model-menu__group + .text-model-menu__group { border-top: 1px solid var(--selector-border); margin-top: 6px; padding-top: 6px; }
.text-model-menu__heading { display: flex; justify-content: space-between; gap: 8px; padding: 5px 8px; color: var(--selector-muted); font-size: 12px; }
.text-model-menu__heading > :first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.text-model-menu__configure { flex: none; border: 0; padding: 0 2px; background: transparent; color: inherit; font: inherit; cursor: pointer; }
.text-model-menu__configure:hover { color: var(--selector-text); text-decoration: underline; text-underline-offset: 3px; }
.text-model-menu__choice { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 32px; padding: 6px 8px; width: 100%; border: 0; border-radius: 4px; background: transparent; color: inherit; font: inherit; text-align: start; cursor: pointer; }
.text-model-menu__choice > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.text-model-menu__choice > svg { flex: none; }
.text-model-menu__choice:disabled { opacity: .5; cursor: not-allowed; }
.text-model-menu__choice:hover:not(:disabled), .text-model-menu__choice.is-selected { background: var(--selector-hover); }
.text-model-menu__choice:focus-visible, .text-model-menu button:focus-visible { outline: 1px solid var(--selector-focus); outline-offset: -1px; }
.text-model-menu__more, .text-model-menu__status, .text-model-menu__footer button { display: inline-flex; align-items: center; gap: 3px; padding: 5px 8px; border: 0; background: transparent; color: var(--selector-muted); font: inherit; font-size: 12px; cursor: pointer; }
.text-model-menu__more:hover, .text-model-menu__footer button:hover { color: var(--selector-text); }
.text-model-menu__footer { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; border-top: 1px solid var(--selector-border); padding: 6px 10px; color: var(--selector-muted); font-size: 12px; }
.text-model-menu__empty { padding: 20px 10px; text-align: center; color: var(--selector-muted); }
</style>
