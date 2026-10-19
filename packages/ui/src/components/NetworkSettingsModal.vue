<template>
  <NModal
    :show="show"
    preset="card"
    :title="t('networkSettings.title')"
    :style="{ width: 'min(560px, 92vw)', maxHeight: '90vh' }"
    content-style="overflow: auto"
    :mask-closable="!saving && !restarting"
    :closable="!saving && !restarting"
    :close-on-esc="!saving && !restarting"
    @update:show="close"
  >
    <NSpace vertical :size="16" data-testid="network-settings-dialog">
      <NText depth="3">{{ t('networkSettings.description') }}</NText>
      <NText v-if="state" depth="3" data-testid="network-active-mode">
        {{ t('networkSettings.activeMode', { mode: t(`networkSettings.${state.active.mode}`) }) }}
      </NText>
      <NAlert v-if="error" type="error" :bordered="false" role="alert">{{ error }}</NAlert>
      <NAlert v-if="state?.restartRequired" type="info" :bordered="false">
        {{ t('networkSettings.pendingRestart') }}
      </NAlert>
      <NSpin :show="loading">
        <NForm :disabled="loading || saving || restarting" label-placement="top">
          <NFormItem :label="t('networkSettings.mode')">
            <NRadioGroup v-model:value="draft.mode" name="model-network-mode" data-testid="network-mode">
              <NSpace vertical>
                <NRadio value="system">{{ t('networkSettings.system') }}</NRadio>
                <NRadio value="direct">{{ t('networkSettings.direct') }}</NRadio>
                <NRadio value="manual">{{ t('networkSettings.manual') }}</NRadio>
              </NSpace>
            </NRadioGroup>
          </NFormItem>
          <NFormItem v-if="draft.mode === 'manual'" :label="t('networkSettings.proxyUrl')">
            <NInput v-model:value="draft.proxyUrl" placeholder="http://127.0.0.1:7890" data-testid="network-proxy-url" />
            <template #feedback>{{ t('networkSettings.proxyHint') }}</template>
          </NFormItem>
          <NCollapse v-if="draft.mode !== 'direct'">
            <NCollapseItem :title="t('networkSettings.advanced')" name="bypass">
              <NFormItem :label="t('networkSettings.bypassRules')">
                <NInput
                  v-model:value="bypassText"
                  type="textarea"
                  :autosize="{ minRows: 3, maxRows: 6 }"
                  :placeholder="t('networkSettings.bypassPlaceholder')"
                  data-testid="network-bypass-rules"
                />
                <template #feedback>{{ t('networkSettings.bypassHint') }}</template>
              </NFormItem>
            </NCollapseItem>
          </NCollapse>
        </NForm>
      </NSpin>
      <NText depth="3">{{ t('networkSettings.localOnly') }}</NText>
    </NSpace>
    <template #action>
      <NSpace justify="end">
        <NButton :disabled="saving || restarting" @click="close">
          {{ t(state?.restartRequired ? 'networkSettings.restartLater' : 'common.cancel') }}
        </NButton>
        <NButton
          v-if="state?.restartRequired && !dirty"
          type="primary"
          :loading="restarting"
          @click="restart"
          data-testid="network-restart"
        >{{ t('networkSettings.restartNow') }}</NButton>
        <NButton
          v-else
          type="primary"
          :loading="saving"
          :disabled="!dirty || loading || !state"
          @click="save"
          data-testid="network-save"
        >{{ t('common.save') }}</NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { NAlert, NButton, NCollapse, NCollapseItem, NForm, NFormItem, NInput, NModal,
  NRadio, NRadioGroup, NSpace, NSpin, NText } from 'naive-ui'
import type { ModelNetworkSettings, ModelNetworkState } from '../types/model-network'
import { useConfirmDialog } from '../composables/ui/useConfirmDialog'

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ 'update:show': [show: boolean] }>()
const { t } = useI18n()
const confirmDialog = useConfirmDialog()
const draft = reactive<ModelNetworkSettings>({ mode: 'system', proxyUrl: '', bypassRules: [] })
const bypassText = ref('')
const state = ref<ModelNetworkState | null>(null)
const loading = ref(false)
const saving = ref(false)
const restarting = ref(false)
const error = ref('')

const settings = computed<ModelNetworkSettings>(() => ({
  mode: draft.mode,
  proxyUrl: draft.proxyUrl.trim(),
  bypassRules: bypassText.value.split('\n').map(line => line.trim()).filter(Boolean),
}))
const dirty = computed(() => state.value !== null && JSON.stringify(settings.value) !== JSON.stringify(state.value.saved))
const showError = (failure: unknown, fallback: string) => {
  const payload = failure && typeof failure === 'object' ? failure as { code?: unknown; message?: unknown } : null
  const code = typeof payload?.code === 'string' ? payload.code
    : typeof payload?.message === 'string' ? payload.message : ''
  error.value = t(code.startsWith('networkSettings.errors.') ? code : fallback)
}
const updateState = (next: ModelNetworkState) => {
  state.value = next
  Object.assign(draft, next.saved)
  bypassText.value = next.saved.bypassRules.join('\n')
}
const close = () => {
  if (!saving.value && !restarting.value) emit('update:show', false)
}

let loadId = 0
watch(() => props.show, async show => {
  const id = ++loadId
  if (!show) return
  const api = window.electronAPI?.network
  if (!api) { close(); return }
  loading.value = true
  state.value = null
  error.value = ''
  try {
    const next = await api.getSettings()
    if (id === loadId) updateState(next)
  } catch (failure) {
    if (id === loadId) showError(failure, 'networkSettings.errors.loadFailed')
  } finally {
    if (id === loadId) loading.value = false
  }
}, { immediate: true })

const save = async () => {
  if (!window.electronAPI?.network || !dirty.value) return
  saving.value = true
  error.value = ''
  try {
    updateState(await window.electronAPI.network.saveSettings(settings.value))
  } catch (failure) {
    showError(failure, 'networkSettings.errors.saveFailed')
  } finally {
    saving.value = false
  }
}

const restart = async () => {
  const api = window.electronAPI?.network
  if (!api || restarting.value) return
  error.value = ''
  try {
    const latest = await api.getSettings()
    if (latest.busy) { error.value = t('networkSettings.errors.busy'); return }
    if (!await confirmDialog.warning({
      title: t('networkSettings.restartNow'),
      content: t('networkSettings.restartConfirm'),
      positiveText: t('networkSettings.restartNow'),
      negativeText: t('networkSettings.restartLater'),
    })) return
    restarting.value = true
    await api.restart()
  } catch (failure) {
    showError(failure, 'networkSettings.errors.restartFailed')
    restarting.value = false
  }
}
</script>
