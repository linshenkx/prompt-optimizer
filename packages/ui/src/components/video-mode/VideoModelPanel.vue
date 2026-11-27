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
      <NFormItem :label="t('modelManager.provider.label')" required>
        <NSelect :value="draft.providerId" :options="providerOptions" data-testid="video-config-provider"
          :aria-label="t('modelManager.provider.label')" @update:value="setProvider" />
      </NFormItem>
      <NFormItem :label="t('video.modelId')" required>
        <NSelect :value="draft.modelId" :options="modelOptions" data-testid="video-config-model"
          :aria-label="t('video.modelId')" @update:value="setModel" />
      </NFormItem>
      <NFormItem :label="t('modelManager.apiUrl')" required>
        <NInput v-model:value="draft.baseURL" :placeholder="provider?.defaultBaseURL"
          :input-props="{ 'aria-label': t('modelManager.apiUrl') }" data-testid="video-config-url" />
      </NFormItem>
      <NFormItem :label="t('video.wireModel')">
        <NInput :value="draft.customModel ?? ''" :placeholder="draft.modelId"
          :input-props="{ 'aria-label': t('video.wireModel') }" data-testid="video-config-wire-model" @update:value="setWireModel" />
      </NFormItem>
      <NFormItem :label="t('video.key')">
        <template #label>
          <NSpace align="center" :size="4">
            <span>{{ t('video.key') }}</span>
            <ThemedTooltip v-if="provider?.apiKeyUrl" :label="t('modelManager.getApiKey')">
              <NButton text size="tiny" type="primary" tag="a" :href="provider.apiKeyUrl"
                target="_blank" rel="noopener noreferrer" style="padding: 0 4px;" :aria-label="t('modelManager.getApiKey')"
                data-testid="video-config-key-link">
                <template #icon><ExternalLink :size="14" /></template>
              </NButton>
            </ThemedTooltip>
          </NSpace>
        </template>
        <NInput v-model:value="draft.apiKey" type="password" show-password-on="click" autocomplete="off"
          :placeholder="isOfficialVideoBaseURL(draft.providerId, draft.baseURL) ? t('video.keyPlaceholder') : t('video.customKey')"
          :input-props="{ 'aria-label': t('video.key') }" data-testid="video-config-key" />
      </NFormItem>
      <NText v-if="error" type="error" role="alert">{{ error }}</NText>
    </NForm>
    <template #action>
      <NSpace justify="end">
        <NButton :disabled="saving" @click="draft = null">{{ t('common.cancel') }}</NButton>
        <NButton type="primary" attr-type="submit" form="video-config-form" data-testid="video-config-save"
          :loading="saving" :disabled="!draft.name.trim() || !draft.modelId || !draft.baseURL.trim()">{{ t('common.save') }}</NButton>
      </NSpace>
    </template>
  </AdaptiveModal>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { ExternalLink } from '@lucide/vue'
import { NButton, NCheckbox, NEmpty, NForm, NFormItem, NInput, NSelect, NSpace, NText } from 'naive-ui'
import { v4 as uuid } from 'uuid'
import { defaultVideoConfig, getVideoModelSpec, isOfficialVideoBaseURL, listVideoModelPresets, VIDEO_PROVIDERS, videoWireModel,
  type VideoModelConfig, type VideoModelSummary, type VideoProviderId } from '@prompt-optimizer/core'
import { getVideoService } from '../../stores/session/useVideoCreateSession'
import { useToast } from '../../composables/ui/useToast'
import { useConfirmDialog } from '../../composables/ui/useConfirmDialog'
import { useWorkspaceLayout } from '../../composables/ui/useWorkspaceLayout'
import AdaptiveModal from '../common/AdaptiveModal.vue'
import ThemedTooltip from '../common/ThemedTooltip.vue'
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
const providerOptions = computed(() => Object.values(VIDEO_PROVIDERS).map(provider => ({ value: provider.id, label: t(provider.labelKey) })))
const capabilityTags = (modelId: string, providerId?: VideoProviderId) => {
  const capabilities = getVideoModelSpec(modelId, providerId)?.capabilities
  if (!capabilities) return []
  return [
    capabilities.text2video && t('video.textMode'),
    capabilities.firstFrame && t(capabilities.firstLastFrame ? 'video.frameMode' : 'video.roles.first_frame'),
    capabilities.maxReferenceImages > 0 && t('video.referenceBadge', { n: capabilities.maxReferenceImages }),
    capabilities.supportsCancel && t('video.cancel'),
  ].filter((label): label is string => !!label)
}
const modelOptions = computed(() => {
  const config = draft.value
  return config ? listVideoModelPresets(config.providerId, config.modelId).map(spec => ({
    value: spec.id, label: [spec.name, ...capabilityTags(spec.id, spec.providerId)].join(' · '),
  })) : []
})
const provider = computed(() => draft.value && VIDEO_PROVIDERS[draft.value.providerId])
const setWireModel = (value: string) => {
  if (draft.value) draft.value.customModel = value || undefined
}
const setModel = (id: string, previousProvider?: VideoProviderId) => {
  if (!draft.value) return
  const previousName = getVideoModelSpec(draft.value.modelId, previousProvider ?? draft.value.providerId)?.name
  draft.value.modelId = id
  draft.value.customModel = undefined
  if (!draft.value.name || draft.value.name === previousName) draft.value.name = getVideoModelSpec(id, draft.value.providerId)?.name ?? ''
}
const setProvider = (id: VideoProviderId) => {
  if (!draft.value || draft.value.providerId === id) return
  const previousProvider = draft.value.providerId
  draft.value.providerId = id
  draft.value.apiKey = ''
  draft.value.baseURL = VIDEO_PROVIDERS[id].defaultBaseURL
  setModel(VIDEO_PROVIDERS[id].defaultModelId, previousProvider)
}
const rows = computed<ModelConfigListItem[]>(() => models.value.map(config => ({
  id: config.id, name: config.name, provider: t(VIDEO_PROVIDERS[config.providerId].labelKey),
  model: [getVideoModelSpec(config.modelId, config.providerId)?.name, videoWireModel(config)].filter(Boolean).join(' · '),
  enabled: config.enabled, deletable: true,
  tags: [
    ...capabilityTags(config.modelId, config.providerId).map(label => ({ label, type: 'default' as const })),
    { label: t('video.keySource.' + config.keySource), type: config.configured ? 'default' : 'warning' },
  ],
})))
function message(cause: unknown) {
  const detail = (cause as { message?: string } | null)?.message ?? String(cause)
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
  draft.value = { ...defaultVideoConfig(), id: uuid() }
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
    await getVideoService().saveConfig({ ...draft.value, customModel: draft.value.customModel?.trim() || undefined }, original.value)
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
