<template>
    <!--
        App 核心导航组件

        职责:
        - 功能模式选择器 (Basic / Pro / Image)
        - 各模式的子模式选择器

        🔧 路由架构：直接使用 router.push 进行导航
        - 从路由参数计算当前模式
        - 导航操作直接调用 router.push
    -->
    <NSpace :size="12" align="center">
        <!-- 功能模式选择器 -->
        <FunctionModeSelector
            :modelValue="functionMode"
            @update:modelValue="handleFunctionModeChange"
        />

        <!-- 子模式选择器 - 基础模式 -->
        <OptimizationModeSelectorUI
            v-if="functionMode === 'basic'"
            :modelValue="basicSubMode"
            functionMode="basic"
            @change="handleBasicSubModeChange"
        />

        <!-- 子模式选择器 - 上下文模式 -->
        <OptimizationModeSelectorUI
            v-if="functionMode === 'pro'"
            :modelValue="proSubMode"
            functionMode="pro"
            @change="handleProSubModeChange"
        />

        <!-- 子模式选择器 - 图像模式 -->
        <ImageModeSelector
            v-if="functionMode === 'image'"
            :modelValue="imageSubMode"
            @change="handleImageSubModeChange"
        />
    </NSpace>
</template>

<script setup lang="ts">
/**
 * App 核心导航组件
 *
 * @description
 * 用于 MainLayoutUI 的 #core-nav slot。
 * 包含功能模式选择器和各模式的子模式选择器。
 *
 * @features
 * - 功能模式切换: Basic / Pro / Image
 * - 基础模式子模式: system / user
 * - 上下文模式子模式: system / user
 * - 图像模式子模式: text2image / image2image
 *
 * 🔧 路由架构：直接使用 router.push 进行导航
 */
import { computed } from 'vue'
import { router as routerInstance } from '../../router'
import { NSpace } from 'naive-ui'
import FunctionModeSelector from '../FunctionModeSelector.vue'
import OptimizationModeSelectorUI from '../OptimizationModeSelector.vue'
import ImageModeSelector from '../image-mode/ImageModeSelector.vue'
import type { FunctionMode, BasicSubMode, ProSubMode, ImageSubMode } from '@prompt-optimizer/core'

// ========================
// Router（使用 router 单例，避免注入失败/多实例）
// ========================
// 从当前路由计算模式
const functionMode = computed<FunctionMode>(() => {
    const path = routerInstance.currentRoute.value.path
    if (path.startsWith('/basic')) return 'basic'
    if (path.startsWith('/pro')) return 'pro'
    if (path.startsWith('/image')) return 'image'
    return 'basic' // 默认
})

const basicSubMode = computed<BasicSubMode>(() => {
    const rawSubMode = routerInstance.currentRoute.value.path.split('/')[2]

    // ✅ 静态路由映射：system 或 user
    if (rawSubMode === 'system' || rawSubMode === 'user') {
        return rawSubMode as BasicSubMode
    }

    return 'system' // 默认值
})

const proSubMode = computed<ProSubMode>(() => {
    const rawSubMode = routerInstance.currentRoute.value.path.split('/')[2]

    // ✅ 映射：兼容旧命名 'multi' -> 'system', 'variable' -> 'user'
    if (rawSubMode === 'multi') return 'system'
    if (rawSubMode === 'variable') return 'user'

    // 标准值或默认值
    return (rawSubMode as ProSubMode) || 'system'
})

const imageSubMode = computed<ImageSubMode>(() => {
    const rawSubMode = routerInstance.currentRoute.value.path.split('/')[2]

    // ✅ 静态路由映射：text2image 或 image2image
    if (rawSubMode === 'text2image' || rawSubMode === 'image2image') {
        return rawSubMode as ImageSubMode
    }

    return 'text2image' // 默认值
})

// ========================
// 导航处理
// ========================
// 🔧 各模式的默认子模式（避免跨模式污染）
const DEFAULT_SUB_MODES = {
    basic: 'system',
    pro: 'system',
    image: 'text2image'
} as const

const handleFunctionModeChange = (mode: FunctionMode) => {
    // 切换 functionMode 时使用默认 subMode，避免跨模式污染
    // 例如：从 /image/text2image 切到 pro，不应使用 text2image（非法）
    const defaultSubMode = DEFAULT_SUB_MODES[mode]
    routerInstance.push(`/${mode}/${defaultSubMode}`)
}

const handleBasicSubModeChange = (mode: BasicSubMode) => {
    routerInstance.push(`/basic/${mode}`)
}

const handleProSubModeChange = (mode: ProSubMode) => {
    routerInstance.push(`/pro/${mode}`)
}

const handleImageSubModeChange = (mode: ImageSubMode) => {
    routerInstance.push(`/image/${mode}`)
}
</script>
