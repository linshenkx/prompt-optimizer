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
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="h-4 w-4"
              >
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            </template>
            <span class="hidden md:inline">{{ t('modelManager.testConnection') }}</span>
          </NButton>

          <NButton
            @click="emit('edit', model.id)"
            size="small"
            quaternary
          >
            <template #icon>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                class="h-4 w-4"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
                />
              </svg>
            </template>
            <span class="hidden md:inline">{{ t('modelManager.editModel') }}</span>
          </NButton>

          <NButton
            @click="emit('clone', model.id)"
            size="small"
            quaternary
          >
            <template #icon>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-4 w-4">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
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
              <svg
                v-if="model.enabled"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="h-4 w-4"
              >
                <path d="M12 6v.343" />
                <path d="M18.218 18.218A7 7 0 0 1 5 15V9a7 7 0 0 1 .782-3.218" />
                <path d="M19 13.343V9A7 7 0 0 0 8.56 2.902" />
                <path d="M22 22 2 2" />
              </svg>
              <svg
                v-else
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="h-4 w-4"
              >
                <rect x="5" y="2" width="14" height="20" rx="7" />
                <path d="M12 6v4" />
              </svg>
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
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                class="h-4 w-4"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.11 0 0 0-7.5 0"
                />
              </svg>
            </template>
            <span class="hidden md:inline">{{ t('common.delete') }}</span>
          </NButton>
        </NSpace>
      </template>
    </NCard>
  </NSpace>
</template>

<script setup lang="ts">
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
