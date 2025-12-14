<template>
    <!--
        App 核心导航组件

        职责:
        - 功能模式选择器 (Basic / Pro / Image)
        - 各模式的子模式选择器

        设计说明:
        - 从 App.vue 的 #core-nav slot 提取出来
        - 所有操作通过 emits 通知父组件处理
        - 保持与原实现完全一致的 UI 和行为
    -->
    <NSpace :size="12" align="center">
        <!-- 功能模式选择器 -->
        <FunctionModeSelector
            :modelValue="functionMode"
            @update:modelValue="emit('update:functionMode', $event)"
        />

        <!-- 子模式选择器 - 基础模式 -->
        <OptimizationModeSelectorUI
            v-if="functionMode === 'basic'"
            :modelValue="basicSubMode"
            functionMode="basic"
            @change="emit('basic-sub-mode-change', $event)"
        />

        <!-- 子模式选择器 - 上下文模式 -->
        <OptimizationModeSelectorUI
            v-if="functionMode === 'pro'"
            :modelValue="proSubMode"
            functionMode="pro"
            @change="emit('pro-sub-mode-change', $event)"
        />

        <!-- 子模式选择器 - 图像模式 -->
        <ImageModeSelector
            v-if="functionMode === 'image'"
            :modelValue="imageSubMode"
            @change="emit('image-sub-mode-change', $event)"
        />
    </NSpace>
</template>

<script setup lang="ts">
/**
 * App 核心导航组件
 *
 * @description
 * 从 App.vue 提取出的核心导航组件，用于 MainLayoutUI 的 #core-nav slot。
 * 包含功能模式选择器和各模式的子模式选择器。
 *
 * @features
 * - 功能模式切换: Basic / Pro / Image
 * - 基础模式子模式: system / user
 * - 上下文模式子模式: system / user
 * - 图像模式子模式: text2image / image2image
 *
 * @example
 * ```vue
 * <template #core-nav>
 *   <AppCoreNav
 *     v-model:functionMode="functionMode"
 *     :basicSubMode="basicSubMode"
 *     :proSubMode="proSubMode"
 *     :imageSubMode="imageSubMode"
 *     @basic-sub-mode-change="handleBasicSubModeChange"
 *     @pro-sub-mode-change="handleProSubModeChange"
 *     @image-sub-mode-change="handleImageSubModeChange"
 *   />
 * </template>
 * ```
 */
import { NSpace } from 'naive-ui'
import FunctionModeSelector from '../FunctionModeSelector.vue'
import OptimizationModeSelectorUI from '../OptimizationModeSelector.vue'
import ImageModeSelector from '../image-mode/ImageModeSelector.vue'
import type { FunctionMode, BasicSubMode, ProSubMode, ImageSubMode } from '@prompt-optimizer/core'

// ========================
// Props 定义
// ========================
interface Props {
    /** 当前功能模式 */
    functionMode: FunctionMode
    /** 基础模式子模式 */
    basicSubMode: BasicSubMode
    /** 上下文模式子模式 */
    proSubMode: ProSubMode
    /** 图像模式子模式 */
    imageSubMode: ImageSubMode
}

defineProps<Props>()

// ========================
// Emits 定义
// ========================
const emit = defineEmits<{
    /** 更新功能模式 */
    'update:functionMode': [mode: FunctionMode]
    /** 基础模式子模式变更 */
    'basic-sub-mode-change': [mode: BasicSubMode]
    /** 上下文模式子模式变更 */
    'pro-sub-mode-change': [mode: ProSubMode]
    /** 图像模式子模式变更 */
    'image-sub-mode-change': [mode: ImageSubMode]
}>()
</script>
