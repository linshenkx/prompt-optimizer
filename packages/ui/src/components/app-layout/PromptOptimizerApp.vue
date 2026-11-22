<template>
    <!--
        PromptOptimizerApp - 主应用组件

        职责:
        - 提供完整的 Prompt Optimizer 应用功能
        - 统一 web 和 extension 应用的核心逻辑
        - 管理所有状态、composables 和事件处理

        设计说明:
        - 从 App.vue 提取的核心逻辑
        - 减少 web/extension 应用的重复代码
    -->
    <NConfigProvider
        :theme="naiveTheme"
        :theme-overrides="themeOverrides"
        :style="isCompact ? { '--compact-accent': themeOverrides.common?.primaryColor } : undefined"
        :hljs="hljsInstance"
    >
        <div v-if="isInitializing" class="loading-container">
            <NSpin size="medium" />
            <NText depth="2">{{ t("log.info.initializing") }}</NText>
        </div>
        <div v-else-if="!services" class="loading-container error">
            <NResult status="error" :title="t('toast.error.appInitFailed')" />
        </div>
        <div v-else-if="!isReady" class="loading-container">
            <NSpin size="medium" />
            <NText depth="2">{{ t("log.info.initializing") }}</NText>
        </div>
        <template v-else>
            <MainLayoutUI>
                <template #mobile-nav>
                    <CompactNavigation
                        :workspace-path="activeWorkspaceContextPath"
                        :app-version="appVersion"
                        :backup-reminder-due="dataBackupReminderDue"
                        @action="handleMobileAction"
                    />
                </template>
                <!-- Title Slot -->
                <template #title>
                    {{ t("promptOptimizer.title") }}
                </template>

                <!-- Core Navigation Slot -->
                <template #core-nav>
                    <AppCoreNav
                        :workspace-path="activeWorkspaceContextPath"
                        :allow-workspace-reselect="isFavoritesRoute"
                    />
                </template>

                <!-- Actions Slot -->
                <template #actions>
                    <AppHeaderActions
                        @open-templates="openTemplateManager"
                        @open-history="historyManager.showHistory = true"
                        @open-model-manager="modelManager.showConfig = true"
                        @open-favorites="openFavoritesPage"
                        @open-data-manager="showDataManager = true"
                        @open-variables="handleOpenVariableManager()"
                        :favorites-active="isFavoritesRoute"
                        :backup-reminder-due="dataBackupReminderDue"
                        :app-version="appVersion"
                        @open-website="openOfficialWebsite"
                        @open-docs="openDocumentationSite"
                        @open-github="openGithubRepo"
                    />
                </template>
                <template #main>
                    <NAlert v-if="saveFailure" class="workspace-save-warning" type="warning" data-testid="workspace-save-warning">
                        {{ t(saveFailure[1] === 'conflict' ? 'workspace.sessionConflict' : 'workspace.sessionSaveFailed') }}
                        <NButton v-if="saveFailure[1] === 'failed'" size="tiny" :loading="sessionManager.isSaving"
                            @click="sessionManager.flushSubModeSession(saveFailure[0])">
                            {{ t('common.retry') }}
                        </NButton>
                    </NAlert>
                    <!-- 🔧 路由架构：使用 RouterView 自动渲染对应的工作区容器 -->
                    <!-- - /basic/system → BasicSystemWorkspace -->
                    <!-- - /basic/user → BasicUserWorkspace -->
                    <!-- - /pro/multi → ContextSystemWorkspace -->
                    <!-- - /pro/variable → ContextUserWorkspace -->
                    <!-- - /image/text2image → ImageText2ImageWorkspace -->
                    <!-- - /image/image2image → ImageImage2ImageWorkspace -->
                    <RouterView v-slot="{ Component, route: viewRoute }">
                        <component
                            :is="Component"
                            :key="viewRoute.fullPath"
                            :ref="(instance: unknown) => setWorkspaceRef(instance, viewRoute.name)"
                        />
                    </RouterView>
                </template>
            </MainLayoutUI>

            <!-- Modals and Drawers that are conditionally rendered -->
            <ModelManagerUI
                ref="modelManagerDialogRef"
                v-if="isReady"
                v-model:show="modelManager.showConfig"
                @models-updated="handleTextModelsUpdated"
                @update:show="
                    (v: boolean) => {
                        if (!v) handleModelManagerClosed();
                    }
                "
            />
            <TemplateManagerUI
                v-if="isReady"
                v-model:show="templateManagerState.showTemplates"
                :template-type="templateManagerState.currentType"
                :basic-sub-mode="routeBasicSubMode"
                :pro-sub-mode="routeProSubMode"
                :image-sub-mode="routeImageSubMode"
                @select="handleTemplateSelected"
                @close="handleTemplateManagerClosed"
                @language-changed="handleTemplateLanguageChanged"
            />
            <HistoryDrawerUI
                v-if="isReady"
                v-model:show="historyManager.showHistory"
                :history="promptHistory.history"
                @reuse="handleHistoryReuse"
                @clear="promptHistory.handleClearHistory"
                @deleteChain="promptHistory.handleDeleteChain"
            />
            <DataManagerUI
                v-if="isReady"
                v-model:show="showDataManager"
                :import-code="incomingBackupImportCode"
                :prepare-restore="prepareSessionRestore"
                @import-code-consumed="incomingBackupImportCode = ''"
                @imported="handleDataImported"
            />

            <!-- 收藏管理对话框 -->
            <FavoriteManagerUI
                v-if="isReady"
                :show="showFavoriteManager"
                :use-favorite="handleUseFavorite"
                @update:show="
                    (v: boolean) => {
                        if (!v) showFavoriteManager = false;
                    }
                "
            />

            <!-- 保存收藏对话框 -->
            <SaveFavoriteDialog
                v-if="isReady"
                v-model:show="showSaveFavoriteDialog"
                :content="saveFavoriteData?.content || ''"
                :original-content="saveFavoriteData?.originalContent || ''"
                :prefill="saveFavoriteData?.prefill"
                :candidate-source="saveFavoriteData?.candidateSource"
                :current-function-mode="routeFunctionMode"
                :current-optimization-mode="selectedOptimizationMode"
                @saved="handleSaveFavoriteComplete"
            />

            <!-- 变量管理弹窗 -->
            <VariableManagerModal
                v-if="isReady"
                v-model:visible="showVariableManager"
                :variable-manager="variableManager"
                :focus-variable="focusVariableName"
            />

            <!-- 工具管理弹窗 -->
            <ToolManagerModal
                v-if="isReady"
                v-model:visible="showToolManager"
                :tools="optimizationContextTools"
                @confirm="handleToolManagerConfirm"
                @cancel="showToolManager = false"
            />

            <!-- 上下文编辑器弹窗 -->
            <ContextEditor
                v-if="isReady"
                v-model:visible="showContextEditor"
                :state="contextEditorState"
                :services="servicesForContextEditor"
                :variable-manager="variableManager"
                :optimization-mode="selectedOptimizationMode"
                :scan-variables="
                    (content) =>
                        variableManager?.variableManager.value?.scanVariablesInContent(
                            content,
                        ) || []
                "
                :replace-variables="
                    (content, vars) =>
                        variableManager?.variableManager.value?.replaceVariables(
                            content,
                            vars,
                        ) || content
                "
                :isPredefinedVariable="
                    (name) =>
                        variableManager?.variableManager.value?.isPredefinedVariable(
                            name,
                        ) || false
                "
                :defaultTab="contextEditorDefaultTab"
                :only-show-tab="contextEditorOnlyShowTab"
                :title="contextEditorTitle"
                @update:state="handleContextEditorStateUpdateSafe"
                @save="handleContextEditorSaveSafe"
                @cancel="handleContextEditorCancel"
                @open-variable-manager="handleOpenVariableManager"
            />

            <!-- 提示词预览面板 -->
            <PromptPreviewPanel
                v-if="isReady"
                :show="showPreviewPanel"
                @update:show="showPreviewPanel = $event"
                :previewContent="promptPreview.previewContent.value"
                :missingVariables="promptPreview.missingVariables.value"
                :hasMissingVariables="promptPreview.hasMissingVariables.value"
                :variableStats="promptPreview.variableStats.value"
                :contextMode="contextMode"
                :renderPhase="renderPhase"
            />

            <!-- 关键:使用NGlobalStyle同步全局样式到body,消除CSS依赖 -->
            <NGlobalStyle />
        </template>
    </NConfigProvider>
</template>

<script setup lang="ts">
import { useArenaSession } from '../../stores/session/useArenaSession';
/**
 * PromptOptimizerApp - 主应用组件
 *
 * @description
 * 从 App.vue 提取的核心应用逻辑，统一 web 和 extension 应用。
 * 包含所有状态管理、composables 和事件处理。
 */
import {
    ref,
    watch,
    watchEffect,
    provide,
    computed,
    shallowRef,
    onMounted,
    onBeforeUnmount,
    nextTick,
} from "vue";
import { RouterView } from "vue-router";
import { setLucideProps } from '@lucide/vue';
import { APP_ICON_DEFAULTS } from '../../config/icons';

setLucideProps(APP_ICON_DEFAULTS);
import { router as routerInstance } from '../../router';
import {
    DEFAULT_WORKSPACE_PATH,
    WORKSPACE_SUB_MODE_KEYS,
    normalizeWorkspacePath,
    parseWorkspaceRoutePath,
    resolveWorkspacePathFallback,
} from '../../router/workspaceRoutes';
import { createExternalDataLoadingGate } from '../../utils/external-data-loading'
import { openExternalUrl } from '../../utils/open-external-url'
import { registerOptionalIntegrations } from '../../integrations/registerOptionalIntegrations';
import { useI18n } from "vue-i18n";
import {
    NAlert,
    NButton,
    NConfigProvider,
    NGlobalStyle,
    NResult,
    NSpin,
    NText,
} from "naive-ui";
import hljs from "highlight.js/lib/core";
import jsonLang from "highlight.js/lib/languages/json";
hljs.registerLanguage("json", jsonLang);

// 内部组件导入
import MainLayoutUI from '../MainLayout.vue'
import CompactNavigation from './CompactNavigation.vue'
import { useWorkspaceViewState } from '../../composables/ui/useWorkspaceViewState'
import { useWorkspaceLayout } from '../../composables/ui/useWorkspaceLayout'
import { hasCompactModalLayers } from '../../composables/ui/useCompactModalBack'
import { hasSessionConflicts } from '../../stores/session/sessionPersistence'
import { createAppUpdatePreparation } from '../../composables/ui/useAppUpdatePreparation'
import { useSessionAutosave } from '../../composables/session/useSessionAutosave'
const { isCompact, keyboardViewportHeight, keyboardViewportTop } = useWorkspaceLayout()
import '../../styles/compact-workspace.css'

import ModelManagerUI from '../ModelManager.vue'
import TemplateManagerUI from '../TemplateManager.vue'
import HistoryDrawerUI from '../HistoryDrawer.vue'
import DataManagerUI from '../DataManager.vue'
import { BACKUP_IMPORT_QUERY_KEY } from '../../utils/remote-backup-import-code'
import FavoriteManagerUI from '../FavoriteManager.vue'
import SaveFavoriteDialog from '../SaveFavoriteDialog.vue'
import VariableManagerModal from '../variable/VariableManagerModal.vue'
import ToolManagerModal from '../tool/ToolManagerModal.vue'
import ContextEditor from '../context-mode/ContextEditor.vue'
import PromptPreviewPanel from '../PromptPreviewPanel.vue'
import AppHeaderActions from './AppHeaderActions.vue'
import AppCoreNav from './AppCoreNav.vue'
import { createWorkspaceRouteSwitchController } from './workspaceRouteSwitch'
import { favoritesPageActionsKey } from '../favorites/favorites-page-context'
import rootPackageJson from '../../../../../package.json'

// Composables - 使用 barrel exports
import {
    // 提示词相关
    usePromptOptimizer,
    usePromptHistory,
    usePromptPreview,
    // 模型相关
    useModelManager,
    useModelSelectRefs,
    useFunctionModelManager,
    // 模式相关
    useFunctionMode,
    useBasicSubMode,
    useProSubMode,
    useImageSubMode,
    // 上下文相关
    useContextManagement,
    useContextEditorUIState,
    // 变量相关
    useVariableManager,
    useAggregatedVariables,
    // UI 相关
    useToast,
    useConfirmDialog,
    useNaiveTheme,
     // 系统相关
     useAppInitializer,
     useTemplateManager,
     // App 级别
     useAppHistoryRestore,
     useAppFavorite,
} from '../../composables'

// i18n functions
import { initializeI18nWithStorage, setI18nServices } from '../../plugins/i18n'

// Pinia functions
import { setPiniaServices, getPiniaServices } from '../../plugins/pinia'
import { parseSubModeKey } from '../../router/guards'
// ⚠️ Codex 建议：改用直接路径导入，避免 barrel exports 循环依赖导致 TDZ
import { useSessionManager, type SubModeKey } from '../../stores/session/useSessionManager'
import { useBasicSystemSession } from '../../stores/session/useBasicSystemSession'
import { useBasicUserSession } from '../../stores/session/useBasicUserSession'
import { useProMultiMessageSession } from '../../stores/session/useProMultiMessageSession'
import { useProVariableSession } from '../../stores/session/useProVariableSession'
import { useSessionRestoreCoordinator } from '../../composables/session/useSessionRestoreCoordinator'
import { useImageText2ImageSession } from '../../stores/session/useImageText2ImageSession'
import { useImageImage2ImageSession } from '../../stores/session/useImageImage2ImageSession'
import { useImageMultiImageSession } from '../../stores/session/useImageMultiImageSession'
import { useGlobalSettings } from '../../stores/settings/useGlobalSettings'

import type { TemplateManagerTemplateType } from '../../composables/prompt/useTemplateManager'

// Data Transformation
import { DataTransformer } from '../../utils/data-transformer'
import { getProviderDisplayName, getTextModelConfigDisplayName } from '../../utils/provider-display'
import {
  DATA_BACKUP_STATUS_EVENT,
  isDataBackupReminderDue,
} from '../../utils/data-backup-reminder'

// Types
import type { ModelSelectOption, TestAreaPanelInstance } from '../../types'
import { type IPromptService, type PromptAssetBinding, type PromptSessionOrigin, type PromptRecordChain, type PatchOperation, type Template, type TemplateType, type FunctionMode, type BasicSubMode, type ProSubMode, type ImageSubMode, type OptimizationMode, type ConversationMessage, type ToolDefinition, type ContextEditorState, type ContextMode, type FavoritePrompt } from "@prompt-optimizer/core";

// 1. 基础 composables
const hljsInstance = hljs;
const i18n = useI18n();
 
const t = i18n.t;  // 在模板中使用
const toast = useToast();
const confirmDialog = useConfirmDialog();

// ========= Chunk-load failure recovery =========
// A long-lived tab can keep running an old main bundle after a new deployment.
// Its dynamic-import chunk URLs (hashed) may no longer exist and get rewritten to index.html,
// which fails strict MIME checks and breaks route-based lazy loading.
// We prompt users to refresh (one-time) instead of auto-reloading.
const CHUNK_LOAD_REFRESH_GUARD_KEY = 'prompt-optimizer:chunk-load-refresh-prompted';

const getUnknownErrorMessage = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  return String(err);
};

const isChunkLoadFailure = (err: unknown): boolean => {
  const msg = getUnknownErrorMessage(err).toLowerCase();
  return (
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('chunkloaderror') ||
    msg.includes('loading chunk') ||
    msg.includes('strict mime type') ||
    msg.includes('expected a javascript-or-wasm module script')
  );
};

let removeRouterErrorHandler: (() => void) | null = null;

const promptRefreshForNewDeploy = async (reason: unknown) => {
  if (typeof window === 'undefined') return;

  try {
    if (window.sessionStorage.getItem(CHUNK_LOAD_REFRESH_GUARD_KEY)) {
      return;
    }
    window.sessionStorage.setItem(CHUNK_LOAD_REFRESH_GUARD_KEY, '1');

    const ok = await confirmDialog.warning({
      title: t('common.warning'),
      content: t('toast.warning.chunkLoadRefreshConfirm'),
      positiveText: t('common.confirm'),
      negativeText: t('common.cancel'),
    });
    if (!ok) {
      toast.warning(t('toast.warning.chunkLoadRefreshDeclined'), 8000);
      return;
    }

    const checkpoint = !isReady.value && !sessionManager.hasUnsavedSessions ? 'ready' : await prepareForUpdate();
    if (checkpoint !== 'ready') {
      console.warn('[PromptOptimizerApp] Refresh deferred by application checkpoint:', checkpoint);
      window.sessionStorage.removeItem(CHUNK_LOAD_REFRESH_GUARD_KEY);
      toast.warning(t('toast.warning.chunkLoadRefreshDeclined'), 8000);
      return;
    }

    window.location.reload();
  } catch (e) {
    console.error('[PromptOptimizerApp] refresh prompt failed:', e, reason);
  }
};

const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
  if (!isChunkLoadFailure(event.reason)) return;
  void promptRefreshForNewDeploy(event.reason);
};

// 2. 初始化应用服务
const { services, isInitializing, startupRepairReport } = useAppInitializer();

const hasShownStartupRepairToast = ref(false)

watch(
  [isInitializing, startupRepairReport],
  ([initializing, report]) => {
    if (initializing || !report || hasShownStartupRepairToast.value) {
      return
    }

    if (!Array.isArray(report.actions) || report.actions.length === 0) {
      return
    }

    hasShownStartupRepairToast.value = true
    toast.warning(t('toast.warning.startupRepair', { count: report.actions.length }))
  },
  { immediate: true },
)

// 3. 初始化功能模式和子模式（必须在 sessionManager 之前）
//
// ⚠️ 重要：这些 composable 仅用于一次性初始化（ensureInitialized），不得作为状态来源！
// 🔧 Step E 完成：所有模式/子模式的读取已统一使用 route-computed（routeFunctionMode/route*SubMode）
// 🔴 禁止事项：
//   - 严禁在业务逻辑中读取 functionMode/basicSubMode/proSubMode/imageSubMode 的 .value
//   - 严禁使用这些 composable 的 set* 方法（已被 navigateToSubModeKey 替代）
//   - 严禁基于这些 state 注册新的 watch（路由是唯一真源）
// ✅ 允许用途：
//   - 仅在 services ready watch 中调用 ensureInitialized 进行一次性初始化
//   - 确保 PreferenceService 中的历史偏好能够加载（但不影响路由驱动的行为）
//
// TODO（后续重构）：将 ensureInitialized 拆为纯 initModePreferences() 函数，完全移除这些 composable 的依赖
// ⚠️ 注意：这些 composable 的调用会触发初始化副作用，但返回的 state 不得作为业务逻辑的状态来源
// 🔧 修复：保存 composable 返回值，避免在 watch 回调中重复调用（导致 inject() 错误）
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const functionModeApi = useFunctionMode(services);
 
const basicSubModeApi = useBasicSubMode(services);
 
const proSubModeApi = useProSubMode(services);
 
const imageSubModeApi = useImageSubMode(services);

// 3.5. 🔧 Step A: 建立路由驱动的单一真源（优先于 state，避免双真源）
//
// ⚠️ 注意：PromptOptimizerApp 不在 RouterView 上下文中，无法使用 useRoute/useRouter
// 解决方案：直接导入 router 实例，使用 currentRoute 访问路由状态
// ⚠️ 重要：computed 只做纯解析，纠错逻辑移到独立的 watch（避免循环导航）
//
const getWorkspacePathFromGlobalSettings = () => {
  const globalSettings = useGlobalSettings()
  const { functionMode, basicSubMode, proSubMode, imageSubMode } = globalSettings.state
  if (functionMode === 'arena') return '/arena'
  if (functionMode === 'image') return normalizeWorkspacePath(`/image/${imageSubMode}`)
  if (functionMode === 'pro') return normalizeWorkspacePath(`/pro/${proSubMode}`)
  return normalizeWorkspacePath(`/basic/${basicSubMode}`)
}

const getCurrentRouteFromWorkspaceQuery = () =>
  normalizeWorkspacePath(routerInstance.currentRoute.value.query.from)

const lastWorkspacePath = ref<string | null>(
  normalizeWorkspacePath(routerInstance.currentRoute.value.path)
  ?? getCurrentRouteFromWorkspaceQuery()
)

const isFavoritesRoute = computed(() => routerInstance.currentRoute.value.path === '/favorites')

watch(
  () => routerInstance.currentRoute.value.fullPath,
  () => {
    const currentWorkspacePath = normalizeWorkspacePath(routerInstance.currentRoute.value.path)
    if (currentWorkspacePath) {
      lastWorkspacePath.value = currentWorkspacePath
      return
    }

    if (isFavoritesRoute.value) {
      const fromPath = getCurrentRouteFromWorkspaceQuery()
      if (fromPath) {
        lastWorkspacePath.value = fromPath
      }
    }
  },
  { immediate: true },
)

const activeWorkspaceContextPath = computed(() =>
  resolveWorkspacePathFallback(
    routerInstance.currentRoute.value.path,
    lastWorkspacePath.value,
    () => getWorkspacePathFromGlobalSettings(),
  ),
)

// 纯解析函数：从工作区路径提取模式和子模式；收藏页等非工作区路径沿用最近工作区上下文
const parseRouteInfo = (path = activeWorkspaceContextPath.value) => {
  const workspaceRoute = parseWorkspaceRoutePath(path) ?? parseWorkspaceRoutePath(DEFAULT_WORKSPACE_PATH)!
  const functionMode = workspaceRoute.mode
  const subMode = workspaceRoute.subMode

  return {
    functionMode,
    basicSubMode:
      (functionMode === 'basic' ? subMode : 'system') as 'system' | 'user',
    proSubMode:
      (functionMode === 'pro' ? subMode : 'variable') as 'multi' | 'variable',
    imageSubMode:
      (functionMode === 'image' ? subMode : 'text2image') as 'text2image' | 'image2image' | 'multiimage',
    isValid: true,
    canonicalPath: workspaceRoute.path,
  }
}

// Route-computed（纯解析，无副作用）
const routeFunctionMode = computed<FunctionMode>(() => parseRouteInfo().functionMode)
const routeBasicSubMode = computed<BasicSubMode>(() => parseRouteInfo().basicSubMode)
const routeProSubMode = computed<ProSubMode>(() => parseRouteInfo().proSubMode)
const routeImageSubMode = computed<ImageSubMode>(() => parseRouteInfo().imageSubMode)

// ========== GlobalSettings 初始化 Gate（避免 restore 前渲染/纠错） ==========
// 目的：确保 PreferenceService 注入后先 restoreGlobalSettings，再允许 UI 渲染/执行部分 watch
let _routeInitInFlight: Promise<void> | null = null
const routeInitialized = ref(false)  // 🔧 标记路由初始化完成，防止过早渲染

// 🔧 路由纠错 watch：不再负责重定向（仅用于解析/同步路由信息）
// - 非根路径的“纠错/兼容重定向”由路由守卫（beforeRouteSwitch）处理
// - 根路径（/）的初始工作区跳转由 RootBootstrapRoute 处理
watch(
  () => routerInstance.currentRoute.value.path,
  (currentPath) => {
    // 根路径（/）由 RootBootstrapRoute 负责等待 globalSettings 初始化后跳转，不在此处纠错
    if (currentPath === '/' || currentPath === '') return

    // ✅ 路由初始化完成前不进行纠错，避免干扰初始化过程
    if (!routeInitialized.value) return

    parseRouteInfo()
  },
  { immediate: true }  // 立即检查一次
)

// ========== 路由 ⇢ GlobalSettings（仅记录，不反向驱动路由） ==========
watch(
  () => routerInstance.currentRoute.value.path,
  (currentPath) => {
    const globalSettings = useGlobalSettings()
    if (!globalSettings.hasRestored) return
    if (!parseWorkspaceRoutePath(currentPath)) return

    const routeInfo = parseRouteInfo()

    if (routeInfo.functionMode !== globalSettings.state.functionMode) {
      globalSettings.updateFunctionMode(routeInfo.functionMode)
    }

    // 子模式隔离：只更新“当前功能模式”对应的 subMode
    if (routeInfo.functionMode === 'basic' && routeInfo.basicSubMode !== globalSettings.state.basicSubMode) {
      globalSettings.updateBasicSubMode(routeInfo.basicSubMode)
    }
    if (routeInfo.functionMode === 'pro' && routeInfo.proSubMode !== globalSettings.state.proSubMode) {
      globalSettings.updateProSubMode(routeInfo.proSubMode)
    }
    if (routeInfo.functionMode === 'image' && routeInfo.imageSubMode !== globalSettings.state.imageSubMode) {
      globalSettings.updateImageSubMode(routeInfo.imageSubMode)
    }
  }
)

// 4. 初始化 SessionManager（必须在 services watch 之前）
const sessionManager = useSessionManager();

// 🔧 Step B: 注入 route-computed 读取器（替代旧 state，避免双真源）
sessionManager.injectSubModeReaders({
  getFunctionMode: () => routeFunctionMode.value,
  getBasicSubMode: () => routeBasicSubMode.value,
  getProSubMode: () => routeProSubMode.value,
  getImageSubMode: () => routeImageSubMode.value,
});

// 5. Initialize i18n with storage when services are ready
watch(
    services,
        async (newServices) => {
            if (newServices) {
                setI18nServices(newServices);
                setPiniaServices(newServices);
                // Phase 1：恢复全局配置 Store（global-settings/v1），并从旧 UI_SETTINGS_KEYS 迁移（若为空）
              // 根路径（/）的初始工作区跳转由 RootBootstrapRoute 处理：
              // - 等待 globalSettings 恢复完成
              // - 仅当仍停留在 / 时才 redirect，避免覆盖显式导航（E2E/用户点击）
              if (!_routeInitInFlight) {
                _routeInitInFlight = (async () => {
                  const globalSettings = useGlobalSettings()
                  await globalSettings.restoreGlobalSettings()

                  // 标记路由初始化完成（允许 UI 渲染）
                  routeInitialized.value = true
                })()
              }
              await _routeInitInFlight
                await initializeI18nWithStorage();
            }
        },
    // 🔧 必须 immediate：部分运行环境下 services 可能在 watch 注册前就已就绪，
    // 若不触发则 Pinia/Preferences 永远不注入，表现为“刷新后一切都找不到/不持久化”。
    { immediate: true },
);

// 6. 向子组件提供服务
provide("services", services);

// ✅ 应用初始化后从 session store 恢复状态到 UI
// 用于避免“默认值写回”覆盖持久化内容（刷新后选择丢失）
const hasRestoredInitialState = ref(false);

// ✅ 外部数据加载中标志（防止模式切换的自动 restore 覆盖外部数据）
// 适用场景：历史记录恢复、收藏加载、模板导入等任何外部数据加载导致模式切换的情况
const externalDataLoadingGate = createExternalDataLoadingGate();
const isLoadingExternalData = externalDataLoadingGate.isLoading;

// 5. 控制主UI渲染的标志
// 🔧 必须等待路由初始化完成，避免短暂显示根路径的空白页
const isReady = computed(
    () =>
        !!services.value &&
        !isInitializing.value &&
        routeInitialized.value &&
        hasRestoredInitialState.value,
);

// 创建 ContextEditor 使用的 services 引用
const servicesForContextEditor = computed(() => services?.value || null);

// 6. 创建所有必要的引用
const promptService = shallowRef<IPromptService | null>(null);
const showDataManager = ref(false);
const incomingBackupImportCode = ref('');
watch(
    () => routerInstance.currentRoute.value.query[BACKUP_IMPORT_QUERY_KEY],
    (code) => {
        if (typeof code !== 'string' || !code) return;
        incomingBackupImportCode.value = code;
        if (isReady.value) showDataManager.value = true;
        // Keep credentials out of the address bar and subsequent copied links.
        const route = routerInstance.currentRoute.value;
        const query = { ...route.query };
        delete query[BACKUP_IMPORT_QUERY_KEY];
        void routerInstance.replace({ path: route.path, query, hash: route.hash });
    },
    { immediate: true },
);
watch(isReady, (ready) => {
    if (ready && incomingBackupImportCode.value) showDataManager.value = true;
}, { immediate: true });
const dataBackupReminderDue = ref(isDataBackupReminderDue());

type ContextWorkspaceExpose = {
    // Vue ComponentPublicInstance 会自动 unwrap expose 里的 Ref，因此这里使用已解包的类型
    testAreaPanelRef?: TestAreaPanelInstance | null;
    restoreFromHistory?: (payload: unknown) => void;
    openIterateDialog?: (input?: string) => void;
    applyLocalPatch?: (operation: PatchOperation) => void;
    reEvaluateActive?: () => Promise<void>;
    restoreConversationOptimizationFromSession?: () => void; // 🔧 Codex 修复：session 恢复方法
};

const systemWorkspaceRef = ref<ContextWorkspaceExpose | null>(null);
type ContextUserWorkspaceExpose = ContextWorkspaceExpose & {
    // 提供最小可用 API，避免父组件依赖子组件内部实现细节
    contextUserOptimization?: import("../../composables/prompt/useContextUserOptimization").UseContextUserOptimization;
    setPrompt?: (prompt: string) => void;
    getPrompt?: () => string;
    getOptimizedPrompt?: () => string;
    getTemporaryVariableNames?: () => string[];
};

const userWorkspaceRef = ref<ContextUserWorkspaceExpose | null>(null);
const basicModeWorkspaceRef = ref<{
    promptPanelRef?: {
        openIterateDialog?: (input?: string) => void;
        refreshIterateTemplateSelect?: () => void;
    } | null;
    openIterateDialog?: (input?: string) => void;
} | null>(null);

// 🔧 Step E: 使用 route-computed 代替旧 state
type WorkspaceRouteName = string | symbol | null | undefined;
const activeWorkspaceRef = shallowRef<{ isUpdateBusy?: () => boolean } | null>(null);
const setWorkspaceRef = (instance: unknown, routeName: WorkspaceRouteName) => {
    const resolvedInstance = instance ?? null;
    activeWorkspaceRef.value = resolvedInstance as typeof activeWorkspaceRef.value;

    switch (routeName) {
        case "basic-system":
        case "basic-user":
            basicModeWorkspaceRef.value =
                resolvedInstance as typeof basicModeWorkspaceRef.value;
            break;
        case "pro-multi":
            systemWorkspaceRef.value =
                resolvedInstance as typeof systemWorkspaceRef.value;
            break;
        case "pro-variable":
            userWorkspaceRef.value =
                resolvedInstance as typeof userWorkspaceRef.value;
            break;
    }
};

const selectedOptimizationMode = computed<OptimizationMode>(() => {
    if (routeFunctionMode.value === 'basic') return routeBasicSubMode.value;
    if (routeFunctionMode.value === 'pro') return routeProSubMode.value === 'multi' ? 'system' : 'user';
    return 'system';
});

// 🔧 Step D: advancedModeEnabled 改为只读（从 route-computed 读取，不再支持写入）
const advancedModeEnabled = computed(() => routeFunctionMode.value === "pro");

// 🔧 Step D: 已删除死代码 - handleModeSelect/handleBasicSubModeChange/handleProSubModeChange/handleImageSubModeChange
// 这些函数已被 AppCoreNav 的 router.push 导航替代（2024-01-06）

// 测试内容状态

// Naive UI 主题配置
const { naiveTheme, themeOverrides, initTheme } = useNaiveTheme();
watch(() => naiveTheme.value?.name, (theme) => {
    if (typeof document !== 'undefined') document.documentElement.dataset.workspaceTheme = theme === 'dark' ? 'dark' : 'light';
}, { immediate: true });

// 初始化主题系统
if (typeof window !== "undefined") {
    initTheme();
}

// 变量管理状态
const handleMobileAction = (action: string) => {
    if (action === 'favorites') openFavoritesPage();
    else if (action === 'history') historyManager.showHistory = true;
    else if (action === 'templates') openTemplateManager();
    else if (action === 'models') openModelManager();
    else if (action === 'variables') handleOpenVariableManager();
    else if (action === 'data') showDataManager.value = true;
    else if (action === 'docs') openDocumentationSite();
    else if (action === 'website') openOfficialWebsite();
    else if (action === 'github') openGithubRepo();
};
watch(isCompact, (compact) => {
    if (typeof document !== 'undefined') document.documentElement.classList.toggle('workspace-compact', compact);
}, { immediate: true });
watch([isCompact, keyboardViewportHeight, keyboardViewportTop], ([compact, height, top]) => {
    if (typeof document === 'undefined') return;
    const style = document.documentElement.style;
    if (compact && height !== undefined) {
        style.setProperty('--compact-viewport-height', `${height}px`);
        style.setProperty('--compact-viewport-top', `${top}px`);
    } else {
        style.removeProperty('--compact-viewport-height');
        style.removeProperty('--compact-viewport-top');
    }
}, { immediate: true });
const showVariableManager = ref(false);
const focusVariableName = ref<string | undefined>(undefined);

// 工具管理状态
const showToolManager = ref(false);

// 上下文模式
const contextMode = ref<ContextMode>("system");

// 上下文编辑器状态
const showContextEditor = ref(false);
const contextEditorDefaultTab = ref<"messages" | "variables" | "tools">("messages");

// 使用 composable 管理编辑器 UI 状态
const {
    onlyShowTab: contextEditorOnlyShowTab,
    title: contextEditorTitle,
    handleCancel: handleContextEditorCancelBase,
} = useContextEditorUIState(showContextEditor, t);

type ContextEditorOwner = 'context-repo' | 'pro-multi'
const contextEditorOwner = ref<ContextEditorOwner>('context-repo')

watch(showContextEditor, (visible) => {
    if (!visible) {
        contextEditorOwner.value = 'context-repo'
    }
})

const handleContextEditorCancel = () => {
    contextEditorOwner.value = 'context-repo'
    handleContextEditorCancelBase()
}

const contextEditorState = ref<ContextEditorState>({
    messages: [],
    variables: {},
    tools: [],
    showVariablePreview: true,
    showToolManager: false,
    mode: 'edit',
});

// 提示词预览面板状态
const showPreviewPanel = ref(false);

// 变量管理器实例
const variableManager = useVariableManager(services);

// 使用聚合变量管理器
const aggregatedVariables = useAggregatedVariables(variableManager);
const promptPreviewContent = ref("");
const promptPreviewVariables = computed(() => {
    return aggregatedVariables.allVariables.value;
});

// 渲染阶段（用于预览）
const renderPhase = ref<"optimize" | "test">("optimize");

const promptPreview = usePromptPreview(
    promptPreviewContent,
    promptPreviewVariables,
    contextMode,
);

// 变量管理处理函数
const handleOpenVariableManager = (variableName?: string) => {
    if (variableName) {
        focusVariableName.value = variableName;
    }
    showVariableManager.value = true;
};

// 工具管理器处理函数
const handleToolManagerConfirm = (tools?: ToolDefinition[]) => {
    optimizationContextTools.value = tools ?? [];
    showToolManager.value = false;
};

// 6. 在顶层调用所有 Composables
const modelSelectRefs = useModelSelectRefs();
const modelManager = useModelManager(services, modelSelectRefs);

// ========== Session Store（单一真源：可持久化字段） ==========
// 注意：这里需要在 optimizer 创建之前初始化，以便把基础模式字段直绑到 session store
const basicSystemSession = useBasicSystemSession();
const basicUserSession = useBasicUserSession();
const proMultiMessageSession = useProMultiMessageSession();
const proVariableSession = useProVariableSession();
const imageText2ImageSession = useImageText2ImageSession();
const imageImage2ImageSession = useImageImage2ImageSession();
const imageMultiImageSession = useImageMultiImageSession();

// 🔧 Step E: 使用 route-computed 代替旧 state
const activeBasicSession = computed(() =>
    routeBasicSubMode.value === "system" ? basicSystemSession : basicUserSession,
);

// ========== Text Model Selection（单一真源：Session Store） ==========
// 目标：移除旧的“模型选择全局键”遗留概念，避免双真源与反向同步 watch
const selectedOptimizeModelKey = computed<string>({
    get: () => {
        if (routeFunctionMode.value === "basic") {
            return activeBasicSession.value.selectedOptimizeModelKey || "";
        }
        if (routeFunctionMode.value === "pro") {
            const session =
                routeProSubMode.value === "multi"
                    ? proMultiMessageSession
                    : proVariableSession;
            return session.selectedOptimizeModelKey || "";
        }
        if (routeFunctionMode.value === "image") {
            const session =
                routeImageSubMode.value === "text2image"
                    ? imageText2ImageSession
                    : routeImageSubMode.value === "multiimage"
                        ? imageMultiImageSession
                        : imageImage2ImageSession;
            return session.selectedTextModelKey || "";
        }
        return "";
    },
    set: (value) => {
        const next = value || "";
        if (routeFunctionMode.value === "basic") {
            activeBasicSession.value.updateOptimizeModel(next);
            return;
        }
        if (routeFunctionMode.value === "pro") {
            const session =
                routeProSubMode.value === "multi"
                    ? proMultiMessageSession
                    : proVariableSession;
            session.updateOptimizeModel(next);
            return;
        }
        if (routeFunctionMode.value === "image") {
            const session =
                routeImageSubMode.value === "text2image"
                    ? imageText2ImageSession
                    : routeImageSubMode.value === "multiimage"
                        ? imageMultiImageSession
                        : imageImage2ImageSession;
            session.updateTextModel(next);
        }
    },
});

const selectedTestModelKey = computed<string>({
    get: () => {
        if (routeFunctionMode.value === "basic") {
            return activeBasicSession.value.selectedTestModelKey || "";
        }
        if (routeFunctionMode.value === "pro") {
            const session =
                routeProSubMode.value === "multi"
                    ? proMultiMessageSession
                    : proVariableSession;
            return session.selectedTestModelKey || "";
        }
        return "";
    },
    set: (value) => {
        const next = value || "";
        if (routeFunctionMode.value === "basic") {
            activeBasicSession.value.updateTestModel(next);
            return;
        }
        if (routeFunctionMode.value === "pro") {
            const session =
                routeProSubMode.value === "multi"
                    ? proMultiMessageSession
                    : proVariableSession;
            session.updateTestModel(next);
        }
    },
});

// 更新 functionModelManager 的“全局优化模型 key”引用（singleton 内部会替换 ref）
useFunctionModelManager(services, selectedOptimizeModelKey);

const patchActiveBasicOptimizedResult = (
    partial: Partial<{
        optimizedPrompt: string;
        reasoning: string;
        chainId: string;
        versionId: string;
    }>,
) => {
    const session = activeBasicSession.value;
    session.updateOptimizedResult({
        optimizedPrompt:
            partial.optimizedPrompt ?? session.optimizedPrompt ?? "",
        reasoning: partial.reasoning ?? session.reasoning ?? "",
        chainId: partial.chainId ?? session.chainId ?? "",
        versionId: partial.versionId ?? session.versionId ?? "",
    });
};

const basicSessionPrompt = computed<string>({
    get: () => activeBasicSession.value.prompt ?? "",
    set: (value) => activeBasicSession.value.updatePrompt(value || ""),
});

const basicSessionOptimizedPrompt = computed<string>({
    get: () => activeBasicSession.value.optimizedPrompt ?? "",
    set: (value) =>
        patchActiveBasicOptimizedResult({ optimizedPrompt: value || "" }),
});

const basicSessionOptimizedReasoning = computed<string>({
    get: () => activeBasicSession.value.reasoning ?? "",
    set: (value) => patchActiveBasicOptimizedResult({ reasoning: value || "" }),
});

const basicSessionChainId = computed<string>({
    get: () => activeBasicSession.value.chainId ?? "",
    set: (value) => patchActiveBasicOptimizedResult({ chainId: value || "" }),
});

const basicSessionVersionId = computed<string>({
    get: () => activeBasicSession.value.versionId ?? "",
    set: (value) => patchActiveBasicOptimizedResult({ versionId: value || "" }),
});

// 提示词优化器
const optimizer = usePromptOptimizer(
    services,
    selectedOptimizationMode,
    selectedOptimizeModelKey,
    selectedTestModelKey,
    contextMode,
    {
        prompt: basicSessionPrompt,
        optimizedPrompt: basicSessionOptimizedPrompt,
        optimizedReasoning: basicSessionOptimizedReasoning,
        currentChainId: basicSessionChainId,
        currentVersionId: basicSessionVersionId,
        getSourceBindingSession: () => activeBasicSession.value,
    },
);

// 上下文管理
const contextManagement = useContextManagement({
    services,
    advancedModeEnabled,
    showContextEditor,
    contextEditorDefaultTab,
    contextEditorState,
    variableManager,
    optimizer,
});

// 从 contextManagement 提取其他状态和方法
const optimizationContext = contextManagement.optimizationContext;
const optimizationContextTools = contextManagement.optimizationContextTools;
const initializeContextPersistence = contextManagement.initializeContextPersistence;
const persistContextUpdate = contextManagement.persistContextUpdate;
const handleContextEditorSave = contextManagement.handleContextEditorSave;
const handleContextEditorStateUpdate = contextManagement.handleContextEditorStateUpdate;

const handleContextEditorStateUpdateSafe = (state?: ContextEditorState) => {
    if (!state) return;
    if (contextEditorOwner.value === 'pro-multi') {
        // Pro-multi: keep edits local until user hits Save.
        contextEditorState.value = {
            ...contextEditorState.value,
            messages: [...(state.messages || [])],
            tools: [...(state.tools || [])],
        };
        return;
    }
    void handleContextEditorStateUpdate(state);
};

const handleContextEditorSaveSafe = (context?: {
    messages: ConversationMessage[];
    variables: Record<string, string>;
    tools: ToolDefinition[];
}) => {
    if (!context) return;

    if (contextEditorOwner.value === 'pro-multi') {
        const prevMessages = proMultiMessageSession.conversationMessagesSnapshot || []
        const prevIds = new Set(
            prevMessages
                .map((m) => m.id)
                .filter((id): id is string => typeof id === 'string' && id.length > 0),
        )
        const nextIds = new Set(
            (context.messages || [])
                .map((m) => m.id)
                .filter((id): id is string => typeof id === 'string' && id.length > 0),
        )

        // Remove chain mappings for deleted messages.
        for (const id of prevIds) {
            if (!nextIds.has(id)) {
                proMultiMessageSession.removeMessageChainMapping(id)
            }
        }

        proMultiMessageSession.updateConversationMessages([...(context.messages || [])])

        const selectedId = proMultiMessageSession.selectedMessageId
        if (selectedId && ![...(context.messages || [])].some((m) => m.id === selectedId)) {
            proMultiMessageSession.selectMessage('')
        }

        // Keep tools in the context repo (unchanged architecture for now).
        optimizationContextTools.value = [...(context.tools || [])]
        void persistContextUpdate({ tools: context.tools || [] })

        showContextEditor.value = false
        contextEditorOwner.value = 'context-repo'

        // Best-effort persist the pro-multi session after an explicit save.
        void proMultiMessageSession.saveSession()
        toast.success(t('context.saveSuccess'))
        return
    }

    void handleContextEditorSave(context);
};
const handleContextModeChange = contextManagement.handleContextModeChange;

// 提供依赖给子组件
provide("variableManager", variableManager);
provide("optimizationContext", optimizationContext);
provide("optimizationContextTools", optimizationContextTools);

// ========== Session Store 状态同步 ==========

// 🔧 Step E: 使用 route-computed 代替旧 state
const getCurrentSession = () => {
    if (routeFunctionMode.value === 'arena') return null;
    if (routeFunctionMode.value === 'basic') {
        return routeBasicSubMode.value === 'system' ? basicSystemSession : basicUserSession;
    } else if (routeFunctionMode.value === 'pro') {
        return routeProSubMode.value === 'multi' ? proMultiMessageSession : proVariableSession;
    } else if (routeFunctionMode.value === 'image') {
        return routeImageSubMode.value === 'text2image'
            ? imageText2ImageSession
            : routeImageSubMode.value === 'multiimage'
                ? imageMultiImageSession
                : imageImage2ImageSession;
    }
    return basicSystemSession;
};

const getCurrentBasicSession = () =>
    routeBasicSubMode.value === 'system' ? basicSystemSession : basicUserSession;

const restoreProMultiMessageSession = async () => {
    const session = proMultiMessageSession;
    // Keep the existing startup example. A route switch must keep an empty draft empty.
    if (!hasRestoredInitialState.value && session.conversationMessagesSnapshot.length === 0) {
        let seed = 0;
        const makeId = () => {
            const maybeCrypto = globalThis.crypto as unknown as { randomUUID?: () => string } | undefined;
            if (maybeCrypto && typeof maybeCrypto.randomUUID === 'function') {
                return maybeCrypto.randomUUID();
            }
            seed += 1;
            return `pro-multi-default-${Date.now()}-${seed}`;
        };

        const systemText = t('promptOptimizer.defaultOptimizationContext.proMulti.system');
        const userText = t('promptOptimizer.defaultOptimizationContext.proMulti.user');
        const defaultMessages: ConversationMessage[] = [
            {
                id: makeId(),
                role: 'system',
                content: systemText,
                originalContent: systemText,
            },
            {
                id: makeId(),
                role: 'user',
                content: userText,
                originalContent: userText,
            },
        ];
        session.updateConversationMessages(defaultMessages);
        // Keep initial selection empty (Playwright expects the empty-select UI).
        session.selectMessage('');
    }

    // 🔧 Codex 修复：等待 DOM 更新，确保子组件 ref 已建立
    await nextTick();

    // 🔧 Codex 修复：显式恢复 conversationOptimization 的状态（selectedMessageId 和 messageChainMap）
    // 确保在 session restore 完成后再调用，避免时序问题
    // 通过子组件 ref 调用（子组件已在 defineExpose 中暴露此方法）
    systemWorkspaceRef.value?.restoreConversationOptimizationFromSession?.();
};

const restoreSessionToUIInternal = async () => {
    if (routeFunctionMode.value === 'pro' && routeProSubMode.value === 'multi') {
        await restoreProMultiMessageSession();
    }
};

// 🔧 架构优化：使用 session 恢复协调器
// 负责处理互斥锁、pending 重试、卸载检查等协调逻辑
const restoreCoordinator = useSessionRestoreCoordinator(restoreSessionToUIInternal);

// 对外暴露的恢复函数（带协调逻辑）
const restoreSessionToUI = restoreCoordinator.executeRestore;

const workspaceRouteSwitch = createWorkspaceRouteSwitchController({
    hasRestoredInitialState,
    parseSubModeKey,
    flushWorkspace: sessionManager.flushSubModeSession,
    restoreSessionToUI,
    onError: (error, toPath, fromPath) => {
        console.error(`[PromptOptimizerApp] Route switch failed: ${fromPath} -> ${toPath}`, error);
    },
});

// 同步 prompt 变化到 session store
// 🔧 方案 A 修复：严格限制在 Basic 模式，避免跨模式污染
// 根本原因：optimizer.prompt 已通过 computed 绑定到 session store（单一真源）
// - Basic 模式：optimizer.prompt ↔ basicSessionPrompt ↔ session.prompt
// - Pro/Image 模式：不使用 optimizer.prompt，但 watch 仍会触发并错误写入
watch(
    () => optimizer.prompt,
    (newPrompt) => {
        // ⚠️ 严格限制在 Basic 模式
        // - Pro 模式：没有 prompt 字段
        // - Image 模式：使用独立的 ImageWorkspace 状态，不涉及 optimizer
        if (routeFunctionMode.value !== 'basic') {
            return;
        }

        // ✅ 只有 Basic 模式才同步到 session
        getCurrentBasicSession().updatePrompt(newPrompt || '');
    }
);

// 同步优化结果到 session store（包含 optimizedPrompt, reasoning, chainId, versionId）
// ⚠️ Codex 要求：移除 truthy 检查，支持清空状态同步
watch(
    [
        () => optimizer.optimizedPrompt,
        () => optimizer.optimizedReasoning,
        () => optimizer.currentChainId,
        () => optimizer.currentVersionId,
    ],
    ([newOptimizedPrompt, newReasoning, newChainId, newVersionId]) => {
        // 🔧 Basic/Image 模式的可持久化字段已直接绑定到对应 session store，
        // 避免重复同步（尤其是 streaming token 会造成双写）。
        if (routeFunctionMode.value === 'basic') return;
        if (routeFunctionMode.value === 'image') return;

        // Pro-user 模式的优化结果由 ContextUserWorkspace 内部管理，避免用 optimizer 覆盖 session
        if (routeFunctionMode.value === 'pro' && routeProSubMode.value === 'variable') {
            return;
        }

        // 🔧 Pro-system 模式的优化结果由 useConversationOptimization 直写 session store，
        // 避免用不相关的 optimizer 状态覆盖（刷新后易写入空值）。
        if (routeFunctionMode.value === 'pro' && routeProSubMode.value === 'multi') {
            return;
        }

        const session = getCurrentSession();
        if (session) {
            session.updateOptimizedResult({
                optimizedPrompt: newOptimizedPrompt || '',
                reasoning: newReasoning || '',
                chainId: newChainId || '',
                versionId: newVersionId || '',
            });
        }
    }
);

/*
// 同步优化模型选择到 session store（已废弃：模型选择以 Session Store 为唯一真源）
// 🔧 Codex 修复：Image 模式使用 updateTextModel，Basic 模式使用 updateOptimizeModel
// 🔧 清理：Pro 模式的模型选择已由各 workspace/controller 直接管理，不在此处写入
watch(
    () => modelManager.selectedOptimizeModel,
    (newModel) => {
        // 🔧 Pro 模式的模型选择已由 workspace/controller 持久化到 session store
        // 避免在此处写入导致双写或污染
        if (routeFunctionMode.value === 'pro') return;

        const session = getCurrentSession();
        if (!session) return;

        // Image 模式使用 updateTextModel
        if (routeFunctionMode.value === 'image') {
            // 避免模型选择初始化/短暂空值时覆盖 image session（导致下拉变成"未选择"）
            if (!modelManager.isModelSelectionReady || !newModel) {
                return;
            }
            if (typeof (session as { updateTextModel?: unknown }).updateTextModel === 'function') {
                (session as { updateTextModel: (model: string) => void }).updateTextModel(newModel || '');
            }
        } else {
            // Basic 模式使用 updateOptimizeModel
            if (typeof (session as { updateOptimizeModel?: unknown }).updateOptimizeModel === 'function') {
                (session as { updateOptimizeModel: (model: string) => void }).updateOptimizeModel(newModel || '');
            }
        }
    }
);

// 同步测试模型选择到 session store
// 🔧 Codex 修复：Image 模式没有对应的 testModel 字段，跳过同步
// 🔧 清理：Pro 模式的测试模型选择已由各 workspace/controller 直接管理
watch(
    () => modelManager.selectedTestModel,
    (newModel) => {
        // 🔧 Pro 模式的测试模型选择已由 workspace/controller 持久化到 session store
        // Image 模式不使用 testModel 字段
        if (routeFunctionMode.value === 'image') return;
        if (routeFunctionMode.value === 'pro') return;

        const session = getCurrentSession();
        if (session && typeof (session as { updateTestModel?: unknown }).updateTestModel === 'function') {
            (session as { updateTestModel: (model: string) => void }).updateTestModel(newModel || '');
        }
    }
);

*/
// 当前选中的模板（根据 system/user 模式映射到 optimizer 对应字段）
// 注意：必须在任何 watch/计算属性引用之前声明，避免 TDZ。
// （选择已下沉到各 workspace；此处不再维护 currentSelectedTemplate）
const currentSelectedTemplate = computed<Template | null>({
    get: () =>
        selectedOptimizationMode.value === "system"
            ? optimizer.selectedOptimizeTemplate
            : optimizer.selectedUserOptimizeTemplate,
    set: (value) => {
        if (selectedOptimizationMode.value === "system") {
            optimizer.selectedOptimizeTemplate = value;
        } else {
            optimizer.selectedUserOptimizeTemplate = value;
        }
    },
});

// 同步模板选择到 session store
// 🔧 方案 A 修复：Image 模式不使用 optimizer 的模板，需要排除
// 🔧 清理：Pro 模式的模板选择已由各 workspace/controller 直接管理
watch(
    currentSelectedTemplate,
    (newTemplate) => {
        if (!hasRestoredInitialState.value) return;

        // ⚠️ Image 模式使用独立的 session 模板管理
        // 🔧 Pro 模式的模板选择已由 workspace/controller 持久化到 session store
        if (routeFunctionMode.value === 'image') return;
        if (routeFunctionMode.value === 'pro') return;

        getCurrentBasicSession().updateTemplate(newTemplate?.id || null);
    }
);

// 同步迭代模板选择到 session store
// 🔧 清理：仅 Basic 模式使用 optimizer.selectedIterateTemplate
// 🔧 Pro 模式的迭代模板选择已由 workspace/controller 直接管理
watch(
    () => optimizer.selectedIterateTemplate,
    (newTemplate) => {
        if (!hasRestoredInitialState.value) return;

        // ⚠️ 仅 Basic 模式使用此迭代模板
        // - Pro-system：没有 updateIterateTemplate 方法
        // - Pro-user：已由 workspace/controller 持久化
        // - Image：使用独立的模板管理
        if (routeFunctionMode.value === 'image') return;
        if (routeFunctionMode.value === 'pro') return;

        getCurrentBasicSession().updateIterateTemplate(newTemplate?.id || null);
    }
);

// ========== Pro 多消息模式特有状态同步 ==========
// 🔧 已清理：optimizationContext 现在由 ProWorkspaceContainer 直接管理
// 避免在 App 层写入导致双写或污染（刷新后易写入空值）

// 同步 contextManagement 中的 contextMode 到 App 层（不驱动路由）
watch(
    contextManagement.contextMode,
    async (newMode) => {
        contextMode.value = newMode;
    },
    { immediate: true },
);

// Pro 模式下：以路由为真源，同步 services/contextManagement 的 contextMode
// 目的：避免“持久化/默认 contextMode”反向覆盖显式路由（E2E 会直接 goto /#/pro/variable）
watch(
    [services, () => routeFunctionMode.value, () => routeProSubMode.value],
    async ([newServices, functionMode, proSubMode]) => {
        if (!newServices) return;
        if (functionMode !== "pro") return;

        const desiredContextMode = proSubMode === "multi" ? "system" : "user";
        if (contextManagement.contextMode.value !== desiredContextMode) {
            await handleContextModeChange(desiredContextMode);
        }
    },
    { immediate: true },
);

const optimizerCurrentVersions = computed<PromptRecordChain["versions"]>({
    get: () => optimizer.currentVersions || [],
    set: (value) => {
        optimizer.currentVersions = value;
    },
});

// 提示词历史
const promptHistory = usePromptHistory(
    services,
    basicSessionPrompt,
    basicSessionOptimizedPrompt,
    basicSessionChainId,
    optimizerCurrentVersions,
    basicSessionVersionId,
);

provide("promptHistory", promptHistory);

const historyManager = promptHistory;

let hasRegisteredGlobalHistoryRefresh = false;
let isAppUnmounted = false;
const handleGlobalHistoryRefresh = () => {
    promptHistory.initHistory();
};

const servicesForHistoryRestore = computed(() =>
    services.value ? { historyManager: services.value.historyManager } : null,
);

const navigateToSubModeKeyCompat = (
    toKey: string,
    opts?: { replace?: boolean },
) => {
    if (!WORKSPACE_SUB_MODE_KEYS.includes(toKey as SubModeKey)) {
        console.warn(`[PromptOptimizerApp] Invalid workspace sub mode key: ${toKey}`);
        return Promise.resolve(false);
    }
    return navigateToSubModeKey(toKey as SubModeKey, opts).then(() => true);
};

const optimizerPrompt = computed<string>({
    get: () => (typeof optimizer.prompt === "string" ? optimizer.prompt : ""),
    set: (value) => {
        optimizer.prompt = value;
    },
});

const getSessionBySubModeKey = (targetKey: SubModeKey) => {
    switch (targetKey) {
        case 'basic-system': return basicSystemSession;
        case 'basic-user': return basicUserSession;
        case 'pro-multi': return proMultiMessageSession;
        case 'pro-variable': return proVariableSession;
        case 'image-text2image': return imageText2ImageSession;
        case 'image-image2image': return imageImage2ImageSession;
        case 'image-multiimage': return imageMultiImageSession;
        default: return null;
    }
};

const restoreSourceBindingForTargetKey = (
    targetKey: string,
    state: { assetBinding?: PromptAssetBinding; origin?: PromptSessionOrigin },
) => {
    if (!WORKSPACE_SUB_MODE_KEYS.includes(targetKey as SubModeKey)) return;
    const session = getSessionBySubModeKey(targetKey as SubModeKey);
    if (!session) return;
    if (state.assetBinding || state.origin) {
        session.updateAssetBinding(state.assetBinding, state.origin);
    } else {
        session.clearAssetBinding();
    }
};

const saveSessionForTargetKey = async (targetKey: string) => {
    if (!WORKSPACE_SUB_MODE_KEYS.includes(targetKey as SubModeKey)) return;
    const session = getSessionBySubModeKey(targetKey as SubModeKey);
    if (!session?.saveSession) return;
    await session.saveSession();
};

// Mobile-only safeguard; retain the existing desktop history/favorite flow.
const beforeApplyToWorkspace = async (targetKey: string) => {
    if (!isCompact.value) return true;
    if (targetKey === 'pro-multi' || targetKey === 'pro-variable' ||
        targetKey === 'image-text2image' || targetKey === 'image-image2image' ||
        targetKey === 'image-multiimage') {
        useWorkspaceViewState(targetKey).resetView();
        return true;
    }
    if (targetKey !== 'basic-system' && targetKey !== 'basic-user') return true;
    const session = targetKey === 'basic-system' ? basicSystemSession : basicUserSession;
    let savedPrompt = '';
    let savedOriginal = '';
    if (session.versionId && services.value?.historyManager) {
        try {
            const record = await services.value.historyManager.getRecord(session.versionId);
            savedPrompt = record.optimizedPrompt || '';
            savedOriginal = record.originalPrompt || '';
        } catch { /* Missing history must not silently discard a draft. */ }
    }
    const dirty = (session.optimizedPrompt || '') !== savedPrompt || (session.prompt || '') !== savedOriginal;
    if (dirty && !(await confirmDialog.warning({
        title: t('common.warning'), content: t('prompt.unsavedChangesConfirm'),
        positiveText: t('common.confirm'), negativeText: t('common.cancel'),
    }))) return false;
    useWorkspaceViewState(targetKey === 'basic-system' ? 'system' : 'user').resetView();
    return true;
};

// App 级别历史记录恢复
const { handleHistoryReuse } = useAppHistoryRestore({
    services: servicesForHistoryRestore,
    beforeApplyToWorkspace,
    navigateToSubModeKey: navigateToSubModeKeyCompat,  // 🔧 Step D: 替代旧的 setFunctionMode/set*SubMode
    handleContextModeChange,
    handleSelectHistory: promptHistory.handleSelectHistory,
    proMultiMessageSession,
    systemWorkspaceRef,
    userWorkspaceRef,
    t,
    isLoadingExternalData,
    restoreSourceBindingForTargetKey,
    saveSessionForTargetKey,
});

// App 级别收藏管理
const {
    showFavoriteManager,
    showSaveFavoriteDialog,
    saveFavoriteData,
    handleSaveFavorite,
    handleSaveFavoriteComplete,
    handleUseFavorite,
} = useAppFavorite({
    beforeApplyToWorkspace,
    navigateToSubModeKey: navigateToSubModeKeyCompat,  // 🔧 Step D: 替代旧的 setFunctionMode/set*SubMode
    handleContextModeChange,
    optimizerPrompt,
    t,
    isLoadingExternalData,
    basicSystemSession,
    basicUserSession,
    proMultiMessageSession,
    proVariableSession,
    imageText2ImageSession,
    imageImage2ImageSession,
    imageMultiImageSession,
    optimizerCurrentVersions,
    getFavoriteImageStorageService:
      () => services.value?.favoriteImageStorageService || services.value?.imageStorageService || null,
    getFavoriteManager: () => services.value?.favoriteManager || null,
    getCurrentFunctionMode: () => routeFunctionMode.value,
    getCurrentOptimizationMode: () => selectedOptimizationMode.value,
    getCurrentImageSubMode: () => routeImageSubMode.value,
});

const resolveFavoritesReturnPath = () =>
    resolveWorkspacePathFallback(
        getCurrentRouteFromWorkspaceQuery(),
        lastWorkspacePath.value,
        () => getWorkspacePathFromGlobalSettings(),
    );

const openFavoritesPage = () => {
    const fromPath = resolveWorkspacePathFallback(
        routerInstance.currentRoute.value.path,
        lastWorkspacePath.value,
        () => getWorkspacePathFromGlobalSettings(),
    );

    if (isFavoritesRoute.value && getCurrentRouteFromWorkspaceQuery() === fromPath) {
        return;
    }

    void routerInstance.push({
        name: 'favorites',
        query: {
            from: fromPath,
        },
    });
};

const returnToWorkspace = () => {
    void routerInstance.push(resolveFavoritesReturnPath());
};

const handleUseFavoriteFromPage = async (
    favorite: FavoritePrompt,
    options?: { applyExample?: boolean; exampleId?: string; exampleIndex?: number },
): Promise<boolean> => {
    const used = await handleUseFavorite(favorite, options);

    // handleUseFavorite awaits target workspace navigation. This fallback only covers
    // legacy/non-navigating favorite payloads that still leave the page route active.
    if (used && routerInstance.currentRoute.value.path === '/favorites') {
        returnToWorkspace();
    }

    return used;
};

provide(favoritesPageActionsKey, {
    useFavorite: handleUseFavoriteFromPage,
    returnToWorkspace,
});

// Optional integrations (feature-flagged + lazy-loaded).
void registerOptionalIntegrations({
    router: routerInstance,
    hasRestoredInitialState,
    isLoadingExternalData,
    optimizationContext,
    basicSystemSession,
    basicUserSession,
    proMultiMessageSession,
    proVariableSession,
    imageText2ImageSession,
    imageImage2ImageSession,
    imageMultiImageSession,
    getFavoriteManager: () => services.value?.favoriteManager || null,
    getFavoriteImageStorageService:
      () => services.value?.favoriteImageStorageService || services.value?.imageStorageService || null,
    openSaveFavoriteDialog: (data) => handleSaveFavorite(data),
    optimizerCurrentVersions,
});
provide("handleSaveFavorite", handleSaveFavorite);

// 提供 openToolManager 接口（供 Pro 工作区直接调用）
provide("openToolManager", () => {
    showToolManager.value = true;
});

// 提供 openVariableManager 接口（供 Pro 工作区直接调用）
provide("openVariableManager", (variableName?: string) => {
    handleOpenVariableManager(variableName);
});

// 提供 saveToGlobal 接口（供 Pro 工作区将临时变量保存到全局）
provide("saveToGlobal", (name: string, value: string) => {
    try {
        variableManager.addVariable(name, value);
    } catch (error) {
        console.error('[PromptOptimizerApp] Failed to save variable to global:', error);
        throw error;
    }
});

// 提供 openPromptPreview 接口（供 Pro 工作区打开提示词预览面板）
provide("openPromptPreview", () => {
    showPreviewPanel.value = true;
});

// 模板管理器
const templateManagerState = useTemplateManager(services);

// TemplateManager 选择回调：写入 Session Store（单一真源），避免写入旧 TEMPLATE_SELECTION_KEYS
const handleTemplateSelected = (
    template: Template | null,
    type: Template["metadata"]["templateType"],
    category?: string,
) => {
    const session = getCurrentSession();
    if (!session && !category) return;

    const sessionByCategory = (() => {
        switch (category) {
            case "system-optimize":
            case "basic-system-iterate":
                return basicSystemSession;
            case "user-optimize":
            case "basic-user-iterate":
                return basicUserSession;
            case "context-system-optimize":
                return proMultiMessageSession;
            case "context-user-optimize":
                return proVariableSession;
            case "context-iterate":
                return routeProSubMode.value === "multi"
                    ? proMultiMessageSession
                    : proVariableSession;
            case "image-text2image-optimize":
                return imageText2ImageSession;
            case "image-image2image-optimize":
                return imageImage2ImageSession;
            case "image-multiimage-optimize":
                return imageMultiImageSession;
            case "image-iterate":
                return routeImageSubMode.value === "image2image"
                    ? imageImage2ImageSession
                    : routeImageSubMode.value === "multiimage"
                        ? imageMultiImageSession
                    : imageText2ImageSession;
            default:
                return null;
        }
    })();

    const targetSession = sessionByCategory || session;
    if (!targetSession) return;

    const templateSession = targetSession as unknown as {
        updateTemplate?: (templateId: string | null) => void;
        updateIterateTemplate?: (templateId: string | null) => void;
    };

    const templateType = String(type || "");
    const isIterate =
        templateType === "iterate" ||
        templateType === "contextIterate" ||
        templateType === "imageIterate";

    const templateId = template?.id || null;

    if (isIterate && typeof templateSession.updateIterateTemplate === "function") {
        templateSession.updateIterateTemplate(templateId);
        return;
    }
    if (typeof templateSession.updateTemplate === "function") {
        templateSession.updateTemplate(templateId);
    }
};
const textModelOptions = ref<ModelSelectOption[]>([]);

const refreshTextModels = async () => {
    if (!services.value?.modelManager) {
        textModelOptions.value = [];
        return;
    }

    try {
        const manager = services.value.modelManager;
        const m = manager as unknown as { ensureInitialized?: () => Promise<void> };
        if (typeof m.ensureInitialized === 'function') {
            await m.ensureInitialized();
        }
        const enabledModels = await manager.getEnabledModels();
        textModelOptions.value = DataTransformer.modelsToSelectOptions(enabledModels, {
            getProviderName: (model) => getProviderDisplayName(model.providerMeta, t),
            getModelName: (model) => getTextModelConfigDisplayName(model, t)
        });

        const availableKeys = new Set(textModelOptions.value.map((opt) => opt.value));
        const fallbackValue = textModelOptions.value[0]?.value || "";
        const selectionReady = modelManager.isModelSelectionReady;

        if (fallbackValue && selectionReady && hasRestoredInitialState.value) {
            if (selectedOptimizeModelKey.value && !availableKeys.has(selectedOptimizeModelKey.value)) {
                selectedOptimizeModelKey.value = fallbackValue;
            }
            if (selectedTestModelKey.value && !availableKeys.has(selectedTestModelKey.value)) {
                selectedTestModelKey.value = fallbackValue;
            }
            if (!selectedOptimizeModelKey.value) {
                selectedOptimizeModelKey.value = fallbackValue;
            }
            // Image 模式不使用 testModel；setter 会忽略
            if (!selectedTestModelKey.value) {
                selectedTestModelKey.value = fallbackValue;
            }
        }
    } catch (error) {
        console.warn("[PromptOptimizerApp] Failed to refresh text models:", error);
        textModelOptions.value = [];
    }
};

watch(
    () => services.value?.modelManager,
    async (manager) => {
        if (manager) {
            await refreshTextModels();
        } else {
            textModelOptions.value = [];
        }
    },
    { immediate: true },
);

// 7. 监听服务初始化
watch(services, async (newServices) => {
    if (isAppUnmounted) return;
    if (!newServices) return;

    promptService.value = newServices.promptService;
    await initializeContextPersistence();
    if (isAppUnmounted) return;

    // 等待基于 globalSettings 的初始路由初始化完成（避免根路径时读取到错误的 routeFunctionMode）
    if (_routeInitInFlight) {
        await _routeInitInFlight;
        if (isAppUnmounted) return;
    }

    // 🔧 修复：使用 setup 顶层保存的 composable 引用，避免在 watch 回调中重复调用（导致 inject() 错误）
    if (routeFunctionMode.value === "basic") {
        await basicSubModeApi.ensureInitialized();
    } else if (routeFunctionMode.value === "pro") {
        await proSubModeApi.ensureInitialized();
        await handleContextModeChange(
            routeProSubMode.value === 'multi' ? 'system' : 'user',
        );
    } else if (routeFunctionMode.value === "image") {
        await imageSubModeApi.ensureInitialized();
    }
    if (isAppUnmounted) return;

    if (typeof window !== 'undefined' && !hasRegisteredGlobalHistoryRefresh) {
        window.addEventListener(
            "prompt-optimizer:history-refresh",
            handleGlobalHistoryRefresh,
        );
        hasRegisteredGlobalHistoryRefresh = true;
    }
});

// 8. 处理数据导入成功后的刷新
const handleDataImported = () => {
    // Writes remain frozen for the old stores until the imported data is loaded.
    window.removeEventListener('beforeunload', warnBeforeUnload);
    window.location.reload();
};

// 监听变量管理器关闭
watch(showVariableManager, (newValue) => {
    if (!newValue) {
        focusVariableName.value = undefined;
    }
});

// 监听高级模式和优化模式变化
watch(
    [advancedModeEnabled, selectedOptimizationMode],
    ([newAdvancedMode, newOptimizationMode]) => {
        if (newAdvancedMode) {
            if (
                !optimizationContext.value ||
                optimizationContext.value.length === 0
            ) {
                // Note: Pro Multi messages are now session-owned; avoid writing defaults into optimizationContext.
                if (newOptimizationMode === "user") {
                    optimizationContext.value = [
                        { role: "user", content: "{{currentPrompt}}" },
                    ];
                }
            }
        }
    },
    { immediate: false },
);

const appVersion = `v${rootPackageJson.version}`;

const openOfficialWebsite = async () => {
    await openExternalUrl("https://always200.com");
};

const openDocumentationSite = async () => {
    await openExternalUrl("https://docs.always200.com");
};

// 打开GitHub仓库
const openGithubRepo = async () => {
    await openExternalUrl("https://github.com/linshenkx/prompt-optimizer");
};

const normalizeTemplateTypeForManager = (
    templateType: TemplateType | undefined,
): TemplateManagerTemplateType => {
    if (!templateType) {
        return selectedOptimizationMode.value === "system"
            ? "optimize"
            : "userOptimize";
    }

    // 兼容旧值：contextSystemOptimize -> conversationMessageOptimize（上下文系统/消息优化）
    if (templateType === "contextSystemOptimize") {
        return "conversationMessageOptimize";
    }

    const templateManagerSupportedTypes: readonly TemplateManagerTemplateType[] = [
        "optimize",
        "userOptimize",
        "iterate",
        "text2imageOptimize",
        "image2imageOptimize",
        "multiimageOptimize",
        "imageIterate",
        "conversationMessageOptimize",
        "contextUserOptimize",
        "contextIterate",
    ];

    const isTemplateManagerTemplateType = (
        type: TemplateType,
    ): type is TemplateManagerTemplateType => {
        return (templateManagerSupportedTypes as readonly string[]).includes(type);
    };

    if (isTemplateManagerTemplateType(templateType)) return templateType;

    // TemplateManager 明确不支持的类型（如 evaluation）不能静默回退。
    // 直接抛错，避免打开错误的模板集合掩盖问题。
    throw new Error(
        `[PromptOptimizerApp] Unsupported template type for TemplateManager: ${templateType}`,
    );
};

// 打开模板管理器
const openTemplateManager = (templateType?: TemplateType) => {
    templateManagerState.currentType = normalizeTemplateTypeForManager(templateType);
    templateManagerState.showTemplates = true;
};

// 🔧 Step D: 已删除死代码 - handleBasicSubModeChange/handleProSubModeChange/handleImageSubModeChange
// 这些函数已被 AppCoreNav 的 router.push 导航替代（2024-01-06）

// 处理模板语言变化
const handleTemplateLanguageChanged = (_newLanguage: string) => {
    // Basic 工作区：若存在则直接刷新迭代模板选择（同时也会广播 refresh 事件）
    if (basicModeWorkspaceRef.value?.promptPanelRef?.refreshIterateTemplateSelect) {
        basicModeWorkspaceRef.value.promptPanelRef.refreshIterateTemplateSelect();
    }

    if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("basic-workspace-refresh-templates"));
        window.dispatchEvent(new Event("basic-workspace-refresh-iterate-select"));
        window.dispatchEvent(new Event("pro-workspace-refresh-templates"));
        window.dispatchEvent(new Event("image-workspace-refresh-templates"));
        window.dispatchEvent(new Event("image-workspace-refresh-iterate-select"));
    }
};

// 向子组件提供统一的 openTemplateManager 接口
provide("openTemplateManager", openTemplateManager);

// 模板管理器关闭回调
const handleTemplateManagerClosed = () => {
    try {
        templateManagerState.handleTemplateManagerClose();
    } catch (e) {
        console.warn("[PromptOptimizerApp] Failed to run template manager close handler:", e);
    }
    if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("basic-workspace-refresh-templates"));
        window.dispatchEvent(new Event("pro-workspace-refresh-templates"));
        window.dispatchEvent(new Event("image-workspace-refresh-templates"));
    }
};

// 提供 openModelManager 接口
const modelManagerDialogRef = ref<InstanceType<typeof ModelManagerUI> | null>(null);
const openModelManager = async (tab: "text" | "image" | "function" = "text", configId?: string) => {
    modelManager.showConfig = true;
    await nextTick();
    if (typeof window !== "undefined") {
        window.dispatchEvent(
            new CustomEvent("model-manager:set-tab", { detail: tab }),
        );
    }
    if (tab === "text" && configId) {
        await modelManagerDialogRef.value?.openTextModel(configId);
    } else if (tab === "image" && configId) {
        await modelManagerDialogRef.value?.openImageModel(configId);
    }
};
provide("openModelManager", openModelManager);

// 提供 openContextEditor 接口（供 Pro Multi 等工作区直接调用）
type ContextEditorOpenArg = ConversationMessage[] | "messages" | "variables" | "tools";
const openContextEditor = (
    messagesOrTab?: ContextEditorOpenArg,
    variables?: Record<string, string>,
) => {
    // Pro-multi: ContextEditor edits the session-owned conversation messages.
    if (routeFunctionMode.value === 'pro' && routeProSubMode.value === 'multi') {
        contextEditorOwner.value = 'pro-multi'

        let messages: ConversationMessage[] | undefined
        let defaultTab: 'messages' | 'variables' | 'tools' = 'messages'
        if (typeof messagesOrTab === 'string') {
            defaultTab = messagesOrTab
            messages = undefined
        } else {
            messages = messagesOrTab
        }

        contextEditorDefaultTab.value = defaultTab
        void variableManager?.refresh?.()

        contextEditorState.value = {
            messages: messages || [...(proMultiMessageSession.conversationMessagesSnapshot || [])],
            variables: {},
            tools: [...(optimizationContextTools.value || [])],
            showVariablePreview: false,
            showToolManager: contextMode.value === 'user',
            mode: 'edit',
        }
        showContextEditor.value = true
        return
    }

    contextEditorOwner.value = 'context-repo'
    void contextManagement.handleOpenContextEditor(messagesOrTab, variables);
};
provide("openContextEditor", openContextEditor);

const dispatchTextModelRefreshEvents = () => {
    if (typeof window === "undefined") {
        return;
    }

    window.dispatchEvent(new Event("basic-workspace-refresh-text-models"));
    window.dispatchEvent(new Event("pro-workspace-refresh-text-models"));
    window.dispatchEvent(new Event("image-workspace-refresh-text-models"));
};

// 文本模型更新回调
const handleTextModelsUpdated = async () => {
    await refreshTextModels();
    dispatchTextModelRefreshEvents();
};

// 模型管理器关闭回调
const handleModelManagerClosed = async () => {
    try {
        modelManager.handleModelManagerClose();
    } catch (e) {
        console.warn("[PromptOptimizerApp] Failed to refresh text models after manager close:", e);
    }
    await refreshTextModels();
    if (typeof window !== "undefined") {
        dispatchTextModelRefreshEvents();
        window.dispatchEvent(new Event("image-workspace-refresh-image-models"));
    }
};

// ========== Session Management ==========
/**
 * 🔧 开发规范（防止回归）：
 *
 * 任何新增通过 watch 触发 switchMode / switchSubMode / restoreSessionToUI 的入口
 * 都**必须**添加以下检查，防止 session restore 覆盖外部数据：
 *
 *   if (isLoadingExternalData.value) return;
 *
 * 外部数据加载流程如果也需要切换工作区，必须通过 navigateToSubModeKey()
 * 显式等待同一套路由事务完成，再写入外部数据。
 *
 * 适用场景：历史记录恢复、收藏加载、模板导入、配置恢复等任何外部数据加载
 *
 * 当前路由切换入口：
 *   watch(router.currentRoute.fullPath, ...) - 工作区路由切换事务
 */

// History and favorites wait for the same route transaction before applying their data.
watch(
  () => routerInstance.currentRoute.value.fullPath,
  async (toPath, fromPath) => {
    await workspaceRouteSwitch.handleRouteChange(toPath, fromPath, {
      externalDataLoading: isLoadingExternalData.value,
    });
  }
);

// ========== 🔧 Step D: 路由导航 helper（替代 setFunctionMode/set*SubMode） ==========
/**
 * 通过 SubModeKey 进行路由导航（替代旧的 setFunctionMode/set*SubMode 写入口）
 *
 * @param toKey - 目标子模式键，如 'basic-system', 'pro-variable', 'image-text2image'
 * @param opts - 导航选项
 * @param opts.replace - 是否使用 router.replace 而非 router.push（默认 false）
 *
 * 使用场景：
 * - 历史记录恢复：navigateToSubModeKey(chain.functionMode + '-' + chain.subMode)
 * - 收藏使用：navigateToSubModeKey(favorite.functionMode + '-' + favorite.subMode)
 * - 任何需要切换模式/子模式的场景
 */
async function navigateToSubModeKey(
  toKey: SubModeKey,
  opts?: { replace?: boolean }
) {
  // SubModeKey 格式：'basic-system' | 'pro-variable' | 'image-text2image'
  const [mode, subMode] = toKey.split('-') as [
    FunctionMode,
    BasicSubMode | ProSubMode | ImageSubMode
  ]

  const path = toKey === 'arena' ? '/arena' : `/${mode}/${subMode}`
  const fromPath = routerInstance.currentRoute.value.fullPath

  if (opts?.replace) {
    await routerInstance.replace(path)
  } else {
    await routerInstance.push(path)
  }

  await workspaceRouteSwitch.run(routerInstance.currentRoute.value.fullPath, fromPath)
}

let initTimeoutId: number | null = null

const saveFailure = computed(() => {
  const key = sessionManager.getActiveSubModeKey()
  const activeFailure = sessionManager.saveFailures.get(key)
  return activeFailure ? [key, activeFailure] as const : sessionManager.saveFailures.entries().next().value
})

const autosave = useSessionAutosave({
  enabled: isReady,
  busy: computed(() => sessionManager.isSaving || sessionManager.isRestoring),
  subscribe: sessionManager.subscribeToSessionChanges,
  save: sessionManager.saveSubModeSessionWithStatus,
});

const warnBeforeUnload = (event: BeforeUnloadEvent) => {
  event.preventDefault()
  event.returnValue = true
}
watch(() => sessionManager.hasUnsavedSessions, unsaved => {
  if (unsaved) window.addEventListener('beforeunload', warnBeforeUnload)
  else window.removeEventListener('beforeunload', warnBeforeUnload)
}, { flush: 'sync' })

// Optional Web/PWA host API. No service worker or browser update state enters UI stores.
const arenaSession = useArenaSession();
const isWorkspaceBusy = () => !isReady.value || arenaSession.running ||
  hasSessionConflicts(services.value?.preferenceService) ||
  !!activeWorkspaceRef.value?.isUpdateBusy?.();
const prepareSessionRestore = async (): Promise<(() => void) | null> => {
  if (isWorkspaceBusy()) return null;
  const resume = await sessionManager.beginSessionRestore();
  if (isWorkspaceBusy()) { resume(); return null; }
  autosave.cancelPending();
  return resume;
};
const prepareForUpdate = createAppUpdatePreparation({
  isBusy: () => isWorkspaceBusy() || sessionManager.isRestoring || hasCompactModalLayers() ||
    modelManager.showConfig || templateManagerState.showTemplates || historyManager.showHistory ||
    showDataManager.value || showFavoriteManager.value || showSaveFavoriteDialog.value ||
    showVariableManager.value || showToolManager.value || showContextEditor.value,
  subscribeToChanges: sessionManager.subscribeToSessionChanges,
  flush: sessionManager.saveAllSessions,
});
defineExpose({ prepareForUpdate });

// ⚠️ 具名函数：pagehide 事件处理器（Codex 建议）
const handlePagehide = () => {
  // 注意：这里不能用 await，因为浏览器不会等异步完成
  sessionManager.saveAllSessions().catch(err => {
    console.error('[PromptOptimizerApp] Async save failed during pagehide:', err)
  })
}

// ⚠️ 具名函数：visibilitychange 事件处理器（Codex 建议）
const handleVisibilityChange = () => {
  if (document.visibilityState === 'hidden') {
    sessionManager.saveAllSessions().catch(err => {
      console.error('[PromptOptimizerApp] Save failed during visibilitychange:', err)
    })
  }
}

const refreshDataBackupReminder = () => {
  dataBackupReminderDue.value = isDataBackupReminderDue()
}

let stopDesktopSaveRequest: (() => void) | undefined
onMounted(() => {
  stopDesktopSaveRequest = window.electronAPI?.app?.onWorkspaceSaveRequest?.(async () => {
    await nextTick()
    if (sessionManager.isRestoring) return false
    if (!isReady.value && !sessionManager.hasUnsavedSessions) return true
    return await sessionManager.saveAllSessions() && !sessionManager.hasUnsavedSessions
  })
  // Route-level lazy loading can break after a new deployment when this tab is still running an old main bundle.
  // Prompt user to refresh instead of auto-reloading.
  if (typeof window !== 'undefined') {
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener(DATA_BACKUP_STATUS_EVENT, refreshDataBackupReminder);
    window.addEventListener('storage', refreshDataBackupReminder);
    refreshDataBackupReminder();
  }
  removeRouterErrorHandler = routerInstance.onError((error) => {
    if (!isChunkLoadFailure(error)) return;
    void promptRefreshForNewDeploy(error);
  });

  // ⚠️ 使用 watchEffect + 独立超时定时器（Codex 建议）
  const TIMEOUT = 10000 // 10秒超时

  // ⚠️ 避免 watchEffect 回调内 stopWatch() 的 TDZ 风险
  let stopWatch: (() => void) | null = null

  // 设置超时定时器
  initTimeoutId = window.setTimeout(() => {
    console.error('[PromptOptimizerApp] Timed out while initializing services')
    stopWatch?.()
  }, TIMEOUT)

  stopWatch = watchEffect(async () => {
    // 等待 services 和初始化完成
    if (!services.value || isInitializing.value) {
      return
    }

    // ⚠️ 防御性检查：确保 Pinia services 已注入（防止时序竞态）
    // 理论上 watch(services) 会先执行 setPiniaServices()，但这里添加二次确认
    const $services = getPiniaServices()
    if (!$services) {
      console.warn('[PromptOptimizerApp] Pinia services are not injected yet, but services.value already exists')
      console.warn('[PromptOptimizerApp] This may be a timing issue; waiting for the next cycle')
      // 不调用 stopWatch()，继续等待下一轮
      return
    }
    if (!$services.preferenceService) {
      // PreferenceService 还未就绪：继续等待，避免 restoreAllSessions() 直接返回导致默认值写回覆盖持久化内容
      return
    }

    // Services 和 Pinia 均已就绪，清除超时定时器并停止监听
    console.log('[PromptOptimizerApp] Services and Pinia are ready; starting session restore')
    if (initTimeoutId !== null) {
      window.clearTimeout(initTimeoutId)
      initTimeoutId = null
    }
    stopWatch?.()

    try {
      // hydrate all：避免未恢复的子模式在 saveAllSessions 时用默认空值覆盖持久化内容
      await sessionManager.restoreAllSessions()

      // 恢复到 UI
      await restoreSessionToUI()

      // 🔧 Codex 修复：标记首次恢复已完成，允许 watch 响应后续模式切换
      hasRestoredInitialState.value = true

      if (typeof window !== 'undefined') {
        window.addEventListener('pagehide', handlePagehide)

        // ⚠️ 额外的保险：visibilitychange hidden 时也触发一次保存
        document.addEventListener('visibilitychange', handleVisibilityChange)
      }
    } catch (error) {
      console.error('[PromptOptimizerApp] An error occurred during initialization:', error)
    } finally {
      // Ensure the app can render even if session restore fails.
      hasRestoredInitialState.value = true
    }
  })
})

// 应用卸载前清理并保存所有会话
onBeforeUnmount(async () => {
  stopDesktopSaveRequest?.()
  window.removeEventListener('beforeunload', warnBeforeUnload);
  isAppUnmounted = true;

  // 🔧 Codex 修复：设置卸载标志，阻止后续 microtask 执行恢复
  restoreCoordinator.markUnmounted();

  // ⚠️ 清除初始化超时定时器（Codex 建议：避免悬挂定时器）
  if (initTimeoutId !== null) {
    window.clearTimeout(initTimeoutId)
  }

  // ⚠️ Codex 建议：移除事件监听器，避免内存泄漏
  if (typeof window !== 'undefined') {
    window.removeEventListener('pagehide', handlePagehide)
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    window.removeEventListener(DATA_BACKUP_STATUS_EVENT, refreshDataBackupReminder)
    window.removeEventListener('storage', refreshDataBackupReminder)
    if (hasRegisteredGlobalHistoryRefresh) {
      window.removeEventListener(
        'prompt-optimizer:history-refresh',
        handleGlobalHistoryRefresh,
      )
      hasRegisteredGlobalHistoryRefresh = false
    }
  }

  removeRouterErrorHandler?.()
  removeRouterErrorHandler = null
 
  await sessionManager.saveAllSessions()
})
</script>

<style scoped>
.workspace-save-warning {
  flex: 0 0 auto;
  margin-bottom: 8px;
}

.active-button {
    background-color: var(--n-primary-color) !important;
    color: var(--n-text-color-primary) !important;
    border-color: var(--n-primary-color) !important;
}

.active-button:hover {
    background-color: var(--n-primary-color-hover) !important;
    border-color: var(--n-primary-color-hover) !important;
}

.loading-container {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 12px;
    height: 100vh;
    font-size: 1.2rem;
    color: var(--n-text-color);
    background-color: var(--n-body-color, var(--n-color));
}
</style>
