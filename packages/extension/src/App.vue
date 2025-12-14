<template>
    <!--
        Extension App 入口组件

        职责:
        - 作为 Chrome 扩展应用的入口点
        - 渲染 PromptOptimizerApp 主组件

        说明:
        - 所有核心逻辑已迁移至 @prompt-optimizer/ui 的 PromptOptimizerApp
        - 此文件仅作为应用壳，减少代码重复
    -->
    <PromptOptimizerApp />
</template>

<script setup lang="ts">
/**
 * Extension App 入口组件
 *
 * @description
 * 轻量级入口组件，渲染 PromptOptimizerApp 主应用。
 * 所有业务逻辑、状态管理和事件处理均在 PromptOptimizerApp 中实现。
 */
import { PromptOptimizerApp } from "@prompt-optimizer/ui";
</script>
