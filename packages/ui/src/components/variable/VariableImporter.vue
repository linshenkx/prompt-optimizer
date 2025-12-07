<template>
  <NModal 
    v-model:show="localVisible"
    preset="card" 
    :title="t('variables.importer.title')"
    size="large"
    :segmented="{ content: true }"
    :style="modalStyle"
    @after-leave="onAfterLeave"
    @close="cancel"
    :mask-closable="true"
    @mask-click="cancel"
    @esc="cancel"
  >

    <!-- 导入方式选择 -->
    <NTabs v-model:value="activeMethod" type="segment">
      <NTabPane name="file" :tab="t('variables.importer.fromFile')">
        <NSpace vertical>
          <NUpload
            :file-list="[]"
            :max="1"
            accept=".csv,.txt"
            :show-file-list="true"
            :on-before-upload="handleBeforeUpload"
            drag
          >
            <NUploadDragger>
              <div style="text-align:center; padding: 24px;">
                <NIcon size="48" style="display:block; margin: 0 auto 12px;">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                  </svg>
                </NIcon>
                <NText>
                  {{ t('variables.importer.dropFile') }}
                </NText>
                <div>
                  <NText depth="3">
                    {{ t('variables.importer.orClickToSelect') }}
                  </NText>
                </div>
              </div>
            </NUploadDragger>
          </NUpload>

          <NAlert type="info">
            <template #icon>
              <NIcon>
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-4a1 1 0 00-.894.553l-3 6a1 1 0 001.788.894L8.618 12h2.764l.724 1.447a1 1 0 001.788-.894l-3-6A1 1 0 0010 6z" clip-rule="evenodd"/>
                </svg>
              </NIcon>
            </template>
            <template #header>
              {{ t('variables.importer.fileRequirements') }}
            </template>
            <NUl>
              <NLi>{{ t('variables.importer.supportedFormats') }}: CSV, TXT</NLi>
              <NLi>{{ t('variables.importer.maxSize') }}: 10MB</NLi>
              <NLi>{{ t('variables.importer.structureExample') }}</NLi>
            </NUl>
          </NAlert>
        </NSpace>
      </NTabPane>
      <NTabPane name="text" :tab="t('variables.importer.fromText')">
        <NSpace vertical>
          <NFormItem :label="t('variables.importer.textFormat')" label-placement="top">
            <NRadioGroup v-model:value="textFormat">
              <NSpace>
                <NRadio value="csv">CSV</NRadio>
                <NRadio value="txt">{{ t('variables.importer.keyValuePairs') }}</NRadio>
              </NSpace>
            </NRadioGroup>
          </NFormItem>
          <NFormItem :label="getTextInputLabel()" label-placement="top">
            <NInput
              v-model:value="importText"
              type="textarea"
              :placeholder="getTextInputPlaceholder()"
              :autosize="{ minRows: 10, maxRows: 15 }"
              :input-props="{ style: 'font-family: Monaco, Consolas, monospace; font-size: 13px;' }"
            />
            <template #feedback>
              <NText depth="3" style="font-size: 12px;">
                {{ getTextInputHelp() }}
              </NText>
            </template>
          </NFormItem>
        </NSpace>
      </NTabPane>
    </NTabs>

    <!-- 文件选择反馈 -->
    <NAlert v-if="selectedFile && activeMethod === 'file'" type="success" size="small">
        <template #icon>
          <NIcon>
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clip-rule="evenodd"/>
            </svg>
          </NIcon>
        </template>
        已选择文件：{{ selectedFile.name }} ({{ (selectedFile.size / 1024).toFixed(1) }} KB)
    </NAlert>

    <!-- 预览区域 -->
    <div v-if="hasPreviewData">
      <NCard size="small">
        <template #header>
          <NText strong>
            {{ t('variables.importer.previewTitle', { count: Object.keys(previewVariables).length }) }}
          </NText>
        </template>
        <NScrollbar style="max-height: 240px;">
          <NList hoverable>
            <NListItem v-for="[name, value] in Object.entries(previewVariables)" :key="name">
              <NSpace size="small">
                <NText code>{{ formatVariableName(name) }}</NText>
                <NText depth="2">{{ truncateValue(value) }}</NText>
              </NSpace>
            </NListItem>
          </NList>
        </NScrollbar>
      </NCard>
    </div>

    <!-- 错误信息 -->
    <NAlert v-if="error" type="error" size="small">
        <template #icon>
          <NIcon>
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clip-rule="evenodd"/>
            </svg>
          </NIcon>
        </template>
        {{ error }}
    </NAlert>

    <template #footer>
      <NSpace justify="end">
        <NButton @click="cancel" :disabled="loading">
          {{ t('common.cancel') }}
        </NButton>
        <NButton 
          type="primary"
          @click="importVariables"
          :disabled="!canImport || loading"
          :loading="loading"
        >
          {{ t('variables.importer.import') }}
        </NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

import { useI18n } from 'vue-i18n'
import { 
  NModal, NButton, NTabs, NTabPane, NUpload, NUploadDragger, NText, 
  NAlert, NUl, NLi, NFormItem, NInput, NSpace,
  NRadioGroup, NRadio, NCard, NList, NListItem, NScrollbar, NIcon,
  type UploadFileInfo 
} from 'naive-ui'

const { t } = useI18n()

interface Emits {
  (e: 'import', variables: Record<string, string>): void
  (e: 'cancel'): void
  (e: 'update:show', value: boolean): void
}
const emit = defineEmits<Emits>()

// 可见性（与父组件同步，用于一致的过渡动画）
const props = defineProps<{ show?: boolean }>()
const localVisible = computed({
  get: () => props.show ?? true,
  set: (val: boolean) => emit('update:show', val)
})

const modalStyle = { width: '600px', maxWidth: '90vw' }

// 状态管理
const loading = ref(false)
const activeMethod = ref<'file' | 'text'>('file')
const importText = ref('')
const error = ref('')
const textFormat = ref<'csv' | 'txt'>('csv')
const selectedFile = ref<File | null>(null)
const previewVariables = ref<Record<string, string>>({})

// 计算属性
const canImport = computed(() => {
  if (activeMethod.value === 'file') {
    return selectedFile.value !== null && Object.keys(previewVariables.value).length > 0 && !error.value
  }
  return importText.value.trim() !== '' && !error.value
})

const hasPreviewData = computed(() => {
  return Object.keys(previewVariables.value).length > 0
})

const formatVariableName = (name: string) => `{{${name}}}`

// 工具函数
const truncateValue = (value: string, maxLength: number = 60): string => {
  if (value.length <= maxLength) return value
  return value.substring(0, maxLength) + '...'
}

// 文本输入相关的计算方法
const getTextInputLabel = (): string => {
  const labels = {
    csv: t('variables.importer.csvText'),
    txt: t('variables.importer.txtText')
  }
  return labels[textFormat.value] || labels.csv
}

const getTextInputPlaceholder = (): string => {
  const placeholders = {
    csv: 'name,value\nvariable1,value1\nvariable2,value2',
    txt: 'variable1=value1\nvariable2=value2\nvariable3:value3'
  }
  return placeholders[textFormat.value] || placeholders.csv
}

const getTextInputHelp = (): string => {
  const helps = {
    csv: t('variables.importer.csvTextHelp'),
    txt: t('variables.importer.txtTextHelp')
  }
  return helps[textFormat.value] || helps.csv
}

const parseVariables = (data: unknown, format: 'csv' | 'txt' = 'csv'): Record<string, string> => {
  if (format === 'csv') {
    return parseCsvVariables(data as string)
  } else if (format === 'txt') {
    return parseTxtVariables(data as string)
  }
  throw new Error(t('variables.importer.errors.unsupportedFormat'))
}

const parseCsvVariables = (content: string): Record<string, string> => {
  const lines = content.trim().split('\n')
  if (lines.length < 2) {
    throw new Error(t('variables.importer.errors.csvMinRows'))
  }
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
  const nameIndex = headers.findIndex(h => ['name', 'key', 'variable'].includes(h.toLowerCase()))
  const valueIndex = headers.findIndex(h => ['value', 'val'].includes(h.toLowerCase()))
  
  if (nameIndex === -1 || valueIndex === -1) {
    throw new Error(t('variables.importer.errors.csvRequiredColumns'))
  }
  
  const variables: Record<string, string> = {}
  
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',').map(c => c.trim().replace(/"/g, ''))
    if (cells.length > Math.max(nameIndex, valueIndex)) {
      const name = cells[nameIndex]
      const value = cells[valueIndex]
      if (name && value !== undefined) {
        // 验证变量名格式
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
          throw new Error(t('variables.importer.errors.invalidVariableName', { name }))
        }
        variables[name] = value
      }
    }
  }
  
  return variables
}

const parseTxtVariables = (content: string): Record<string, string> => {
  const variables: Record<string, string> = {}
  const lines = content.trim().split('\n')
  
  for (const line of lines) {
    const trimmedLine = line.trim()
    if (!trimmedLine || trimmedLine.startsWith('#')) continue
    
    const separatorIndex = Math.max(
      trimmedLine.indexOf('='),
      trimmedLine.indexOf(':'),
      trimmedLine.indexOf('\t')
    )
    
    if (separatorIndex > 0) {
      const name = trimmedLine.substring(0, separatorIndex).trim()
      const value = trimmedLine.substring(separatorIndex + 1).trim()
      if (name && value) {
        // 验证变量名格式
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
          throw new Error(t('variables.importer.errors.invalidVariableName', { name }))
        }
        variables[name] = value
      }
    }
  }
  
  return variables
}

// 文件处理
const handleBeforeUpload = (data: { file: UploadFileInfo }) => {
  const file = data.file.file
  if (file) {
    handleFile(file)
  }
  return false // 阻止自动上传
}

const handleFile = (file: File) => {
  const fileExtension = file.name.split('.').pop()?.toLowerCase()
  const supportedTypes = ['csv', 'txt']
  
  if (!supportedTypes.includes(fileExtension || '')) {
    error.value = t('variables.importer.errors.invalidFileType')
    return
  }
  
  if (file.size > 10 * 1024 * 1024) { // 10MB
    error.value = t('variables.importer.errors.fileTooLarge')
    return
  }
  
  selectedFile.value = file
  error.value = ''
  
  const reader = new FileReader()
  reader.onload = (e) => {
    const content = e.target?.result as string
    importText.value = content
    
    // 根据文件类型设置文本格式
    if (fileExtension === 'csv') {
      textFormat.value = 'csv'
    } else if (fileExtension === 'txt') {
      textFormat.value = 'txt'
    }
    
    // 立即解析并预览变量
    try {
      const variables = parseVariables(content, textFormat.value)
      previewVariables.value = variables
    } catch (_err) {
      error.value = err instanceof Error ? err.message : t('variables.importer.errors.parseError')
      previewVariables.value = {}
    }
  }
  reader.onerror = () => {
    error.value = t('variables.importer.errors.fileReadError')
    selectedFile.value = null
    previewVariables.value = {}
  }
  reader.readAsText(file)
}

// 事件处理
const onAfterLeave = () => {
  emit('cancel')
}

const cancel = () => {
  localVisible.value = false
}

const importVariables = () => {
  if (!canImport.value) return
  
  try {
    loading.value = true
    error.value = ''
    
    let variables: Record<string, string>
    
    if (activeMethod.value === 'file' && Object.keys(previewVariables.value).length > 0) {
      // 使用已预览的变量
      variables = previewVariables.value
    } else {
      // 从文本解析变量
      variables = parseVariables(importText.value, textFormat.value)
    }
    
    // 过滤掉预定义变量
    const predefinedNames = ['originalPrompt', 'lastOptimizedPrompt', 'iterateInput', 'currentPrompt', 'userQuestion', 'conversationContext', 'toolsContext']
    const filteredVariables: Record<string, string> = {}
    
    for (const [name, value] of Object.entries(variables)) {
      if (!predefinedNames.includes(name)) {
        filteredVariables[name] = value
      }
    }
    
    emit('import', filteredVariables)
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : t('variables.importer.errors.parseError')
  } finally {
    loading.value = false
  }
}

// 监听方法切换
watch(activeMethod, () => {
  error.value = ''
  selectedFile.value = null
  previewVariables.value = {}
  if (activeMethod.value === 'file') {
    importText.value = ''
    textFormat.value = 'csv'
  }
})

// 监听文本变化，实时解析预览
watch([importText, textFormat], () => {
  if (activeMethod.value === 'text' && importText.value.trim()) {
    try {
      const variables = parseVariables(importText.value, textFormat.value)
      previewVariables.value = variables
      error.value = ''
    } catch (_err) {
      previewVariables.value = {}
      // 不立即显示错误，等用户完成输入
    }
  } else if (activeMethod.value === 'text') {
    previewVariables.value = {}
  }
})
</script>

<style scoped>
/* Pure Naive UI implementation - no custom theme CSS needed */
</style>
