<template>
  <div data-testid="video-model-manager">
    <NEmpty v-if="loaded && !models.length" :description="t('video.noModels')">
      <template #extra><NButton type="primary" @click="openAdd">{{ t('video.addModel') }}</NButton></template>
    </NEmpty>
    <ModelConfigList v-else kind="video" :models="rows" :test-hint="t('video.connectionHint')" :is-testing-connection-for="id => testing.has(id)"
      @test="testConnection" @edit="openEdit" @clone="cloneConfig" @delete="remove"
      @enable="setEnabled($event, true)" @disable="setEnabled($event, false)" />
  </div>

  <AdaptiveModal v-if="draft" :show="true" preset="card" size="large" :bordered="false" :segmented="true"
    :title="original ? t('video.editModel') : t('video.addModel')" :style="{ width: '80vw', maxWidth: '720px' }"
    @update:show="show => { if (!show && !saving) draft = null }">
    <NForm id="video-config-form" data-testid="video-model-editor" :label-placement="isCompact ? 'top' : 'left'"
      :label-width="isCompact ? undefined : 'auto'" :show-feedback="!isCompact" size="small" @submit.prevent="save">
      <NFormItem :label="t('modelManager.displayName')" required>
        <NInput v-model:value="draft.name" :placeholder="t('modelManager.displayNamePlaceholder')"
          :input-props="{ 'aria-label': t('modelManager.displayName') }" data-testid="video-config-name" />
      </NFormItem>
      <NFormItem :label="t('modelManager.enabledStatus')">
        <NCheckbox v-model:checked="draft.enabled" :aria-label="t('modelManager.enabledStatus')" />
      </NFormItem>
      <NFormItem :label="t('modelManager.provider.label')"><NText>{{ t('video.provider') }}</NText></NFormItem>
      <NFormItem :label="t('video.modelId')" required>
        <NInput v-model:value="draft.model" :placeholder="SEEDANCE_MODEL"
          :input-props="{ 'aria-label': t('video.modelId') }" data-testid="video-config-model" />
      </NFormItem>
      <NFormItem :label="t('modelManager.apiUrl')" required>
        <NInput v-model:value="draft.baseURL" :placeholder="ARK_VIDEO_BASE_URL"
          :input-props="{ 'aria-label': t('modelManager.apiUrl') }" data-testid="video-config-url" />
      </NFormItem>
      <NFormItem :label="t('video.key')">
        <NInput v-model:value="draft.apiKey" type="password" show-password-on="click" autocomplete="off"
          :placeholder="draft.baseURL.trim().replace(/\/+$/, '') === ARK_VIDEO_BASE_URL ? t('video.keyPlaceholder') : t('video.customKey')"
          :input-props="{ 'aria-label': t('video.key') }" data-testid="video-config-key" />
      </NFormItem>
      <NText v-if="error" type="error" role="alert">{{ error }}</NText>
    </NForm>
    <template #action>
      <NSpace justify="end">
        <NButton :disabled="saving" @click="draft = null">{{ t('common.cancel') }}</NButton>
        <NButton type="primary" attr-type="submit" form="video-config-form" data-testid="video-config-save"
          :loading="saving" :disabled="!draft.name.trim() || !draft.model.trim() || !draft.baseURL.trim()">{{ t('common.save') }}</NButton>
      </NSpace>
    </template>
  </AdaptiveModal>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, NCheckbox, NEmpty, NForm, NFormItem, NInput, NSpace, NText } from 'naive-ui'
import { v4 as uuid } from 'uuid'
import { ARK_VIDEO_BASE_URL, defaultVideoConfig, SEEDANCE_MODEL, type VideoModelConfig, type VideoModelSummary } from '@prompt-optimizer/core'
import { getVideoService } from '../../stores/session/useVideoCreateSession'
import { useToast } from '../../composables/ui/useToast'
import { useConfirmDialog } from '../../composables/ui/useConfirmDialog'
import { useWorkspaceLayout } from '../../composables/ui/useWorkspaceLayout'
import AdaptiveModal from '../common/AdaptiveModal.vue'
import ModelConfigList, { type ModelConfigListItem } from '../common/ModelConfigList.vue'

const { t } = useI18n()
const { isCompact } = useWorkspaceLayout()
const toast = useToast()
const dialog = useConfirmDialog()
const models = ref<VideoModelSummary[]>([])
const loaded = ref(false)
const testing = ref(new Set<string>())
const draft = ref<VideoModelConfig | null>(null)
const original = shallowRef<VideoModelConfig | null>(null)
const saving = ref(false)
const error = ref('')
const rows = computed<ModelConfigListItem[]>(() => models.value.map(config => ({
  id: config.id, name: config.name, provider: t('video.provider'), model: config.model,
  enabled: config.enabled, deletable: true,
  tags: [{ label: t('video.keySource.' + config.keySource), type: config.configured ? 'default' : 'warning' }],
})))
function message(cause: unknown) {
  const detail = cause instanceof Error ? cause.message : String(cause)
  return detail.startsWith('video.error.') ? t(detail) : detail
}
async function refresh() {
  models.value = await getVideoService().listModels()
  loaded.value = true
}
async function updated() {
  window.dispatchEvent(new Event('video-workspace-refresh-models'))
  await refresh()
}
function openAdd() {
  original.value = null
  draft.value = { ...defaultVideoConfig(), id: uuid(), name: '' }
  error.value = ''
}
async function openEdit(id: string, clone = false) {
  try {
    const config = await getVideoService().getConfig(id)
    original.value = clone ? null : config
    draft.value = clone ? { ...config, id: uuid(), name: t('video.copyName', { name: config.name }) } : { ...config }
    error.value = ''
  } catch (cause) { toast.error(message(cause)) }
}
const cloneConfig = (id: string) => openEdit(id, true)
async function save() {
  if (!draft.value || saving.value) return
  saving.value = true
  error.value = ''
  try {
    await getVideoService().saveConfig({ ...draft.value }, original.value)
    draft.value = null
    await updated()
    toast.success(t('video.saved'))
  } catch (cause) { error.value = message(cause) }
  finally { saving.value = false }
}
async function setEnabled(id: string, enabled: boolean) {
  try {
    await getVideoService().setEnabled(id, enabled)
    await updated()
  } catch (cause) { toast.error(message(cause)) }
}
async function remove(id: string) {
  const config = models.value.find(item => item.id === id)
  if (!config || !await dialog.warning({
    title: t('common.delete'), content: t('video.deleteConfirm', { name: config.name }),
    positiveText: t('common.delete'), negativeText: t('common.cancel'),
  })) return
  try {
    await getVideoService().removeConfig(id)
    await updated()
  } catch (cause) { toast.error(message(cause)) }
}
async function testConnection(id: string) {
  if (testing.value.has(id)) return
  testing.value.add(id)
  try {
    await getVideoService().testConnection(id)
    toast.success(t('video.connectionOK'))
  } catch (cause) { toast.error(message(cause)) }
  finally { testing.value.delete(id) }
}
onMounted(() => { void refresh().catch(cause => toast.error(message(cause))) })
defineExpose({ openAdd, openEdit })
</script>
