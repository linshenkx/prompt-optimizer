<template>
  <div class="text-model-manager">
    <TextModelList
      :models="manager.models.value"
      :is-testing-connection-for="isTestingConnectionFor"
      :is-default-model="manager.isDefaultModel"
      @test="handleTestConnection"
      @edit="handleEditModel"
      @enable="handleEnableModel"
      @disable="handleDisableModel"
      @delete="handleDeleteModel"
    />

    <TextModelEditModal
      :show="showEditModal"
      @update:show="updateEditModalVisibility"
      @saved="handleModelUpdated"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, provide, ref, h } from 'vue'

import { useI18n } from 'vue-i18n'
import { isRunningInElectron } from '@prompt-optimizer/core'
import { useTextModelManager } from '../composables/model/useTextModelManager'
import TextModelList from './TextModelList.vue'
import TextModelEditModal from './TextModelEditModal.vue'
import { useDialog } from 'naive-ui'

const emit = defineEmits(['modelsUpdated'])
const { t } = useI18n()
const dialog = useDialog()
const manager = useTextModelManager()
provide('textModelManager', manager)

const showEditModal = ref(false)
const editingModelId = ref<string | null>(null)
const isTestingConnectionFor = (id: string) => !!manager.testingConnections.value[id]
const handleModelUpdated = async (id?: string) => {
  await manager.loadModels()
  const targetId = id || manager.models.value[0]?.id
  if (targetId) {
    emit('modelsUpdated', targetId)
  }

  // 保存成功后关闭模态框并重置表单状态
  showEditModal.value = false
  editingModelId.value = null
  manager.resetFormState()
}

const handleTestConnection = async (id: string) => {
  const runTest = async () => {
    await manager.testConfigConnection(id)
  }

  if (!isRunningInElectron()) {
    const model = manager.models.value.find(m => m.id === id)
    if (model) {
      const isCorsRestricted = !!model.providerMeta?.corsRestricted
      if (isCorsRestricted) {
        const providerName = model.providerMeta?.name || model.providerMeta?.id || 'Unknown Provider'
        dialog.warning({
          title: t('modelManager.corsRestrictedTag'),
          content: () => h('div', { style: 'white-space: pre-line;' }, t('modelManager.corsRestrictedConfirm', { provider: providerName })),
          positiveText: t('common.confirm'),
          negativeText: t('common.cancel'),
          // Don't block dialog close while the async test runs.
          onPositiveClick: () => {
            void runTest()
          }
        })
        return
      }
    }
  }
  await runTest()
}

const handleEditModel = async (id: string) => {
  // 如果已经在编辑同一个模型且模态框已经打开，直接返回
  if (editingModelId.value === id && showEditModal.value === true) {
    return
  }

  // 如果切换到不同的模型，重置表单状态
  if (editingModelId.value && editingModelId.value !== id) {
    manager.resetFormState()
  }

  // 准备编辑模式（总是会执行，因为我们需要确保状态正确）
  await manager.prepareForEdit(id, true)
  editingModelId.value = id
  showEditModal.value = true
}

const updateEditModalVisibility = (value: boolean) => {
  showEditModal.value = value
  // 当模态框关闭时，重置编辑状态但不重置表单数据
  if (!value) {
    editingModelId.value = null
  }
}

const handleEnableModel = async (id: string) => {
  await manager.enableModel(id)
  emit('modelsUpdated', id)
}

const handleDisableModel = async (id: string) => {
  await manager.disableModel(id)
  emit('modelsUpdated', id)
}

const handleDeleteModel = async (id: string) => {
  if (confirm(t('modelManager.deleteConfirm'))) {
    await manager.deleteModel(id)
    const firstId = manager.models.value[0]?.id
    if (firstId) {
      emit('modelsUpdated', firstId)
    }
  }
}

const openAddModal = async () => {
  await manager.prepareForCreate()
  editingModelId.value = null
  showEditModal.value = true
}

defineExpose({
  openAddModal,
  refresh: manager.loadModels
})

onMounted(async () => {
  await manager.loadProviders()
  await manager.loadModels()
  const firstId = manager.models.value[0]?.id
  if (firstId) {
    emit('modelsUpdated', firstId)
  }
})
</script>

<style scoped>
.text-model-manager {
  width: 100%;
}
</style>
