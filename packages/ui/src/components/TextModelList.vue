<template>
  <div v-if="isCompact" class="mobile-text-model-list" data-testid="mobile-text-model-list">
    <NInput
      v-model:value="search"
      :placeholder="t('common.search')"
      :aria-label="t('common.search')"
      clearable
      data-testid="text-model-search"
    />
    <MobileModelRow
      v-for="model in filteredModels"
      :key="model.id"
      :title="modelDisplayName(model)"
      :subtitle="[providerDisplayName(model), model.modelMeta?.name || model.modelMeta?.id].filter(Boolean).join(' · ')"
      :enabled="model.enabled"
      :testing="isTestingConnectionFor(model.id)"
      :test-label="t('common.test')"
      :menu-options="mobileActions(model)"
      @edit="emit('edit', model.id)"
      @test="emit('test', model.id)"
      @action="handleMobileAction($event, model)"
    >
      <div v-if="hasMobileCapabilities(model)" class="mobile-text-model-capabilities">
        <span v-if="model.modelMeta?.capabilities?.supportsTools">{{ t('modelManager.capabilities.tools') }}</span>
        <span v-if="model.modelMeta?.capabilities?.supportsReasoning">{{ t('modelManager.capabilities.reasoning') }}</span>
        <span v-if="model.providerMeta?.corsRestricted && !isElectronEnv" class="mobile-text-model-restriction">
          {{ t('modelManager.corsRestrictedTag') }}
        </span>
      </div>
    </MobileModelRow>
    <NEmpty v-if="!filteredModels.length" :description="t('common.noContent')" size="small" />
  </div>
  <NSpace v-else vertical :size="12" class="model-list-stack">
    <NCard
      v-for="model in models"
      :key="model.id"
      size="small"
      hoverable
      class="model-config-card"
      :style="{ opacity: model.enabled ? 1 : 0.6 }"
    >
      <template #header>
        <NSpace justify="space-between" align="center">
          <NSpace vertical :size="4" class="model-card-heading">
            <NSpace align="center" :size="8">
              <NText strong>{{ modelDisplayName(model) }}</NText>
              <NTag v-if="!model.enabled" type="warning" size="small" round :bordered="false">
                {{ t('modelManager.disabled') }}
              </NTag>
            </NSpace>

            <NSpace :size="6" class="model-card-tags">
              <NTag size="small" type="default" round :bordered="false">
                {{ providerDisplayName(model) }}
              </NTag>
              <NTag size="small" type="info" round :bordered="false">
                {{ model.modelMeta?.name || model.modelMeta?.id }}
              </NTag>
              <NTag
                v-if="model.providerMeta?.corsRestricted && !isElectronEnv"
                size="small"
                type="error"
                round
                :bordered="false"
              >
                {{ t('modelManager.corsRestrictedTag') }}
              </NTag>
              <NTag
                v-if="model.modelMeta?.capabilities?.supportsTools"
                size="small"
                type="success"
                round
                :bordered="false"
              >
                {{ t('modelManager.capabilities.tools') }}
              </NTag>
              <NTag
                v-if="model.modelMeta?.capabilities?.supportsReasoning"
                size="small"
                type="warning"
                round
                :bordered="false"
              >
                {{ t('modelManager.capabilities.reasoning') }}
              </NTag>
            </NSpace>
          </NSpace>
        </NSpace>
      </template>

      <template #header-extra>
        <NSpace @click.stop :size="4" class="model-card-actions">
          <NButton
            @click="emit('test', model.id)"
            size="small"
            quaternary
            :disabled="isTestingConnectionFor(model.id)"
            :loading="isTestingConnectionFor(model.id)"
          >
            <template #icon>
              <UiLink />
            </template>
            <span class="hidden md:inline">{{ t('modelManager.testConnection') }}</span>
          </NButton>

          <NButton
            @click="emit('edit', model.id)"
            size="small"
            quaternary
          >
            <template #icon>
              <UiSquarePen />
            </template>
            <span class="hidden md:inline">{{ t('modelManager.editModel') }}</span>
          </NButton>

          <NButton
            @click="emit('clone', model.id)"
            size="small"
            quaternary
          >
            <template #icon>
              <UiCopy />
            </template>
            <span class="hidden md:inline">{{ t('modelManager.cloneModel') }}</span>
          </NButton>

          <NButton
            @click="emit(model.enabled ? 'disable' : 'enable', model.id)"
            size="small"
            :type="model.enabled ? 'warning' : 'success'"
            quaternary
          >
            <template #icon>
              <UiPowerOff v-if="model.enabled" />
              <UiPower v-else />
            </template>
            <span class="hidden md:inline">{{ model.enabled ? t('common.disable') : t('common.enable') }}</span>
          </NButton>

          <NButton
            v-if="!isDefaultModel(model.id)"
            @click="emit('delete', model.id)"
            size="small"
            type="error"
            quaternary
          >
            <template #icon>
              <UiTrash2 />
            </template>
            <span class="hidden md:inline">{{ t('common.delete') }}</span>
          </NButton>
        </NSpace>
      </template>
    </NCard>
  </NSpace>
</template>

<script setup lang="ts">
import { Link as UiLink, SquarePen as UiSquarePen, Copy as UiCopy, PowerOff as UiPowerOff, Power as UiPower, Trash2 as UiTrash2 } from '@lucide/vue'
import { computed, ref, type PropType } from 'vue'

import { useI18n } from 'vue-i18n'
import { NButton, NCard, NTag, NText, NSpace, NInput, NEmpty, type DropdownOption } from 'naive-ui'
import MobileModelRow from './common/MobileModelRow.vue'
import { useWorkspaceLayout } from '../composables/ui/useWorkspaceLayout'
import { isRunningInElectron, type TextModelConfig } from '@prompt-optimizer/core'
import { getProviderDisplayName, getTextModelConfigDisplayName } from '../utils/provider-display'

const { models, isTestingConnectionFor, isDefaultModel } = defineProps({
  models: {
    type: Array as PropType<TextModelConfig[]>,
    default: () => []
  },
  isTestingConnectionFor: {
    type: Function as PropType<(id: string) => boolean>,
    required: true
  },
  isDefaultModel: {
    type: Function as PropType<(id: string) => boolean>,
    required: true
  }
})

const emit = defineEmits(['test', 'edit', 'clone', 'enable', 'disable', 'delete'])

const { t } = useI18n()

const { isCompact } = useWorkspaceLayout()
const search = ref('')
const filteredModels = computed(() => {
  const query = search.value.trim().toLocaleLowerCase()
  if (!query) return models
  return models.filter(model => [modelDisplayName(model), providerDisplayName(model), model.modelMeta?.name, model.modelMeta?.id]
    .some(value => value?.toLocaleLowerCase().includes(query)))
})
const isElectronEnv = isRunningInElectron()
const mobileActions = (model: TextModelConfig): DropdownOption[] => [
  { label: t('modelManager.cloneModel'), key: 'clone' },
  { label: model.enabled ? t('common.disable') : t('common.enable'), key: model.enabled ? 'disable' : 'enable' },
  ...(!isDefaultModel(model.id) ? [{ label: t('common.delete'), key: 'delete' }] : []),
]
const handleMobileAction = (action: string, model: TextModelConfig) => {
  if (action === 'clone' || action === 'enable' || action === 'disable') emit(action, model.id)
  else if (action === 'delete' && !isDefaultModel(model.id)) emit('delete', model.id)
}
const hasMobileCapabilities = (model: TextModelConfig) =>
  model.modelMeta?.capabilities?.supportsTools || model.modelMeta?.capabilities?.supportsReasoning ||
  (model.providerMeta?.corsRestricted && !isElectronEnv)
const modelDisplayName = (model: TextModelConfig) => getTextModelConfigDisplayName(model, t)
const providerDisplayName = (model: TextModelConfig) => getProviderDisplayName(model.providerMeta, t)
</script>

<style scoped>
.mobile-text-model-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mobile-text-model-capabilities {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  color: var(--compact-muted);
  font-size: 12px;
  line-height: 1.4;
}

.mobile-text-model-restriction {
  color: var(--n-error-color);
}

.model-list-stack {
  width: 100%;
}

.model-config-card {
   border-radius: 16px;
}

.model-config-card :deep(.n-card-header) {
  padding-bottom: 10px;
}

.model-config-card :deep(.n-card__content) {
  padding-top: 0;
}

.model-card-heading,
.model-card-tags {
  max-width: 100%;
}

.model-card-tags {
  flex-wrap: wrap;
}

.model-card-actions {
  align-items: center;
  flex-wrap: nowrap;
}
</style>
