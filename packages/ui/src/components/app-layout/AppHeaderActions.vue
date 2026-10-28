<template>
    <!--
        App 头部操作按钮组件

        职责:
        - 核心功能按钮: 模板管理、历史记录、模型管理、收藏夹、数据管理
        - 辅助功能: 主题切换、GitHub 链接、语言切换、更新检查

        设计说明:
        - 从 App.vue 的 #actions slot 提取出来
        - 所有操作通过 emits 通知父组件处理
        - 收藏夹是页面型目的地，其余管理入口保持弹窗型交互
    -->
    <!-- 页面型管理入口：会接管主内容区 -->
    <div class="page-destination-group" data-testid="header-page-destinations">
        <ActionButtonUI
            icon="⭐"
            :text="$t('nav.favorites')"
            @click="emit('open-favorites')"
            :type="favoritesActive ? 'primary' : 'default'"
            data-testid="header-favorites-page-action"
            size="medium"
            :ghost="false"
            :round="true"
            :title="$t('favorites.page.title')"
            :aria-current="favoritesActive ? 'page' : undefined"
            :class="{ 'page-destination-active': favoritesActive }"
        />
    </div>

    <!-- 弹窗型管理/配置入口 -->
    <div class="modal-action-group" data-testid="header-modal-actions">
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
        <NBadge :show="backupReminderDue" dot processing>
            <ActionButtonUI
                icon="💾"
                :text="$t('nav.dataManager')"
                @click="emit('open-data-manager')"
                :type="backupReminderDue ? 'warning' : 'default'"
                size="medium"
                :ghost="false"
                :round="true"
                :title="backupReminderDue ? $t('dataManager.backupReminder.tooltip') : $t('nav.dataManager')"
            />
        </NBadge>
        <ActionButtonUI
            icon="🔣"
            :text="$t('nav.variableManager')"
            @click="emit('open-variables')"
            type="default"
            size="medium"
            :ghost="false"
            :round="true"
        />
    </div>
    <!-- 辅助功能区 - 使用简化样式降低视觉权重 -->
    <ThemeToggleUI />
    <div class="aux-icon-group">
        <NButton
            quaternary
            circle
            size="small"
            class="aux-icon-button"
            :title="$t('updater.viewOnGitHub')"
            @click="emit('open-github')"
        >
            <template #icon>
                <GitHubIcon class="w-4 h-4" size="1em" />
            </template>
        </NButton>
        <NPopover
            v-model:show="showAboutPopover"
            trigger="click"
            placement="bottom-end"
            :show-arrow="false"
        >
            <template #trigger>
                <NButton
                    quaternary
                    circle
                    size="small"
                    class="aux-icon-button"
                    :title="$t('nav.about')"
                >
                    <template #icon>
                        <UiInfo />
                    </template>
                </NButton>
            </template>

            <div class="about-panel">
                <div class="about-panel-header">
                    <NTag round size="small" class="about-version-tag">{{ appVersion }}</NTag>
                </div>

                <NButton quaternary block class="about-link-button" @click="handleOpenWebsite">
                    <span class="about-link-copy">
                        <span class="about-link-label">{{ $t('about.website') }}</span>
                        <span class="about-link-value">{{ $t('about.websiteLabel') }}</span>
                    </span>
                    <UiArrowUpRight class="about-link-icon" aria-hidden="true" />
                </NButton>

                <NButton quaternary block class="about-link-button" @click="handleOpenDocs">
                    <span class="about-link-copy">
                        <span class="about-link-label">{{ $t('about.documentation') }}</span>
                        <span class="about-link-value">{{ $t('about.documentationLabel') }}</span>
                    </span>
                    <UiArrowUpRight class="about-link-icon" aria-hidden="true" />
                </NButton>
            </div>
        </NPopover>
        <LanguageSwitchDropdown />
        <!-- 自动更新组件 - 仅在Electron环境中显示 -->
        <UpdaterIcon />
    </div>
</template>

<script setup lang="ts">
import { Info as UiInfo, ArrowUpRight as UiArrowUpRight } from '@lucide/vue'
import GitHubIcon from '../icons/GitHubIcon.vue'
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
 *     @open-favorites="openFavoritesPage"
 *     @open-data-manager="showDataManager = true"
 *     :app-version="appVersion"
 *     @open-website="openOfficialWebsite"
 *     @open-docs="openDocumentationSite"
 *     @open-github="openGithubRepo"
 *   />
 * </template>
 * ```
 */
import { ref } from 'vue'

import ActionButtonUI from '../ActionButton.vue'
import ThemeToggleUI from '../ThemeToggleUI.vue'
import LanguageSwitchDropdown from '../LanguageSwitchDropdown.vue'
import UpdaterIcon from '../UpdaterIcon.vue'
import { NBadge, NButton, NPopover, NTag } from 'naive-ui'

interface Props {
    appVersion: string
    favoritesActive?: boolean
    backupReminderDue?: boolean
}

withDefaults(defineProps<Props>(), {
    favoritesActive: false,
    backupReminderDue: false,
})

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
    /** 打开官网 */
    'open-website': []
    /** 打开文档站 */
    'open-docs': []
    /** 打开 GitHub 仓库 */
    'open-github': []
}>()

const showAboutPopover = ref(false)

const handleOpenWebsite = () => {
    showAboutPopover.value = false
    emit('open-website')
}

const handleOpenDocs = () => {
    showAboutPopover.value = false
    emit('open-docs')
}
</script>

<style scoped>
.aux-icon-button {
    width: 30px;
    height: 30px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: transform 0.2s ease;
}

.aux-icon-button:hover {
    transform: translateY(-1px);
}

.aux-icon-group {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-left: 6px;
}

.page-destination-group,
.modal-action-group {
    display: inline-flex;
    align-items: center;
    gap: 8px;
}

.page-destination-group {
    padding-right: 8px;
    border-right: 1px solid var(--n-border-color);
}

.page-destination-active {
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--n-primary-color) 18%, transparent);
}

.about-panel {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 220px;
    max-width: 260px;
}

.about-panel-header {
    display: flex;
    justify-content: flex-end;
}

.about-version-tag {
    max-width: 100%;
}

.about-link-button {
    width: 100%;
    justify-content: space-between;
    gap: 12px;
}

.about-link-copy {
    display: inline-flex;
    align-items: baseline;
    gap: 8px;
    min-width: 0;
    text-align: left;
}

.about-link-label {
    flex-shrink: 0;
    font-size: 11px;
    color: var(--n-text-color-3);
}

.about-link-value {
    min-width: 0;
    font-size: 12px;
    font-weight: 600;
    color: var(--n-text-color-2);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.about-link-icon {
    width: 12px;
    height: 12px;
    flex-shrink: 0;
    color: var(--n-text-color-3);
}
</style>
