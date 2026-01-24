<template>
  <OutputDisplayCore
    ref="coreDisplayRef"
    v-bind="$attrs"
    :content="content"
    :originalContent="originalContent"
    :reasoning="reasoning"
    :mode="mode"
    :reasoningMode="reasoningMode"
    :enabledActions="enabledActions"
    :height="height"
    :placeholder="placeholder"
    :loading="loading"
    :streaming="streaming"
    :compareService="compareService"
    :test-id="testId"
    :style="{ height: '100%', maxHeight: '100%', flex: 1, minHeight: 0, overflow: 'hidden' }"
    @update:content="emit('update:content', $event)"
    @update:reasoning="emit('update:reasoning', $event)"
    @copy="handleCopy"
    @fullscreen="handleFullscreen"
    @edit-start="emit('edit-start')"
    @edit-end="emit('edit-end')"
    @reasoning-toggle="emit('reasoning-toggle', $event)"
    @view-change="emit('view-change', $event)"
    @save-favorite="emit('save-favorite', $event)"
  >
    <template #toolbar-right-extra>
      <slot name="toolbar-right-extra"></slot>
    </template>
  </OutputDisplayCore>
  <OutputDisplayFullscreen
    v-model="isShowingFullscreen"
    :content="content"
    :originalContent="originalContent"
    :reasoning="reasoning"
    :title="title"
    :mode="mode"
    :reasoningMode="reasoningMode"
    :enabledActions="enabledActions"
    :streaming="streaming"
    :loading="loading"
    :placeholder="placeholder"
    @update:content="emit('update:content', $event)"
    @copy="handleCopy"
  />
</template>

<script setup lang="ts">
import { computed, ref, inject, type Ref } from 'vue'

import OutputDisplayCore from './OutputDisplayCore.vue';
import OutputDisplayFullscreen from './OutputDisplayFullscreen.vue';
import type { AppServices } from '../types/services';

defineOptions({
  inheritAttrs: false,
});

type ActionName = 'fullscreen' | 'diff' | 'copy' | 'edit' | 'reasoning' | 'favorite'

// Props
interface Props {
  content?: string
  originalContent?: string
  reasoning?: string
  title?: string // title is used by fullscreen wrapper, but keep it here for compatibility
  mode: 'readonly' | 'editable'
  reasoningMode?: 'show' | 'hide' | 'auto'
  enableCopy?: boolean // Mapped to enabledActions
  enableFullscreen?: boolean // Mapped to enabledActions
  enableEdit?: boolean // Mapped to enabledActions
  enableDiff?: boolean // Mapped to enabledActions
  enableFavorite?: boolean // Mapped to enabledActions
  height?: string | number
  placeholder?: string
  loading?: boolean
  streaming?: boolean

  /** 透传给 OutputDisplayCore 的 data-testid（挂在根节点） */
  testId?: string
}

const props = withDefaults(defineProps<Props>(), {
    enableCopy: true,
    enableFullscreen: true,
    enableEdit: true,
    enableDiff: true,
    enableFavorite: true,
    testId: undefined,
});

// Emits
const emit = defineEmits<{
  'update:content': [content: string]
  'update:reasoning': [reasoning: string]
  'copy': [content: string, type: 'content' | 'reasoning' | 'all']
  'fullscreen': []
  'edit-start': []
  'edit-end': []
  'reasoning-toggle': [expanded: boolean]
  'view-change': [mode: 'base' | 'diff']
  'reasoning-auto-hide': []
  'save-favorite': [data: { content: string; originalContent?: string }]
}>()

const isShowingFullscreen = ref(false);

const testId = computed(() => props.testId || undefined)

// 注入服务并获取 CompareService
const services = inject<Ref<AppServices | null>>('services');
if (!services) {
  throw new Error('[OutputDisplay] services未正确注入，请确保在App组件中正确provide了services');
}

const compareService = computed(() => {
  const servicesValue = services.value;
  if (!servicesValue) {
    throw new Error('[OutputDisplay] services未初始化，请确保应用已正确启动');
  }

  const service = servicesValue.compareService;
  if (!service) {
    throw new Error('[OutputDisplay] compareService未初始化，请确保服务已正确配置');
  }

  return service;
});

const enabledActions = computed(() => {
    const actions: ActionName[] = ['reasoning'];
    if (props.enableFullscreen) actions.push('fullscreen');
    if (props.enableDiff) actions.push('diff');
    if (props.enableCopy) actions.push('copy');
    if (props.enableEdit) actions.push('edit');
    if (props.enableFavorite) actions.push('favorite');
    return actions;
})

const handleCopy = (content: string, type: 'content' | 'reasoning' | 'all') => {
  emit('copy', content, type);
}

const handleFullscreen = () => {
  isShowingFullscreen.value = true;
  emit('fullscreen');
}

const coreDisplayRef = ref<InstanceType<typeof OutputDisplayCore> | null>(null);

const forceRefreshContent = () => {
  if (coreDisplayRef.value) {
    coreDisplayRef.value.forceRefreshContent();
  }
}

const forceExitEditing = () => {
  if (coreDisplayRef.value) {
    coreDisplayRef.value.forceExitEditing();
  }
}

defineExpose({ forceRefreshContent, forceExitEditing });

</script>

<style scoped>
.output-display {
  @apply flex flex-col h-full border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 relative;
}

/* 悬浮工具栏样式 */
.floating-toolbar {
  @apply absolute top-2 right-2 z-10 flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(0, 0, 0, 0.1);
}

/* 全屏模式下的悬浮复制按钮 */
.floating-copy-btn {
  @apply absolute top-2 right-2 z-10 flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.dark .floating-toolbar,
.dark .floating-copy-btn {
  background: rgba(31, 41, 55, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.toolbar-btn {
  @apply flex items-center gap-1 px-2 py-1 text-sm rounded transition-colors;
  @apply hover:bg-gray-100 dark:hover:bg-gray-700;
  @apply focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50;
}

/* 悬浮工具栏动画 */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.2s ease-out;
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.output-display__reasoning {
  @apply flex-none mt-4;
}

.output-display__reasoning.streaming {
  @apply border-l-4 border-blue-500;
}

.reasoning-header {
  @apply flex justify-between items-center cursor-pointer p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors;
}

.reasoning-toggle {
  @apply transform transition-transform duration-200;
}

.reasoning-toggle.expanded {
  @apply rotate-180;
}

.reasoning-content {
  @apply overflow-y-auto mt-0;
  max-height: 30vh; /* 使用视口高度的30%，更灵活 */
  padding: 0; /* 移除所有内边距，让推理内容贴边显示 */
}

.reasoning-content-fullscreen {
  /* 全屏模式下的推理内容样式 */
}

.reasoning-actions {
  @apply flex justify-end mt-2;
}

.streaming-indicator {
  @apply inline-flex items-center gap-1 text-blue-500;
}

.streaming-indicator::before {
  content: '';
  @apply w-2 h-2 rounded-full bg-blue-500 animate-pulse;
}

.output-display__content {
  @apply flex-1 min-h-0;
}

.readonly-view {
  @apply relative;
}

.editable-view {
  @apply relative;
}

.loading-placeholder,
.empty-placeholder {
  @apply flex items-center justify-center h-full text-gray-500 text-sm italic;
}

.edit-actions {
  @apply absolute bottom-2 right-2 flex space-x-2;
}

.output-display--loading {
  @apply opacity-60 pointer-events-none;
}

.output-display--editable .output-display__content {
  @apply border border-dashed border-gray-300 dark:border-gray-600;
}

.output-display--editing .output-display__content {
  @apply border-solid border-blue-500;
}

/* 隐藏滚动条但保持可滚动 */
.reasoning-content,
textarea {
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE and Edge */
}

.reasoning-content::-webkit-scrollbar,
textarea::-webkit-scrollbar {
  display: none; /* Chrome, Safari and Opera */
}
</style> 
