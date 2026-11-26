<template>
  <div v-if="isCompact" class="mobile-text-model-list" :data-testid="`mobile-${kind}-model-list`">
    <NInput
      v-model:value="search"
      :placeholder="t('common.search')"
      :aria-label="t('common.search')"
      clearable
      :data-testid="`${kind}-model-search`"
    />
    <MobileModelRow
      v-for="model in filteredModels"
      :key="model.id"
      :data-testid="`${kind}-model-row-${model.id}`"
      :title="model.name"
      :subtitle="[model.provider, model.model].filter(Boolean).join(' · ')"
      :enabled="model.enabled"
      :testing="isTestingConnectionFor(model.id)"
      :test-label="t('common.test')" :test-hint="testHint"
      :menu-options="mobileActions(model)"
      @edit="emit('edit', model.id)"
      @test="emit('test', model.id)"
      @action="handleMobileAction($event, model)"
    >
      <div v-if="model.tags.length" class="mobile-text-model-capabilities">
        <span v-for="tag in model.tags" :key="tag.label" :class="{ 'mobile-text-model-restriction': tag.type === 'error' }">{{ tag.label }}</span>
      </div>
    </MobileModelRow>
    <NEmpty v-if="!filteredModels.length" :description="t('common.noContent')" size="small" />
  </div>
  <NSpace v-else vertical :size="12" class="model-list-stack">
    <NCard
      v-for="model in models"
      :key="model.id"
      :data-testid="`${kind}-model-row-${model.id}`"
      size="small"
      hoverable
      class="model-config-card"
      :style="{ opacity: model.enabled ? 1 : 0.6 }"
    >
      <template #header>
        <NSpace justify="space-between" align="center">
          <NSpace vertical :size="4" class="model-card-heading">
            <NSpace align="center" :size="8">
              <NText strong>{{ model.name }}</NText>
              <NTag v-if="!model.enabled" type="warning" size="small" round :bordered="false">
                {{ t('modelManager.disabled') }}
              </NTag>
            </NSpace>

            <NSpace :size="6" class="model-card-tags">
              <NTag size="small" type="default" round :bordered="false">
                {{ model.provider }}
              </NTag>
              <NTag size="small" type="info" round :bordered="false">
                {{ model.model }}
              </NTag>
              <NTag v-for="tag in model.tags" :key="tag.label" :type="tag.type" size="small" round :bordered="false">
                {{ tag.label }}
              </NTag>
            </NSpace>
          </NSpace>
        </NSpace>
      </template>

      <template #header-extra>
        <NSpace @click.stop :size="4" class="model-card-actions">
          <NButton
            @click="emit('test', model.id)"
            :aria-label="t('modelManager.testConnection')" :title="testHint"
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
            :aria-label="t('modelManager.editModel')"
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
            :aria-label="t('modelManager.cloneModel')"
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
            :aria-label="t(model.enabled ? 'common.disable' : 'common.enable')"
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
            v-if="model.deletable"
            @click="emit('delete', model.id)"
            :aria-label="t('common.delete')"
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

<script lang="ts">
export interface ModelConfigListItem {
  id: string
  name: string
  provider: string
  model: string
  modelId?: string
  enabled: boolean
  deletable: boolean
  tags: { label: string; type: 'default' | 'success' | 'info' | 'warning' | 'error' }[]
}
</script>

<script setup lang="ts">
import { Link as UiLink, SquarePen as UiSquarePen, Copy as UiCopy, PowerOff as UiPowerOff, Power as UiPower, Trash2 as UiTrash2 } from '@lucide/vue'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, NCard, NTag, NText, NSpace, NInput, NEmpty, type DropdownOption } from 'naive-ui'
import MobileModelRow from './MobileModelRow.vue'
import { useWorkspaceLayout } from '../../composables/ui/useWorkspaceLayout'

const props = defineProps<{ kind: string; models: ModelConfigListItem[]; testHint?: string; isTestingConnectionFor: (id: string) => boolean }>()
const emit = defineEmits(['test', 'edit', 'clone', 'enable', 'disable', 'delete'])
const { t } = useI18n()
const { isCompact } = useWorkspaceLayout()
const search = ref('')
const filteredModels = computed(() => {
  const query = search.value.trim().toLocaleLowerCase()
  return props.models.filter(model => [model.name, model.provider, model.model, model.modelId]
    .some(value => value?.toLocaleLowerCase().includes(query)))
})
const mobileActions = (model: ModelConfigListItem): DropdownOption[] => [
  { label: t('modelManager.cloneModel'), key: 'clone' },
  { label: t(model.enabled ? 'common.disable' : 'common.enable'), key: model.enabled ? 'disable' : 'enable' },
  ...(model.deletable ? [{ label: t('common.delete'), key: 'delete' }] : []),
]
const handleMobileAction = (action: string, model: ModelConfigListItem) => {
  if (action === 'clone' || action === 'enable' || action === 'disable' || (action === 'delete' && model.deletable)) {
    emit(action, model.id)
  }
}
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
