<template>
    <!--
        Web App 入口组件

        职责:
        - 作为 web 应用的入口点
        - 渲染 PromptOptimizerApp 主组件

        说明:
        - 所有核心逻辑已迁移至 @prompt-optimizer/ui 的 PromptOptimizerApp
        - 此文件仅作为应用壳，减少代码重复
    -->
    <div class="web-workspace" :inert="updateLocked || undefined" :aria-busy="updateLocked">
        <PromptOptimizerApp ref="workspace" />
    </div>
    <PwaControls :prepare-for-update="prepareForUpdate" @update-lock="updateLocked = $event" />
</template>

<script setup lang="ts">
/**
 * Web App 入口组件
 *
 * @description
 * 轻量级入口组件，渲染 PromptOptimizerApp 主应用。
 * 所有业务逻辑、状态管理和事件处理均在 PromptOptimizerApp 中实现。
 */
import { PromptOptimizerApp } from "@prompt-optimizer/ui";
import { ref } from 'vue';
import PwaControls from './pwa/PwaControls.vue';
import type { WorkspaceUpdateHost, UpdatePreparation } from './pwa/update';

const workspace = ref<WorkspaceUpdateHost | null>(null);
const updateLocked = ref(false);
const prepareForUpdate = async (): Promise<UpdatePreparation> =>
    workspace.value?.prepareForUpdate?.() ?? 'save-failed';
</script>

<style scoped>
/* Preserve the shared UI's layout while providing an inert boundary during updates. */
.web-workspace { display: contents; }
</style>
