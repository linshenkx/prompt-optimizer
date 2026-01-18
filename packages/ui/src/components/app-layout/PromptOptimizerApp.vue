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
        :hljs="hljsInstance"
    >
        <div v-if="isInitializing" class="loading-container">
            <div class="spinner"></div>
            <p>{{ t("log.info.initializing") }}</p>
        </div>
        <div v-else-if="!services" class="loading-container error">
            <p>{{ t("toast.error.appInitFailed") }}</p>
        </div>
        <div v-else-if="!isReady" class="loading-container">
            <div class="spinner"></div>
            <p>{{ t("log.info.initializing") }}</p>
        </div>
        <template v-else>
            <MainLayoutUI>
                <!-- Title Slot -->
                <template #title>
                    {{ t("promptOptimizer.title") }}
                </template>

                <!-- Core Navigation Slot -->
                <template #core-nav>
                    <AppCoreNav />
                </template>

                <!-- Actions Slot -->
                <template #actions>
                    <AppHeaderActions
                        @open-templates="openTemplateManager"
                        @open-history="historyManager.showHistory = true"
                        @open-model-manager="modelManager.showConfig = true"
                        @open-favorites="showFavoriteManager = true"
                        @open-data-manager="showDataManager = true"
                        @open-github="openGithubRepo"
                    />
                </template>
                <template #main>
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
                v-if="isReady"
                v-model:show="modelManager.showConfig"
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
                @imported="handleDataImported"
            />

            <!-- 收藏管理对话框 -->
            <FavoriteManagerUI
                v-if="isReady"
                :show="showFavoriteManager"
                @update:show="
                    (v: boolean) => {
                        if (!v) showFavoriteManager = false;
                    }
                "
                @optimize-prompt="handleFavoriteOptimizePrompt"
                @use-favorite="handleUseFavorite"
            />

            <!-- 保存收藏对话框 -->
            <SaveFavoriteDialog
                v-if="isReady"
                v-model:show="showSaveFavoriteDialog"
                :content="saveFavoriteData?.content || ''"
                :original-content="saveFavoriteData?.originalContent || ''"
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

            <!-- 🆕 AI 变量提取结果对话框 -->
            <VariableExtractionResultDialog
                v-if="isReady"
                v-model:show="variableExtraction.showResultDialog.value"
                :result="variableExtraction.extractionResult.value"
                @confirm="variableExtraction.confirmBatchCreate"
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

            <!-- 评估结果面板 -->
            <EvaluationPanel
                v-if="isReady"
                v-model:show="evaluation.isPanelVisible.value"
                :is-evaluating="evaluation.state.activeDetailType ? evaluation.state[evaluation.state.activeDetailType].isEvaluating : false"
                :result="evaluation.activeResult.value"
                :stream-content="evaluation.activeStreamContent.value"
                :error="evaluation.activeError.value"
                :current-type="evaluation.state.activeDetailType"
                :score-level="evaluation.activeScoreLevel.value"
                @re-evaluate="handleReEvaluate"
                @apply-local-patch="handleApplyLocalPatch"
                @apply-improvement="handleApplyImprovement"
            />

            <!-- 关键:使用NGlobalStyle同步全局样式到body,消除CSS依赖 -->
            <NGlobalStyle />
        </template>
    </NConfigProvider>
</template>

<script setup lang="ts">
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
import { router as routerInstance } from '../../router';
import { useI18n } from "vue-i18n";
import {
    NConfigProvider,
    NGlobalStyle,
} from "naive-ui";
import hljs from "highlight.js/lib/core";
import jsonLang from "highlight.js/lib/languages/json";
hljs.registerLanguage("json", jsonLang);

// 内部组件导入
import MainLayoutUI from '../MainLayout.vue'
import ModelManagerUI from '../ModelManager.vue'
import TemplateManagerUI from '../TemplateManager.vue'
import HistoryDrawerUI from '../HistoryDrawer.vue'
import DataManagerUI from '../DataManager.vue'
import FavoriteManagerUI from '../FavoriteManager.vue'
import SaveFavoriteDialog from '../SaveFavoriteDialog.vue'
import VariableManagerModal from '../variable/VariableManagerModal.vue'
import { VariableExtractionResultDialog } from '../variable-extraction'
import ToolManagerModal from '../tool/ToolManagerModal.vue'
import ContextEditor from '../context-mode/ContextEditor.vue'
import PromptPreviewPanel from '../PromptPreviewPanel.vue'
import AppHeaderActions from './AppHeaderActions.vue'
import AppCoreNav from './AppCoreNav.vue'
import EvaluationPanel from '../evaluation/EvaluationPanel.vue'

// Composables - 使用 barrel exports
import {
    // 提示词相关
    usePromptOptimizer,
    usePromptHistory,
    usePromptPreview,
    usePromptTester,
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
    useVariableExtraction,
    useTemporaryVariables,
    // UI 相关
    useToast,
    useNaiveTheme,
     // 系统相关
     useAppInitializer,
     useTemplateManager,
     useEvaluationHandler,
     provideEvaluation,
    // App 级别
    useAppHistoryRestore,
    useAppFavorite,
} from '../../composables'

// i18n functions
import { initializeI18nWithStorage, setI18nServices } from '../../plugins/i18n'

// Pinia functions
import { setPiniaServices, getPiniaServices } from '../../plugins/pinia'
// ⚠️ Codex 建议：改用直接路径导入，避免 barrel exports 循环依赖导致 TDZ
import { useSessionManager, type SubModeKey } from '../../stores/session/useSessionManager'
import { useBasicSystemSession } from '../../stores/session/useBasicSystemSession'
import { useBasicUserSession } from '../../stores/session/useBasicUserSession'
import { useProMultiMessageSession } from '../../stores/session/useProMultiMessageSession'
import { useProVariableSession } from '../../stores/session/useProVariableSession'
import { useSessionRestoreCoordinator } from '../../composables/session/useSessionRestoreCoordinator'
import { useImageText2ImageSession } from '../../stores/session/useImageText2ImageSession'
import { useImageImage2ImageSession } from '../../stores/session/useImageImage2ImageSession'
import { useGlobalSettings } from '../../stores/settings/useGlobalSettings'

import type { TemplateManagerTemplateType } from '../../composables/prompt/useTemplateManager'

// Data Transformation
import { DataTransformer } from '../../utils/data-transformer'

// Types
import type { ModelSelectOption, TestAreaPanelInstance } from '../../types'
import { applyPatchOperationsToText, type IPromptService, type PromptRecordChain, type PatchOperation, type Template, type TemplateType, type FunctionMode, type BasicSubMode, type ProSubMode, type ImageSubMode, type OptimizationMode, type ConversationMessage, type ToolDefinition, type ContextEditorState, type ContextMode, type EvaluationType } from "@prompt-optimizer/core";

// 1. 基础 composables
const hljsInstance = hljs;
const i18n = useI18n();
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const t = i18n.t;  // 在模板中使用
const toast = useToast();

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

    const ok = window.confirm(t('toast.warning.chunkLoadRefreshConfirm'));
    if (!ok) {
      toast.warning(t('toast.warning.chunkLoadRefreshDeclined'), 8000);
      return;
    }

    try {
      await sessionManager.saveAllSessions();
    } catch (e) {
      console.warn('[PromptOptimizerApp] saveAllSessions failed before refresh:', e);
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
const { services, isInitializing } = useAppInitializer();

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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const basicSubModeApi = useBasicSubMode(services);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const proSubModeApi = useProSubMode(services);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const imageSubModeApi = useImageSubMode(services);

// 3.5. 🔧 Step A: 建立路由驱动的单一真源（优先于 state，避免双真源）
//
// ⚠️ 注意：PromptOptimizerApp 不在 RouterView 上下文中，无法使用 useRoute/useRouter
// 解决方案：直接导入 router 实例，使用 currentRoute 访问路由状态
// ⚠️ 重要：computed 只做纯解析，纠错逻辑移到独立的 watch（避免循环导航）
//
// 纯解析函数：从路由路径提取模式和子模式
const parseRouteInfo = () => {
  const currentRoute = routerInstance.currentRoute.value
  const path = currentRoute.path
  const subMode = path.split('/')[2]

  // 解析 functionMode
  let functionMode: 'basic' | 'pro' | 'image' = 'basic'
  if (path.startsWith('/basic')) functionMode = 'basic'
  else if (path.startsWith('/pro')) functionMode = 'pro'
  else if (path.startsWith('/image')) functionMode = 'image'
  else if (path === '/' || path === '') functionMode = 'basic'  // 根路径默认

  // 解析子模式（带白名单验证）
  const parseSubMode = (
    mode: 'basic' | 'pro' | 'image',
    subModeParam: string | undefined
  ): { subMode: string; isValid: boolean; canonicalSubMode: string } => {
    const validSubModes: Record<string, string[]> = {
      basic: ['system', 'user'],
      pro: ['multi', 'variable'],  // ✅ pro 模式支持 multi 和 variable
      image: ['text2image', 'image2image'],
    }

    const allowed = validSubModes[mode] || []
    const isValid = subModeParam !== undefined && allowed.includes(subModeParam)

    // ✅ 移除错误的兼容性映射，直接使用原始 subMode
    let canonicalSubMode = subModeParam || ''

    // 默认值（仅在 subModeParam 为空或非法时使用）
    if (!canonicalSubMode || !isValid) {
      if (mode === 'image') canonicalSubMode = 'text2image'
      else if (mode === 'pro') canonicalSubMode = 'variable'
      else canonicalSubMode = 'system'
    }

    return { subMode: canonicalSubMode, isValid, canonicalSubMode }
  }

  const subModeInfo = parseSubMode(functionMode, subMode)

  return {
    functionMode,
    basicSubMode:
      (functionMode === 'basic' ? subModeInfo.canonicalSubMode : 'system') as 'system' | 'user',
    proSubMode:
      (functionMode === 'pro' ? subModeInfo.canonicalSubMode : 'variable') as 'multi' | 'variable',
    imageSubMode:
      (functionMode === 'image' ? subModeInfo.canonicalSubMode : 'text2image') as 'text2image' | 'image2image',
    isValid: subModeInfo.isValid,
    canonicalPath: `/${functionMode}/${subModeInfo.canonicalSubMode}`,
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
  () => {
    const globalSettings = useGlobalSettings()
    if (!globalSettings.hasRestored) return

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
const isLoadingExternalData = ref(false);

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
const setWorkspaceRef = (instance: unknown, routeName: WorkspaceRouteName) => {
    const resolvedInstance = instance ?? null;

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
const testContent = ref("");
const isCompareMode = ref(true);

// Naive UI 主题配置
const { naiveTheme, themeOverrides, initTheme } = useNaiveTheme();

// 初始化主题系统
if (typeof window !== "undefined") {
    initTheme();
}

// 变量管理状态
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
    handleCancel: handleContextEditorCancel,
} = useContextEditorUIState(showContextEditor, t);

const contextEditorState = ref({
    messages: [] as ConversationMessage[],
    tools: [] as ToolDefinition[],
    showVariablePreview: true,
    showToolManager: false,
    mode: "edit" as "edit" | "preview",
});

// 提示词预览面板状态
const showPreviewPanel = ref(false);

// 变量管理器实例
const variableManager = useVariableManager(services);

// 🆕 临时变量管理器（全局单例，用于AI提取的变量）
const tempVarsManager = useTemporaryVariables();

// 🆕 AI 智能变量提取
const variableExtraction = useVariableExtraction(
    services,
    (variableName: string, variableValue: string) => {
        // 创建变量时的回调：保存到临时变量（不持久化）
        tempVarsManager.setVariable(variableName, variableValue);
    },
    (replacedPrompt: string) => {
        // 替换提示词回调：更新 ContextUser 工作区的提示词内容
        userWorkspaceRef.value?.setPrompt?.(replacedPrompt);
    }
);

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

// 🆕 AI 变量提取处理函数
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const handleExtractVariables = async (
    promptContent: string,
    extractionModelKey: string
) => {
    const existingVariableNames = Object.keys(
        variableManager.customVariables.value || {}
    );

    await variableExtraction.extractVariables(
        promptContent,
        extractionModelKey,
        existingVariableNames
    );
};

// 工具管理器处理函数
const handleToolManagerConfirm = (tools?: ToolDefinition[]) => {
    optimizationContextTools.value = tools ?? [];
    showToolManager.value = false;
};

// 6. 在顶层调用所有 Composables
const modelSelectRefs = useModelSelectRefs();
const modelManager = useModelManager(services, modelSelectRefs);
const functionModelManager = useFunctionModelManager(services);

// ========== Session Store（单一真源：可持久化字段） ==========
// 注意：这里需要在 optimizer 创建之前初始化，以便把基础模式字段直绑到 session store
const basicSystemSession = useBasicSystemSession();
const basicUserSession = useBasicUserSession();
const proMultiMessageSession = useProMultiMessageSession();
const proVariableSession = useProVariableSession();
const imageText2ImageSession = useImageText2ImageSession();
const imageImage2ImageSession = useImageImage2ImageSession();

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
const handleContextEditorSave = contextManagement.handleContextEditorSave;
const handleContextEditorStateUpdate = contextManagement.handleContextEditorStateUpdate;

const handleContextEditorStateUpdateSafe = (state?: ContextEditorState) => {
    if (!state) return;
    void handleContextEditorStateUpdate(state);
};

const handleContextEditorSaveSafe = (context?: {
    messages: ConversationMessage[];
    variables: Record<string, string>;
    tools: ToolDefinition[];
}) => {
    if (!context) return;
    void handleContextEditorSave(context);
};
const handleContextModeChange = contextManagement.handleContextModeChange;

// 提供依赖给子组件
provide("variableManager", variableManager);
provide("optimizationContext", optimizationContext);
provide("optimizationContextTools", optimizationContextTools);

// 基础模式提示词测试
const promptTester = usePromptTester(
    services,
    selectedTestModelKey,
    selectedOptimizationMode,
    variableManager
);

// 测试结果引用
const testResults = computed(() => promptTester.testResults);

// 🔧 Step E: 使用 route-computed 代替旧 state
const currentSubMode = computed(() => {
    if (routeFunctionMode.value === 'basic') return routeBasicSubMode.value;
    if (routeFunctionMode.value === 'pro') return routeProSubMode.value;
    if (routeFunctionMode.value === 'image') return routeImageSubMode.value;
    return 'system';
});

// 计算当前版本的迭代需求（用于 prompt-iterate 类型的重新评估）
const currentIterateRequirement = computed(() => {
    const versions = optimizer.currentVersions;
    const versionId = optimizer.currentVersionId;
    if (!versions || versions.length === 0 || !versionId) return '';
    const currentVersion = versions.find(
        (v: { id: string; iterationNote?: string }) => v.id === versionId,
    );
    return currentVersion?.iterationNote || '';
});

const evaluationHandler = useEvaluationHandler({
    services,
    originalPrompt: basicSessionPrompt,
    optimizedPrompt: basicSessionOptimizedPrompt,
    testContent,
    testResults,
    evaluationModelKey: computed(() => functionModelManager.effectiveEvaluationModel.value),
    // 🔧 Step E: 使用 route-computed 代替旧 state
    functionMode: routeFunctionMode,
    subMode: currentSubMode,
    currentIterateRequirement,
});

const { evaluation, handleReEvaluate: handleReEvaluateBasic } = evaluationHandler;

// 提供评估上下文给子组件
provideEvaluation(evaluation);

// ========== Session Store 状态同步 ==========

// 🔧 Step E: 使用 route-computed 代替旧 state
const getCurrentSession = () => {
    if (routeFunctionMode.value === 'basic') {
        return routeBasicSubMode.value === 'system' ? basicSystemSession : basicUserSession;
    } else if (routeFunctionMode.value === 'pro') {
        return routeProSubMode.value === 'multi' ? proMultiMessageSession : proVariableSession;
    } else if (routeFunctionMode.value === 'image') {
        return routeImageSubMode.value === 'text2image' ? imageText2ImageSession : imageImage2ImageSession;
    }
    return basicSystemSession;
};

const getCurrentBasicSession = () =>
    routeBasicSubMode.value === 'system' ? basicSystemSession : basicUserSession;

const getCurrentImageSession = () =>
    routeImageSubMode.value === 'text2image'
        ? imageText2ImageSession
        : imageImage2ImageSession;

/**
 * 🔧 方案 A 修复：恢复 Basic 模式的 session 状态（移除冗余赋值）
 *
 * 设计原则：
 * - Basic 模式的核心状态（prompt/optimizedPrompt/reasoning/chainId/versionId）
 *   已通过 computed 绑定到 session store（单一真源），无需手动赋值
 * - 只恢复未绑定的 UI 状态（testContent/modelManager/isCompareMode/testResults）
 *
 * 根因分析：
 * - 旧逻辑手动赋值 optimizer.prompt 等字段，破坏了"单一真源"架构
 * - 导致模式切换时，旧模式的 UI 状态可能通过 watch 污染新模式的 session store
 */
const restoreBasicOrProVariableSession = () => {
    if (routeFunctionMode.value !== 'basic') return;
    const session = getCurrentBasicSession();

    // ✅ 核心状态（prompt/optimizedPrompt/reasoning/chainId/versionId）
    // 已通过 basicSessionPrompt 等 computed 绑定，自动从 session store 读取，无需手动赋值

    // ✅ 恢复未绑定的 UI 状态
    testContent.value = session.testContent || '';

    // 恢复对比模式
    isCompareMode.value = session.isCompareMode;

    // 🔧 恢复测试结果（仅 Basic 模式使用 promptTester）
    // 只恢复稳定字段，不恢复 isTesting* 临时状态
    if (session.testResults) {
        promptTester.testResults.originalResult =
            session.testResults.originalResult || '';
        promptTester.testResults.originalReasoning =
            session.testResults.originalReasoning || '';
        promptTester.testResults.optimizedResult =
            session.testResults.optimizedResult || '';
        promptTester.testResults.optimizedReasoning =
            session.testResults.optimizedReasoning || '';
        // 重置测试中状态
        promptTester.testResults.isTestingOriginal = false;
        promptTester.testResults.isTestingOptimized = false;
    } else {
        // 如果 session 中没有测试结果，清空当前测试结果
        promptTester.testResults.originalResult = '';
        promptTester.testResults.originalReasoning = '';
        promptTester.testResults.optimizedResult = '';
        promptTester.testResults.optimizedReasoning = '';
        promptTester.testResults.isTestingOriginal = false;
        promptTester.testResults.isTestingOptimized = false;
    }
};

/**
 * 🔧 方案 A 修复：Pro-user（变量模式）会话恢复（移除冗余赋值）
 *
 * 设计原则：
 * - Pro-user 使用 ContextUserWorkspace 内部的 useContextUserOptimization 状态树
 * - 核心状态（prompt/optimizedPrompt/reasoning/chainId/versionId）
 *   已通过 computed 绑定到 proVariableSession（单一真源），无需手动赋值
 * - 只恢复未绑定的 UI 状态（testContent/isCompareMode）和过程态重置
 *
 * 根因分析：
 * - 旧逻辑手动赋值 contextUserOptimization.prompt 等字段，破坏了"单一真源"架构
 * - 导致模式切换时，旧模式的 UI 状态可能通过 watch 污染新模式的 session store
 */
const restoreProVariableSessionToUserWorkspace = async () => {
    // ✅ 核心状态（prompt/optimizedPrompt/reasoning/chainId/versionId）
    // 已通过 sessionPrompt 等 computed 绑定到 proVariableSession，无需手动赋值

    // ✅ 恢复未绑定的 UI 状态
    testContent.value = proVariableSession.testContent || '';
    isCompareMode.value = proVariableSession.isCompareMode;

    // 等待 DOM 更新，确保 ContextUserWorkspace 已挂载并建立 ref
    await nextTick();

    let contextUserOptimization = userWorkspaceRef.value?.contextUserOptimization;
    if (!contextUserOptimization) {
        // 防御性重试：部分切换路径下首次 nextTick 可能仍未建立 ref
        await nextTick();
        contextUserOptimization = userWorkspaceRef.value?.contextUserOptimization;
        if (!contextUserOptimization) return;
    }

    // ✅ 只恢复非绑定字段
    // currentVersions 需要从历史记录重新拉取
    contextUserOptimization.currentVersions = [];

    // 重置过程态（避免恢复后停留在 loading）
    contextUserOptimization.isOptimizing = false;
    contextUserOptimization.isIterating = false;

    // 尝试从历史记录恢复版本列表
    const historyManager = services.value?.historyManager;
    const chainId = proVariableSession.chainId || '';
    if (historyManager && chainId) {
        try {
            const chain = await historyManager.getChain(chainId);
            contextUserOptimization.currentVersions = chain.versions;
            // currentVersionId 已通过 binding 绑定，无需手动赋值
        } catch (error) {
            console.warn('[PromptOptimizerApp] Pro-user 恢复链失败，使用 session 快照继续:', error);
        }
    }
};

/**
 * 🔧 方案 A 修复：恢复 Pro-system 模式的 session 状态（移除冗余赋值）
 *
 * 设计原则：
 * - Pro-system 模式使用 useConversationOptimization 的状态树（不是 optimizer）
 * - 核心状态（optimizedPrompt/reasoning/chainId/versionId/selectedMessageId）
 *   已通过 computed 绑定到 proMultiMessageSession（单一真源），无需手动赋值
 * - 只恢复未绑定的 UI 状态（modelManager/isCompareMode/optimizationContext）
 *
 * 根因分析：
 * - 旧逻辑错误地赋值给 optimizer，但 Pro-system 实际使用 conversationOptimization
 * - 这导致 optimizer 的 watch 触发，可能污染其他模式的 session store
 */
const restoreProMultiMessageSession = async () => {
    const session = proMultiMessageSession;
    const savedState = session.$state;

    // ✅ 核心状态（optimizedPrompt/reasoning/chainId/versionId/selectedMessageId）
    // 已通过 useConversationOptimization 的 computed 绑定到 session.state，无需手动赋值

    // ✅ 恢复未绑定的 UI 状态
    // 恢复对比模式
    isCompareMode.value = savedState.isCompareMode;

    // 恢复对话消息列表（Pro 多消息专有字段）
    if (savedState.conversationMessagesSnapshot && savedState.conversationMessagesSnapshot.length > 0) {
        optimizationContext.value = [...savedState.conversationMessagesSnapshot];
    }

    // 🔧 Codex 修复：等待 DOM 更新，确保子组件 ref 已建立
    await nextTick();

    // 🔧 Codex 修复：显式恢复 conversationOptimization 的状态（selectedMessageId 和 messageChainMap）
    // 确保在 session restore 完成后再调用，避免时序问题
    // 通过子组件 ref 调用（子组件已在 defineExpose 中暴露此方法）
    systemWorkspaceRef.value?.restoreConversationOptimizationFromSession?.();
};

/**
 * 🔧 方案 A 修复：恢复 Image 模式的 session 状态（移除所有冗余赋值）
 *
 * 设计原则：
 * - Image 模式使用独立的 Session Store（完全不涉及 optimizer）
 * - 所有状态（originalPrompt/optimizedPrompt/reasoning/chainId/versionId/isCompareMode等）
 *   已通过 computed 绑定到 imageText2ImageSession/imageImage2ImageSession（单一真源）
 * - ImageWorkspace 是完全独立的组件，状态由自身管理
 *
 * 根因分析：
 * - 旧逻辑错误地赋值给 optimizer，但 Image 模式根本不使用 optimizer
 * - 这导致 optimizer 的 watch 触发，污染 Basic 模式的 session store（因为切换后 getCurrentSession 返回新模式）
 * - 即使恢复 isCompareMode，也已通过 ImageWorkspace 的 computed 自动同步，无需手动赋值
 *
 * 结论：
 * - Image 模式的所有状态由 ImageWorkspace 独立管理，此函数无需做任何操作
 */
const restoreImageSession = () => {
    // ✅ Image 模式的所有状态已通过 ImageWorkspace 的 computed 绑定到 session store
    // 无需任何手动恢复操作，状态会自动从 session store 读取
};

/**
 * 从 session store 恢复状态到 UI（内部实现）
 * 🔧 Codex 修复：按 mode/subMode 分支调用对应的恢复函数，避免调用不存在的方法
 *
 * 注意：这是内部实现，不包含互斥控制逻辑
 * 互斥控制由 useSessionRestoreCoordinator 处理
 */
// 🔧 Step E: 使用 route-computed 代替旧 state
const restoreSessionToUIInternal = async () => {
    if (routeFunctionMode.value === 'basic') {
        // Basic 模式：使用通用恢复逻辑
        restoreBasicOrProVariableSession();
    } else if (routeFunctionMode.value === 'pro' && routeProSubMode.value === 'variable') {
        // Pro-variable（变量模式）：恢复到 ContextUserWorkspace
        await restoreProVariableSessionToUserWorkspace();
    } else if (routeFunctionMode.value === 'pro' && routeProSubMode.value === 'multi') {
        // Pro-multi（多消息模式）：使用专用恢复逻辑（异步，等待 DOM 更新）
        await restoreProMultiMessageSession();
    } else if (routeFunctionMode.value === 'image') {
        // Image 模式：使用专用恢复逻辑
        restoreImageSession();
    }
};

// 🔧 架构优化：使用 session 恢复协调器
// 负责处理互斥锁、pending 重试、卸载检查等协调逻辑
const restoreCoordinator = useSessionRestoreCoordinator(restoreSessionToUIInternal);

// 对外暴露的恢复函数（带协调逻辑）
const restoreSessionToUI = restoreCoordinator.executeRestore;

// 🔧 Codex 修复：watch 只负责模式切换后的恢复（不负责首次恢复）
// 首次恢复由 onMounted watchEffect 负责，避免双入口冲突
// 🔧 Step E: 使用 route-computed 代替旧 state
watch(
    [isReady, () => routeFunctionMode.value, () => routeBasicSubMode.value, () => routeProSubMode.value],
    async ([ready]) => {
        // 🔧 只在已完成首次恢复后才响应模式切换
        if (!ready || !hasRestoredInitialState.value) return;

        // 🔧 外部数据加载中不响应模式切换（防止 session restore 覆盖外部数据）
        if (isLoadingExternalData.value) return;

        try {
            await restoreSessionToUI();
        } catch (error) {
            // 🔧 错误处理：避免未处理的 Promise rejection 传播到 Vue
            console.error('[PromptOptimizerApp] 模式切换后恢复会话失败:', error);
        }
    },
    { immediate: false }  // 🔧 改为 false，不在 watch 创建时立即执行
);

// 同步 prompt 变化到 session store
// 🔧 方案 A 修复：严格限制在 Basic 模式，避免跨模式污染
// 根本原因：optimizer.prompt 已通过 computed 绑定到 session store（单一真源）
// - Basic 模式：optimizer.prompt ↔ basicSessionPrompt ↔ session.prompt
// - Pro/Image 模式：不使用 optimizer.prompt，但 watch 仍会触发并错误写入
watch(
    () => optimizer.prompt,
    (newPrompt) => {
        if (sessionManager.isSwitching) return;

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
        if (session && !sessionManager.isSwitching) {
            session.updateOptimizedResult({
                optimizedPrompt: newOptimizedPrompt || '',
                reasoning: newReasoning || '',
                chainId: newChainId || '',
                versionId: newVersionId || '',
            });
        }
    }
);

// 同步测试结果到 session store
// 🔧 Codex 修复：Image 模式没有 updateTestResults 方法，需要分支处理
// 🔧 使用 deep: true 捕获深层变化（如 originalResult += token）
// 🔧 过滤掉 isTesting* 临时状态，只持久化稳定字段
// 🔧 修复：移除提前的 same value 检查，让 session store 自己处理（避免初始化时的空对象被跳过）
watch(
    () => promptTester.testResults,
    (newTestResults) => {
        if (sessionManager.isSwitching) return;

        // 仅 Basic 模式使用 promptTester（其他模式有各自的测试器/工作区）
        if (routeFunctionMode.value !== 'basic') return;

        // 只保存稳定字段，不保存 isTesting* 临时状态
        const stableResults = newTestResults
            ? {
                  originalResult: newTestResults.originalResult || '',
                  originalReasoning: newTestResults.originalReasoning || '',
                  optimizedResult: newTestResults.optimizedResult || '',
                  optimizedReasoning: newTestResults.optimizedReasoning || '',
              }
            : null;
        // 🔧 直接调用，让 session store 的 updateTestResults 方法自己处理 same value 检查
        getCurrentBasicSession().updateTestResults(stableResults);
    },
    { deep: true }  // 🔧 启用深层监听，捕获 streaming 写入等深层变化
);

/*
// 同步优化模型选择到 session store（已废弃：模型选择以 Session Store 为唯一真源）
// 🔧 Codex 修复：Image 模式使用 updateTextModel，Basic 模式使用 updateOptimizeModel
// 🔧 清理：Pro 模式的模型选择已由各 workspace/controller 直接管理，不在此处写入
watch(
    () => modelManager.selectedOptimizeModel,
    (newModel) => {
        if (sessionManager.isSwitching) return;

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
        if (sessionManager.isSwitching) return;

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
        if (sessionManager.isSwitching) return;
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
        if (sessionManager.isSwitching) return;
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

// 同步测试内容到 session store（用于刷新/切换后保留测试输入）
// 🔧 清理：Pro 模式的测试内容已由 workspace 内部管理
watch(
    testContent,
    (newContent) => {
        if (sessionManager.isSwitching) return;
        if (!hasRestoredInitialState.value) return;

        // 🔧 仅 Basic 模式使用此 testContent
        // Image 模式没有 testContent；Pro 模式已由 workspace 内部管理
        if (routeFunctionMode.value === 'image') return;
        if (routeFunctionMode.value === 'pro') return;

        getCurrentBasicSession().updateTestContent(newContent || '');
    },
    { flush: 'sync' }
);

// 同步对比模式到 session store
// 🔧 清理：Pro 模式的对比模式已由 workspace/controller 直接管理
watch(
    isCompareMode,
    (newMode) => {
        // 🔧 Pro 模式的对比模式已由 workspace/controller 持久化到 session store
        if (routeFunctionMode.value === 'pro') return;

        if (routeFunctionMode.value === 'basic') {
            getCurrentBasicSession().toggleCompareMode(newMode);
            return;
        }
        if (routeFunctionMode.value === 'image') {
            getCurrentImageSession().toggleCompareMode(newMode);
        }
    }
);

// ========== Pro 多消息模式特有状态同步 ==========
// 🔧 已清理：optimizationContext 现在由 ProWorkspaceContainer 直接管理
// 避免在 App 层写入导致双写或污染（刷新后易写入空值）

// 同步 contextManagement 中的 contextMode 到 App 层（不驱动路由）
watch(
    contextManagement.contextMode,
    async (newMode) => {
        // Context 子模式切换时：关闭并清理评估状态，避免残留
        evaluation.closePanel();
        evaluation.clearAllResults();

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

const servicesForHistoryRestore = computed(() =>
    services.value ? { historyManager: services.value.historyManager } : null,
);

const SUB_MODE_KEYS: ReadonlyArray<SubModeKey> = [
    "basic-system",
    "basic-user",
    "pro-multi",
    "pro-variable",
    "image-text2image",
    "image-image2image",
];

const navigateToSubModeKeyCompat = (
    toKey: string,
    opts?: { replace?: boolean },
) => {
    if (!SUB_MODE_KEYS.includes(toKey as SubModeKey)) return;
    navigateToSubModeKey(toKey as SubModeKey, opts);
};

const optimizerPrompt = computed<string>({
    get: () => (typeof optimizer.prompt === "string" ? optimizer.prompt : ""),
    set: (value) => {
        optimizer.prompt = value;
    },
});

// App 级别历史记录恢复
const { handleHistoryReuse } = useAppHistoryRestore({
    services: servicesForHistoryRestore,
    navigateToSubModeKey: navigateToSubModeKeyCompat,  // 🔧 Step D: 替代旧的 setFunctionMode/set*SubMode
    handleContextModeChange,
    handleSelectHistory: promptHistory.handleSelectHistory,
    optimizationContext,
    systemWorkspaceRef,
    userWorkspaceRef,
    t,
    isLoadingExternalData,
});

// App 级别收藏管理
const {
    showFavoriteManager,
    showSaveFavoriteDialog,
    saveFavoriteData,
    handleSaveFavorite,
    handleSaveFavoriteComplete,
    handleFavoriteOptimizePrompt,
    handleUseFavorite,
} = useAppFavorite({
    navigateToSubModeKey: navigateToSubModeKeyCompat,  // 🔧 Step D: 替代旧的 setFunctionMode/set*SubMode
    handleContextModeChange,
    optimizerPrompt,
    t,
    isLoadingExternalData,
});

provide("handleSaveFavorite", handleSaveFavorite);

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
            case "image-iterate":
                return routeImageSubMode.value === "image2image"
                    ? imageImage2ImageSession
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
        textModelOptions.value = DataTransformer.modelsToSelectOptions(enabledModels);

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
    if (!newServices) return;

    promptService.value = newServices.promptService;
    await initializeContextPersistence();

    // 等待基于 globalSettings 的初始路由初始化完成（避免根路径时读取到错误的 routeFunctionMode）
    if (_routeInitInFlight) {
        await _routeInitInFlight;
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

    const handleGlobalHistoryRefresh = () => {
        promptHistory.initHistory();
    };
    window.addEventListener(
        "prompt-optimizer:history-refresh",
        handleGlobalHistoryRefresh,
    );
});

// 8. 处理数据导入成功后的刷新
const handleDataImported = () => {
    useToast().success(t("dataManager.import.successWithRefresh"));
    setTimeout(() => {
        window.location.reload();
    }, 1500);
};

// 处理应用评估改进建议
const _basicApplyImprovement = evaluationHandler.createApplyImprovementHandler(basicModeWorkspaceRef);
const getActiveContextWorkspace = (): ContextWorkspaceExpose | null => {
    if (contextMode.value === 'system') return systemWorkspaceRef.value;
    if (contextMode.value === 'user') return userWorkspaceRef.value;
    return null;
};

const handleApplyImprovement = (payload: { improvement: string; type: EvaluationType }) => {
    // 关闭评估面板
    evaluation.closePanel();

    if (routeFunctionMode.value === 'pro') {
        const workspace = getActiveContextWorkspace();
        if (!workspace?.openIterateDialog) {
            // 这里按产品约定属于异常：Context 模式必须可以应用改进建议
            console.error('[PromptOptimizerApp] Context apply-improvement handler missing openIterateDialog');
            toast.error(t('toast.error.optimizeProcessFailed'));
            return;
        }
        workspace.openIterateDialog(payload.improvement);
        return;
    }

    _basicApplyImprovement(payload);
};

const handleApplyLocalPatch = async (payload: { operation: PatchOperation }) => {
    if (!payload.operation) return;

    if (routeFunctionMode.value === 'pro') {
        const workspace = getActiveContextWorkspace();
        if (!workspace?.applyLocalPatch) {
            toast.error(t('toast.error.optimizeProcessFailed'));
            return;
        }
        workspace.applyLocalPatch(payload.operation);
        return;
    }

    // basic 模式：直接覆盖当前 optimizedPrompt（不自动创建新版本）
    // 用户可通过"保存修改"按钮显式保存为新版本
    const current = optimizer.optimizedPrompt || '';
    const result = applyPatchOperationsToText(current, payload.operation);
    if (!result.ok) {
        toast.warning(t('toast.warning.patchApplyFailed'));
        console.warn('[PromptOptimizerApp] Local patch apply failed:', result.report);
        return;
    }
    optimizer.optimizedPrompt = result.text;
    toast.success(t('evaluation.diagnose.applyFix'));
};

// 处理重新评估：始终使用当前模式/工作区的最新状态
const handleReEvaluate = async (): Promise<void> => {
    if (routeFunctionMode.value === 'pro') {
        const workspace = getActiveContextWorkspace();
        if (!workspace?.reEvaluateActive) {
            // 这里按产品约定属于异常：Context 模式必须可以重新评估当前内容
            console.error('[PromptOptimizerApp] Context re-evaluate handler missing reEvaluateActive');
            toast.error(t('toast.error.optimizeProcessFailed'));
            return;
        }
        await workspace.reEvaluateActive();
        return;
    }

    await handleReEvaluateBasic();
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
                if (newOptimizationMode === "system") {
                    optimizationContext.value = [
                        { role: "system", content: "{{currentPrompt}}" },
                        { role: "user", content: "{{userQuestion}}" },
                    ];
                } else if (newOptimizationMode === "user") {
                    optimizationContext.value = [
                        { role: "user", content: "{{currentPrompt}}" },
                    ];
                }
            }
        }
    },
    { immediate: false },
);

// 打开GitHub仓库
const openGithubRepo = async () => {
    const url = "https://github.com/linshenkx/prompt-optimizer";

    if (typeof window !== "undefined" && window.electronAPI?.shell) {
        try {
            await window.electronAPI.shell.openExternal(url);
        } catch (error) {
            console.error("Failed to open external URL in Electron:", error);
            window.open(url, "_blank");
        }
    } else {
        window.open(url, "_blank");
    }
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

    // TemplateManager 目前不支持 evaluation 分类，回退到基础的系统/用户优化模板管理
    if (templateType === "evaluation") {
        return selectedOptimizationMode.value === "system"
            ? "optimize"
            : "userOptimize";
    }

    return templateType;
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
        window.dispatchEvent(new Event("image-workspace-refresh-templates"));
    }
};

// 提供 openModelManager 接口
const openModelManager = (tab: "text" | "image" | "function" = "text") => {
    modelManager.showConfig = true;
    setTimeout(() => {
        if (typeof window !== "undefined") {
            window.dispatchEvent(
                new CustomEvent("model-manager:set-tab", { detail: tab }),
            );
        }
    }, 0);
};
provide("openModelManager", openModelManager);

// 模型管理器关闭回调
const handleModelManagerClosed = async () => {
    try {
        modelManager.handleModelManagerClose();
    } catch (e) {
        console.warn("[PromptOptimizerApp] Failed to refresh text models after manager close:", e);
    }
    await refreshTextModels();
    if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("basic-workspace-refresh-text-models"));
        window.dispatchEvent(new Event("image-workspace-refresh-text-models"));
        window.dispatchEvent(new Event("image-workspace-refresh-image-models"));
    }
};

// ========== Session Management ==========
/**
 * 🔧 开发规范（防止回归）：
 *
 * 任何新增触发 switchMode / switchSubMode / restoreSessionToUI 的 watch 或入口
 * 都**必须**添加以下检查，防止 session restore 覆盖外部数据：
 *
 *   if (isLoadingExternalData.value) return;
 *
 * 适用场景：历史记录恢复、收藏加载、模板导入、配置恢复等任何外部数据加载
 *
 * 当前已保护的 5 个入口：
 *   1. watch(functionMode, ...)              - 功能模式切换
 *   2. watch(basicSubMode, ...)              - Basic 子模式切换
 *   3. watch(proSubMode, ...)                - Pro 子模式切换
 *   4. watch(imageSubMode, ...)              - Image 子模式切换
 *   5. watch([isReady, ...modes], ...)       - 综合模式监听
 */

// ========== 🔧 Step C: 路由驱动的模式切换（替代旧 state-watch） ==========
/**
 * 从路由路径解析 SubModeKey（使用与 route-computed 相同的严格解析逻辑）
 *
 * @param path - 路由路径，如 '/basic/system', '/pro/variable', '/image/text2image'
 * @returns SubModeKey，如 'basic-system', 'pro-variable', 'image-text2image'
 * @returns null - 如果路径非法
 */
const parseSubModeKey = (path: string): SubModeKey | null => {
  if (!path) return null;

  // 移除查询参数和哈希
  const cleanPath = path.split('?')[0].split('#')[0];

  // 匹配模式：/mode/subMode
  const match = cleanPath.match(/^\/([a-z]+)\/([a-z0-9]+)$/);
  if (!match) return null;

  const [, mode, subMode] = match;

  // 严格验证 mode 和 subMode 的合法性
  const validModes: Record<string, string[]> = {
    basic: ['system', 'user'],
    pro: ['multi', 'variable'],
    image: ['text2image', 'image2image'],
  };

  // 🔧 Pro 模式兼容性映射（与 routeProSubMode computed 保持一致）
  let normalizedSubMode = subMode;
  if (mode === 'pro') {
    if (subMode === 'system') normalizedSubMode = 'multi';
    if (subMode === 'user') normalizedSubMode = 'variable';
  }

  const validSubModes = validModes[mode];
  if (!validSubModes || !validSubModes.includes(normalizedSubMode)) {
    return null;
  }

  return `${mode}-${normalizedSubMode}` as SubModeKey;
};

/**
 * 🔧 Step C - 新增：路由变化监听（替代旧 state-watch，避免双触发）
 *
 * 主链路：路由变化 → sessionManager.switchMode/switchSubMode → restoreSessionToUI
 *
 * 设计原则：
 * - 路由变化是唯一触发模式切换事务的入口
 * - 使用 route-computed 解析 fromKey/toKey（与 Step A 保持一致）
 * - 保留 isLoadingExternalData 和 hasRestoredInitialState 短路逻辑
 * - 与旧 state-watch 并存但让旧的短路，便于验证和回滚
 */
watch(
  () => routerInstance.currentRoute.value.fullPath,
  async (toPath, fromPath) => {
    // 🔧 首次恢复完成前不响应路由变化
    if (!hasRestoredInitialState.value) return;

    // 🔧 外部数据加载中不响应路由变化（防止 session restore 覆盖外部数据）
    if (isLoadingExternalData.value) return;

    // 解析 fromKey 和 toKey（使用与 route-computed 相同的严格解析逻辑）
    const fromKey = parseSubModeKey(fromPath);
    const toKey = parseSubModeKey(toPath);

    // 非法路径：不触发切换（由 route-computed 的 redirect 处理）
    if (!fromKey || !toKey) return;

    // 路由未变化：不触发切换
    if (fromKey === toKey) return;

    // 🔧 判断是跨 mode 切换还是同 mode 子模式切换
    const fromMode = fromKey.split('-')[0];
    const toMode = toKey.split('-')[0];

    try {
      if (fromMode !== toMode) {
        // 跨 mode 切换
        await sessionManager.switchMode(fromKey, toKey);
      } else {
        // 同 mode 子模式切换
        await sessionManager.switchSubMode(fromKey, toKey);
      }

      // ⚠️ 切换后恢复状态到 UI
      await restoreSessionToUI();
    } catch (error) {
      console.error(`[PromptOptimizerApp] 路由切换失败: ${fromKey} → ${toKey}`, error);
    }
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
function navigateToSubModeKey(
  toKey: SubModeKey,
  opts?: { replace?: boolean }
) {
  // SubModeKey 格式：'basic-system' | 'pro-variable' | 'image-text2image'
  const [mode, subMode] = toKey.split('-') as [
    FunctionMode,
    BasicSubMode | ProSubMode | ImageSubMode
  ]

  const path = `/${mode}/${subMode}`

  if (opts?.replace) {
    routerInstance.replace(path)
  } else {
    routerInstance.push(path)
  }
}

// 🔧 Step C 阶段2：已删除四个旧 state-watch，route-watch 成为唯一触发源
// - watch(functionMode, ...) ❌ 已删除（2024-01-06）
// - watch(basicSubMode, ...) ❌ 已删除（2024-01-06）
// - watch(proSubMode, ...) ❌ 已删除（2024-01-06）
// - watch(imageSubMode, ...) ❌ 已删除（2024-01-06）
//
// 主链路：route.fullPath 变化 → sessionManager.switchMode/switchSubMode → restoreSessionToUI
// 保留 watch([isReady, ...modes], ...) 用于首次恢复（第1121-1131行）

// 应用启动时恢复当前会话（在services ready后自动触发）
// 注意：恢复逻辑已集成到services ready的watch中


// 定时自动保存（每30秒）
let autoSaveIntervalId: number | null = null
// Services 初始化超时定时器
let initTimeoutId: number | null = null

// ⚠️ 具名函数：pagehide 事件处理器（Codex 建议）
const handlePagehide = () => {
  // 注意：这里不能用 await，因为浏览器不会等异步完成
  sessionManager.saveAllSessions().catch(err => {
    console.error('[PromptOptimizerApp] pagehide 异步保存失败:', err)
  })
}

// ⚠️ 具名函数：visibilitychange 事件处理器（Codex 建议）
const handleVisibilityChange = () => {
  if (document.visibilityState === 'hidden') {
    sessionManager.saveAllSessions().catch(err => {
      console.error('[PromptOptimizerApp] visibilitychange 保存失败:', err)
    })
  }
}

onMounted(() => {
  // Route-level lazy loading can break after a new deployment when this tab is still running an old main bundle.
  // Prompt user to refresh instead of auto-reloading.
  if (typeof window !== 'undefined') {
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
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
    console.error('[PromptOptimizerApp] Services 初始化超时')
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
      console.warn('[PromptOptimizerApp] Pinia services 尚未注入，但 services.value 已存在')
      console.warn('[PromptOptimizerApp] 这可能是时序问题，继续等待下一轮')
      // 不调用 stopWatch()，继续等待下一轮
      return
    }
    if (!$services.preferenceService) {
      // PreferenceService 还未就绪：继续等待，避免 restoreAllSessions() 直接返回导致默认值写回覆盖持久化内容
      return
    }

    // Services 和 Pinia 均已就绪，清除超时定时器并停止监听
    console.log('[PromptOptimizerApp] Services 和 Pinia 均已就绪，开始恢复会话')
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

      // 启动自动保存定时器
      autoSaveIntervalId = window.setInterval(async () => {
        // ⚠️ Codex 要求：切换期间禁用自动保存，避免竞态条件
        // ⚠️ 注意：SessionManager.saveSubModeSession 内部已有全局锁（saveInFlight），无需额外锁
        if (sessionManager.isSwitching) {
          return
        }

        const currentKey = sessionManager.getActiveSubModeKey()
        await sessionManager.saveSubModeSession(currentKey)
      }, 30000) // 每30秒

      // ⚠️ Codex 建议：使用 pagehide 代替 beforeunload（更可靠）
      // pagehide 在页面即将卸载时触发，比 beforeunload 更可靠
      if (typeof window !== 'undefined') {
        window.addEventListener('pagehide', handlePagehide)

        // ⚠️ 额外的保险：visibilitychange hidden 时也触发一次保存
        document.addEventListener('visibilitychange', handleVisibilityChange)
      }
    } catch (error) {
      console.error('[PromptOptimizerApp] 初始化过程中发生错误:', error)
    } finally {
      // Ensure the app can render even if session restore fails.
      hasRestoredInitialState.value = true
    }
  })
})

// 应用卸载前清理并保存所有会话
onBeforeUnmount(async () => {
  // 🔧 Codex 修复：设置卸载标志，阻止后续 microtask 执行恢复
  restoreCoordinator.markUnmounted();

  // 清除定时器
  if (autoSaveIntervalId !== null) {
    window.clearInterval(autoSaveIntervalId)
  }

  // ⚠️ 清除初始化超时定时器（Codex 建议：避免悬挂定时器）
  if (initTimeoutId !== null) {
    window.clearTimeout(initTimeoutId)
  }

  // ⚠️ Codex 建议：移除事件监听器，避免内存泄漏
  if (typeof window !== 'undefined') {
    window.removeEventListener('pagehide', handlePagehide)
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    window.removeEventListener('unhandledrejection', handleUnhandledRejection)
  }

  removeRouterErrorHandler?.()
  removeRouterErrorHandler = null
 
  await sessionManager.saveAllSessions()
})
</script>

<style scoped>
.active-button {
    background-color: var(--primary-color, #3b82f6) !important;
    color: white !important;
    border-color: var(--primary-color, #3b82f6) !important;
}

.active-button:hover {
    background-color: var(--primary-hover-color, #2563eb) !important;
    border-color: var(--primary-hover-color, #2563eb) !important;
}

.loading-container {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 100vh;
    font-size: 1.2rem;
    color: var(--text-color);
    background-color: var(--background-color);
}

.loading-container.error {
    color: #f56c6c;
}

.spinner {
    border: 4px solid rgba(128, 128, 128, 0.2);
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border-left-color: var(--primary-color);
    animation: spin 1s ease infinite;
    margin-bottom: 20px;
}

@keyframes spin {
    0% {
        transform: rotate(0deg);
    }
    100% {
        transform: rotate(360deg);
    }
}
</style>
