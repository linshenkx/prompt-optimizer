<template>
    <!--
        App 头部操作按钮组件

        职责:
        - 核心功能按钮: 模板管理、历史记录、模型管理、收藏夹、数据管理
        - 辅助功能: 主题切换、GitHub 链接、语言切换、更新检查

        设计说明:
        - 从 App.vue 的 #actions slot 提取出来
        - 所有操作通过 emits 通知父组件处理
        - 保持与原实现完全一致的 UI 和行为
    -->
    <!-- 核心功能区 -->
    <ActionButtonUI
        icon="📝"
        :text="$t('nav.templates')"
        @click="emit('open-templates')"
        type="default"
        size="medium"
        :ghost="false"
        :round="true"
    />
    <ActionButtonUI
        icon="📜"
        :text="$t('nav.history')"
        @click="emit('open-history')"
        type="default"
        size="medium"
        :ghost="false"
        :round="true"
    />
    <ActionButtonUI
        icon="⚙️"
        :text="$t('nav.modelManager')"
        @click="emit('open-model-manager')"
        type="default"
        size="medium"
        :ghost="false"
        :round="true"
    />
    <ActionButtonUI
        icon="⭐"
        :text="$t('nav.favorites')"
        @click="emit('open-favorites')"
        type="default"
        size="medium"
        :ghost="false"
        :round="true"
    />
    <ActionButtonUI
        icon="💾"
        :text="$t('nav.dataManager')"
        @click="emit('open-data-manager')"
        type="default"
        size="medium"
        :ghost="false"
        :round="true"
    />
    <ActionButtonUI
        icon="🔣"
        :text="$t('nav.variableManager')"
        @click="emit('open-variables')"
        type="default"
        size="medium"
        :ghost="false"
        :round="true"
    />
    <!-- 辅助功能区 - 使用简化样式降低视觉权重 -->
    <ThemeToggleUI />
    <ActionButtonUI
        icon=""
        text=""
        @click="emit('open-github')"
        size="small"
        type="default"
        :ghost="true"
    >
        <template #icon>
            <svg
                class="w-4 h-4"
                viewBox="0 0 24 24"
                fill="currentColor"
            >
                <path
                    d="M12 0C5.374 0 0 5.373 0 12 0 17.302 3.438 21.8 8.207 23.387c.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"
                />
            </svg>
        </template>
    </ActionButtonUI>
    <LanguageSwitchDropdown />
    <!-- 自动更新组件 - 仅在Electron环境中显示 -->
    <UpdaterIcon />
</template>

<script setup lang="ts">
/**
 * App 头部操作按钮组件
 *
 * @description
 * 从 App.vue 提取出的头部操作按钮组件，用于 MainLayoutUI 的 #actions slot。
 * 包含核心功能按钮和辅助功能按钮两部分。
 *
 * @features
 * - 核心功能: 模板管理、历史记录、模型管理、收藏夹、数据管理
 * - 辅助功能: 主题切换、GitHub 链接、语言切换、更新检查
 * - 所有操作通过 emits 通知父组件
 *
 * @example
 * ```vue
 * <template #actions>
 *   <AppHeaderActions
 *     @open-templates="openTemplateManager"
 *     @open-history="historyManager.showHistory = true"
 *     @open-model-manager="modelManager.showConfig = true"
 *     @open-favorites="showFavoriteManager = true"
 *     @open-data-manager="showDataManager = true"
 *     @open-github="openGithubRepo"
 *   />
 * </template>
 * ```
 */
import ActionButtonUI from '../ActionButton.vue'
import ThemeToggleUI from '../ThemeToggleUI.vue'
import LanguageSwitchDropdown from '../LanguageSwitchDropdown.vue'
import UpdaterIcon from '../UpdaterIcon.vue'

// ========================
// Emits 定义
// ========================
const emit = defineEmits<{
    /** 打开模板管理器 */
    'open-templates': []
    /** 打开历史记录 */
    'open-history': []
    /** 打开模型管理器 */
    'open-model-manager': []
    /** 打开收藏夹 */
    'open-favorites': []
    /** 打开数据管理器 */
    'open-data-manager': []
    /** 打开变量管理器 */
    'open-variables': []
    /** 打开 GitHub 仓库 */
    'open-github': []
}>()
</script>
