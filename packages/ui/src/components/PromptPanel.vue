<template>
    <NFlex
        vertical
        :class="{ 'compact-shared-prompt': mobileLayout }"
        :style="{
            height: '100%',
            maxHeight: '100%',
            overflow: 'hidden',
        }"
    >
        <!-- 标题和按钮区域 -->
        <NCard
            size="small"
            :bordered="false"
            :segmented="false"
            class="prompt-panel-header-card flex-none"
            content-style="padding: 0;"
            :style="{ maxHeight: '120px', overflow: 'visible' }"
        >
            <NFlex class="prompt-panel-heading" justify="space-between" align="center" :size="[12, 8]">
                <!-- 左侧：标题和版本 -->
                <div class="prompt-panel-identity">
                        <NText class="prompt-panel-title text-lg font-semibold">{{
                            t("prompt.optimized")
                        }}</NText>
                        <NSelect v-if="mobileLayout && versions?.length" size="small" class="compact-version-picker"
                            :value="isV0Selected ? 'v0' : currentVersionId" :aria-label="t('workspace.promptVersion')"
                            :options="[...versions.slice().reverse().map(version => ({ label: `V${version.version}`, value: version.id })), ...(showV0Tag ? [{ label: t('prompt.originalVersion'), value: 'v0' }] : [])]"
                            @update:value="selectMobileVersion" />
                        <div
                            v-if="!mobileLayout && versions && versions.length > 0"
                            class="version-tags"
                            :style="{
                                '--version-muted': themeVars.textColor3,
                                '--version-border': themeVars.dividerColor,
                                '--version-accent': themeVars.successColor,
                                '--version-error': themeVars.errorColor,
                            }"
                            data-testid="prompt-panel-version-tags"
                        >
                            <!-- V3, V2, V1... 按降序显示（最新版本在前） -->
                            <ThemedTooltip
                                v-for="version in versions.slice().reverse()"
                                :key="getVersionTagRenderKey(version)"
                                :label="`${t('workspace.promptVersion')} ${version.version}`"
                                :show="focusedVersion === version.version ? true : undefined"
                            >
                                <button
                                    type="button"
                                    class="version-tag-clickable"
                                    :class="getVersionSourceFeedbackClass(version.version)"
                                    :aria-label="`${t('workspace.promptVersion')} ${version.version}`"
                                    :aria-pressed="currentVersionId === version.id && !isV0Selected"
                                    @click="switchVersion(version)"
                                    @focus="focusedVersion = version.version"
                                    @blur="focusedVersion = null"
                                    @keydown.esc="focusedVersion = null"
                                    :data-testid="`prompt-panel-version-tag-v${version.version}`"
                                    :data-source-feedback-tone="getVersionSourceFeedbackTone(version.version) || undefined"
                                >
                                    <span class="version-number" aria-hidden="true">{{ version.version }}</span>
                                </button>
                            </ThemedTooltip>
                            <!-- 🆕 原始版本固定放在最后 -->
                            <ThemedTooltip v-if="showV0Tag"
                                :label="`${t('promptOptimizer.originalPrompt')} · ${t('prompt.originalVersionTooltip')}`"
                                :show="focusedVersion === 0 ? true : undefined">
                                <button
                                    :key="getV0TagRenderKey()"
                                    type="button"
                                    class="version-tag-clickable"
                                    :class="getVersionSourceFeedbackClass(0)"
                                    :aria-label="t('promptOptimizer.originalPrompt')"
                                    :aria-pressed="isV0Selected"
                                    @click="switchToV0"
                                    @focus="focusedVersion = 0"
                                    @blur="focusedVersion = null"
                                    @keydown.esc="focusedVersion = null"
                                    data-testid="prompt-panel-version-tag-v0"
                                    :data-source-feedback-tone="getVersionSourceFeedbackTone(0) || undefined"
                                >
                                    <span class="version-number" aria-hidden="true">0</span>
                                </button>
                            </ThemedTooltip>
                        </div>
                </div>

                <!-- 右侧：操作按钮 -->
                <NSpace
                    align="center"
                    :size="12"
                    :wrap-item="false"
                    class="prompt-panel-actions"
                >
                    <!-- 预览按钮 -->
                    <NButton
                        v-if="showPreview && optimizedPrompt"
                        key="preview-action"
                        @click="$emit('open-preview')"
                        type="tertiary"
                        size="small"
                        ghost
                        round
                        :title="t('common.preview')"
                    >
                        <template #icon>
                            <NIcon :size="16">
                                <UiEye />
                            </NIcon>
                        </template>
                    </NButton>
                    <!-- 应用到会话 -->
                    <NButton
                        v-if="showApplyButton && versions && versions.length > 0"
                        key="apply-action"
                        @click="$emit('apply-to-conversation')"
                        type="success"
                        size="small"
                        ghost
                        :disabled="isOptimizing || !currentVersionId"
                    >
                        <template #icon>
                            <NIcon :size="16">
                                <UiCheck />
                            </NIcon>
                        </template>
                        {{ t("prompt.applyToConversation") }}
                    </NButton>
                    <!-- 评估入口：分数徽章或评估按钮 -->
                    <div
                        v-if="showEvaluation && optimizedPrompt"
                        key="evaluation-action"
                        class="evaluation-entry"
                    >
                        <EvaluationScoreBadge
                            v-if="hasEvaluationResult || isEvaluating"
                            :score="evaluationScore"
                            :level="evaluationScoreLevel"
                            :loading="isEvaluating"
                            :result="evaluationResult"
                            :type="evaluationType"
                            :stale="isEvaluationStale"
                            :stale-message="evaluationStaleMessage"
                            size="small"
                            @show-detail="handleShowEvaluationDetail"
                            @evaluate="handleEvaluate"
                            @evaluate-with-feedback="handleEvaluateWithFeedback"
                            @apply-improvement="handleApplyImprovement"
                            @apply-patch="handleApplyPatch"
                        />
                        <FocusAnalyzeButton
                            v-else
                            :type="evaluationType"
                            :label="t('prompt.analyze')"
                            :loading="isEvaluating"
                            :button-props="{ size: 'small', type: 'tertiary' }"
                            @evaluate="handleEvaluate"
                            @evaluate-with-feedback="handleEvaluateWithFeedback"
                        >
                            <template #icon>
                                <AnalyzeActionIcon />
                            </template>
                        </FocusAnalyzeButton>
                    </div>
                    <!-- 保存本地修改（手动编辑/直接修复后建议保存到历史版本） -->
                    <NButton
                        v-if="showSaveChanges"
                        key="save-action"
                        type="default"
                        size="small"
                        class="min-w-[100px]"
                        @click="handleSaveChanges"
                    >
                        {{ t("prompt.saveChanges") }}
                    </NButton>
                    <!-- 继续优化按钮 -->
                    <NButton
                        v-if="optimizedPrompt || (mobileLayout && isIterating)"
                        key="iterate-action"
                        @click="handleIterate"
                        :disabled="isIterating || (mobileLayout && isOptimizing)"
                        :loading="isIterating"
                        type="primary"
                        size="small"
                        class="prompt-panel-continue min-w-[100px]"
                        data-testid="prompt-panel-continue-optimize"
                    >
                        <template #icon>
                            <UiRefreshCw v-if="!isIterating" />
                        </template>
                        {{
                            isIterating
                                ? t("prompt.optimizing")
                                : t("prompt.continueOptimize")
                        }}
                    </NButton>
                </NSpace>
            </NFlex>
        </NCard>

        <!-- 内容区域：使用 OutputDisplay 组件 -->
        <div v-if="mobileLayout && optimizedPrompt && mobileOutputView === 'diff'" class="compact-compare-selector">
            <span>{{ t('workspace.textComparison') }}</span>
            <NSelect v-model:value="mobileCompareBase" size="small" :options="[
                { label: t('promptOptimizer.originalPrompt'), value: 'original' },
                { label: t('workspace.previousVersion'), value: 'previous' },
            ]" />
        </div>
        <OutputDisplay
            :fit-content="mobileLayout"
            :test-id="testId ? testId + '-output' : undefined"
            ref="outputDisplayRef"
            :content="optimizedPrompt"
            :output-record="outputRecord"
            :original-content="mobileLayout && mobileCompareBase === 'original' ? originalPrompt : previousVersionText"
            :reasoning="reasoning"
            mode="editable"
            :streaming="isOptimizing || isIterating"
            :enable-diff="true"
            :enable-copy="true"
            :enable-fullscreen="true"
            :enable-edit="true"
            :placeholder="mobileLayout && (isOptimizing || isIterating) ? t('prompt.optimizing') : t('prompt.optimizedPlaceholder')"
            :style="{
                height: '100%',
                maxHeight: '100%',
                flex: 1,
                minHeight: 0,
                overflow: 'hidden',
            }"
            @view-change="mobileOutputView = $event"
            @update:content="$emit('update:optimizedPrompt', $event)"
            @save-favorite="$emit('save-favorite', $event)"
        />
    </NFlex>
    <!-- 迭代优化弹窗 -->
    <Modal
        v-model="showIterateInput"
        data-testid="prompt-panel-iterate-modal"
        :class="{ 'compact-shared-iterate': mobileLayout }"
        @confirm="submitIterate"
    >
        <template #title>
            {{ mobileLayout ? t('prompt.continueOptimize') : templateTitleText }}
        </template>

        <details v-if="mobileLayout" open class="compact-iterate-reference">
            <summary>{{ t('workspace.promptReference') }}</summary>
            <OutputPlainText :content="optimizedPrompt" />
        </details>
        <div class="space-y-4">
            <div>
                <NText class="text-sm font-medium mb-2">{{
                    templateSelectText
                }}</NText>
                <TemplateSelect
                    ref="iterateTemplateSelectRef"
                    :modelValue="selectedIterateTemplate"
                    @update:modelValue="
                        $emit('update:selectedIterateTemplate', $event)
                    "
                    :type="templateType"
                    :optimization-mode="optimizationMode"
                    @manage="$emit('openTemplateManager', templateType)"
                />
            </div>

            <div>
                <NText class="text-sm font-medium mb-2">{{
                    t("prompt.iterateDirection")
                }}</NText>
                <NInput
                    v-model:value="iterateInput"
                    type="textarea"
                    :placeholder="t('prompt.iteratePlaceholder')"
                    :rows="3"
                    :autosize="{ minRows: 3, maxRows: 6 }"
                    data-testid="prompt-panel-iterate-input"
                />
            </div>
        </div>

        <template #footer>
            <NButton @click="cancelIterate" type="default" size="medium">
                {{ t("common.cancel") }}
            </NButton>
            <NButton
                @click="submitIterate"
                :disabled="!iterateInput.trim() || isIterating"
                :loading="isIterating"
                type="primary"
                size="medium"
                data-testid="prompt-panel-iterate-submit"
            >
                {{
                    isIterating
                        ? t("prompt.optimizing")
                        : t("prompt.confirmOptimize")
                }}
            </NButton>
        </template>
    </Modal>
</template>

<script setup lang="ts">
import { Eye as UiEye, Check as UiCheck, RefreshCw as UiRefreshCw } from '@lucide/vue'
import OutputPlainText from './OutputPlainText.vue'
import { ref, computed, nextTick, watch, type PropType } from "vue";
import { useI18n } from "vue-i18n";
import { NButton, NText, NInput, NCard, NFlex, NSpace, NIcon, NSelect, useThemeVars } from "naive-ui";
import { useConfirmDialog } from '../composables/ui/useConfirmDialog';
import { useToast } from '../composables/ui/useToast';
import { useEvaluationContextOptional } from '../composables/prompt/useEvaluationContext';
import { useProContextOptional } from '../composables/prompt/useProContext';
import TemplateSelect from "./TemplateSelect.vue";
import Modal from "./Modal.vue";
import OutputDisplay from "./OutputDisplay.vue";
import type { OutputRecord } from "../utils/output-document";
import ThemedTooltip from './common/ThemedTooltip.vue';
import { AnalyzeActionIcon, EvaluationScoreBadge, FocusAnalyzeButton } from "./evaluation";
import type {
    EvaluationContentBlock,
    EvaluationTarget,
    EvaluationType,
    PatchOperation,
    PromptRecord,
    Template,
} from "@prompt-optimizer/core";

type SourceFeedbackTone = "change" | "error";

const { t } = useI18n();
const themeVars = useThemeVars();
const focusedVersion = ref<number | null>(null);
const toast = useToast();
const confirmDialog = useConfirmDialog();

interface IteratePayload {
    originalPrompt: string;
    optimizedPrompt: string;
    iterateInput: string;
}

const props = defineProps({
    outputRecord: { type: Object as PropType<OutputRecord>, default: undefined },
    mobileLayout: { type: Boolean, default: false },
    enableEvaluation: { type: Boolean, default: true },
    /** E2E/测试定位用的 testId（用于 OutputDisplay 根节点 data-testid） */
    testId: {
        type: String,
        default: undefined,
    },
    optimizedPrompt: {
        type: String,
        default: "",
    },
    reasoning: {
        type: String,
        default: "",
    },
    isOptimizing: {
        type: Boolean,
        default: false,
    },
    isIterating: {
        type: Boolean,
        default: false,
    },
    selectedIterateTemplate: {
        type: Object as () => Template | null,
        default: null,
    },
    versions: {
        type: Array as () => PromptRecord[],
        default: () => [],
    },
    currentVersionId: {
        type: String,
        default: "",
    },
    sourceFeedbackKey: {
        type: Number,
        default: 0,
    },
    sourceFeedbackTone: {
        type: String as () => SourceFeedbackTone | null,
        default: null,
    },
    sourceFeedbackVersion: {
        type: Number as () => number | null,
        default: null,
    },
    originalPrompt: {
        type: String,
        default: "",
    },
    optimizationMode: {
        type: String as () => import("@prompt-optimizer/core").OptimizationMode,
        required: true,
    },
    advancedModeEnabled: {
        type: Boolean,
        default: false,
    },
    // 🆕 允许外部指定迭代模板类型（基础/上下文/图像），默认保持原行为
    iterateTemplateType: {
        type: String as () => "iterate" | "contextIterate" | "imageIterate",
        default: undefined,
    },
    // 是否显示预览按钮
    showPreview: {
        type: Boolean,
        default: false,
    },
    evaluationTypeOverride: {
        type: String as () => "prompt-only" | "prompt-iterate" | undefined,
        default: undefined,
    },
    showApplyButton: {
        type: Boolean,
        default: false,
    },
});

// 使用评估上下文（可选，不强制要求父组件提供）
const evaluation = useEvaluationContextOptional();

// 使用 Pro 模式上下文（可选，仅在 Pro 模式下由 Workspace 提供）
const proContextRef = useProContextOptional();

// 获取当前版本的迭代需求（如果有）- 需要在评估类型计算之前定义
const currentIterationNote = computed(() => {
    if (!props.versions || !props.currentVersionId) return "";
    const currentVersion = props.versions.find((v) => v.id === props.currentVersionId);
    return currentVersion?.iterationNote || "";
});

const getVersionSourceFeedbackTone = (version: number): SourceFeedbackTone | null => {
    if (!props.sourceFeedbackKey || props.sourceFeedbackVersion !== version) return null;
    return props.sourceFeedbackTone;
};

const getVersionSourceFeedbackClass = (version: number) => {
    const tone = getVersionSourceFeedbackTone(version);
    return {
        "version-tag-clickable--source-change": tone === "change",
        "version-tag-clickable--source-error": tone === "error",
    };
};

const getVersionTagRenderKey = (version: PromptRecord) =>
    `${version.id}:${version.version}:${props.sourceFeedbackVersion === version.version ? props.sourceFeedbackKey : 0}`;

const getV0TagRenderKey = () =>
    `v0:${props.sourceFeedbackVersion === 0 ? props.sourceFeedbackKey : 0}`;

// 计算评估相关的状态（从 context 获取）
const showEvaluation = computed(() => props.enableEvaluation && !!evaluation);
const mobileOutputView = ref('source')
const mobileCompareBase = ref<'original' | 'previous'>('original');

// 判断当前使用的评估类型：有迭代需求用 prompt-iterate，否则用 prompt-only
const evaluationType = computed<'prompt-only' | 'prompt-iterate'>(() => {
    if (props.evaluationTypeOverride) {
        return props.evaluationTypeOverride;
    }
    const hasIterateNote = currentIterationNote.value.trim().length > 0;
    return hasIterateNote ? 'prompt-iterate' : 'prompt-only';
});

// 根据评估类型获取对应的状态
const isEvaluating = computed(() => {
    if (!evaluation) return false;
    return evaluationType.value === 'prompt-iterate'
        ? evaluation.isEvaluatingPromptIterate.value
        : evaluation.isEvaluatingPromptOnly.value;
});

const evaluationScore = computed(() => {
    if (!evaluation) return null;
    return evaluationType.value === 'prompt-iterate'
        ? evaluation.promptIterateScore.value
        : evaluation.promptOnlyScore.value;
});

const evaluationScoreLevel = computed(() => {
    if (!evaluation) return null;
    return evaluationType.value === 'prompt-iterate'
        ? evaluation.promptIterateLevel.value
        : evaluation.promptOnlyLevel.value;
});

const hasEvaluationResult = computed(() => {
    if (!evaluation) return false;
    return evaluationType.value === 'prompt-iterate'
        ? evaluation.hasPromptIterateResult.value
        : evaluation.hasPromptOnlyResult.value;
});

const evaluationResult = computed(() => {
    if (!evaluation) return null;
    return evaluationType.value === 'prompt-iterate'
        ? evaluation.state['prompt-iterate'].result
        : evaluation.state['prompt-only'].result;
});

const promptOnlyEvaluationFingerprint = ref("");
const promptIterateEvaluationFingerprint = ref("");

const buildEvaluationFingerprint = (
    type: "prompt-only" | "prompt-iterate",
): string => {
    const prompt = (props.optimizedPrompt || "").trim();
    if (type === "prompt-iterate") {
        return `${prompt}::${currentIterationNote.value.trim()}`;
    }
    return prompt;
};

const isEvaluationStale = computed(() => {
    if (!hasEvaluationResult.value) return false;

    const storedFingerprint =
        evaluationType.value === "prompt-iterate"
            ? promptIterateEvaluationFingerprint.value
            : promptOnlyEvaluationFingerprint.value;

    if (!storedFingerprint) return false;
    return storedFingerprint !== buildEvaluationFingerprint(evaluationType.value);
});

const evaluationStaleMessage = computed(() =>
    evaluationType.value === "prompt-iterate"
        ? t("evaluation.stale.promptIterate")
        : t("evaluation.stale.promptOnly"),
);

const buildDesignContextBlock = (): EvaluationContentBlock | undefined => {
    const context = proContextRef?.value;
    if (!context) return undefined;

    const content = JSON.stringify(context, null, 2);
    if (!content.trim()) return undefined;

    return {
        kind: "json",
        label: props.advancedModeEnabled
            ? t("evaluation.designContext.advanced")
            : t("evaluation.designContext.basic"),
        content,
    };
};

const buildEvaluationTarget = (): EvaluationTarget => {
    const workspacePrompt = props.optimizedPrompt || "";
    const referencePrompt = (props.originalPrompt || "").trim();
    const normalizedWorkspacePrompt = workspacePrompt.trim();

    return {
        workspacePrompt,
        referencePrompt:
            referencePrompt && referencePrompt !== normalizedWorkspacePrompt
                ? props.originalPrompt
                : undefined,
        designContext: buildDesignContextBlock(),
    };
};

const emit = defineEmits<{
    "update:optimizedPrompt": [value: string];
    iterate: [payload: IteratePayload];
    openTemplateManager: [
        type:
            | "optimize"
            | "userOptimize"
            | "iterate"
            | "imageIterate"
            | "contextIterate",
    ];
    "update:selectedIterateTemplate": [template: Template | null];
    switchVersion: [version: PromptRecord];
    switchToV0: [version: PromptRecord];  // 🆕 V0 切换专用事件
    templateSelect: [template: Template];
    "save-favorite": [data: { content: string; originalContent?: string }];
    "open-preview": [];
    "apply-to-conversation": [];
    // 评估相关事件（evaluate 和 show-evaluation-detail 已通过 inject 的 evaluation context 直接处理）
    "apply-improvement": [payload: { improvement: string; type: EvaluationType }];
    /** 应用补丁 */
    "apply-patch": [payload: { operation: PatchOperation }];
    /** 保存当前编辑内容为新版本（不触发 LLM） */
    "save-local-edit": [payload: { note?: string }];
}>();

const showIterateInput = ref(false);
const iterateInput = ref("");
const templateType = computed<"iterate" | "contextIterate" | "imageIterate">(
    () => {
        return (
            (props.iterateTemplateType as
                | "iterate"
                | "contextIterate"
                | "imageIterate") ||
            (props.advancedModeEnabled ? "contextIterate" : "iterate")
        );
    },
);

const outputDisplayRef = ref<InstanceType<typeof OutputDisplay> | null>(null);
const iterateTemplateSelectRef = ref<{ refresh?: () => void } | null>(null);

// 🆕 V0 特殊处理：跟踪是否选中 V0
const isV0Selected = ref(false);
watch([() => props.mobileLayout, () => props.currentVersionId, () => props.versions], ([mobile, id]) => {
    if (!mobile) return;
    isV0Selected.value = !id && !!props.versions?.length && props.optimizedPrompt === props.versions[0]?.originalPrompt;
}, { immediate: true });

// 🆕 是否显示 V0 标签（只有当 versions 存在且有原始内容时才显示）
const showV0Tag = computed(() => {
    if (!props.versions || props.versions.length === 0) return false;
    if (!props.versions[0]?.originalPrompt) return false;
    // 如果链本身已经从 V0 开始（version===0），则无需额外的“V0 原始内容”标签，避免重复
    return !props.versions.some((v) => v.version === 0);
});

const currentVersionOptimizedPrompt = computed(() => {
    if (!props.versions || !props.currentVersionId) return "";
    return props.versions.find((v) => v.id === props.currentVersionId)?.optimizedPrompt || "";
});

const showSaveChanges = computed(() => {
    if (!props.optimizedPrompt) return false;
    if (!props.versions || props.versions.length === 0) return false;
    if (!props.mobileLayout) {
        if (!props.currentVersionId || isV0Selected.value) return false;
        return props.optimizedPrompt !== currentVersionOptimizedPrompt.value;
    }
    const baseline = isV0Selected.value ? props.versions[0]?.originalPrompt : currentVersionOptimizedPrompt.value;
    return props.optimizedPrompt !== baseline;
});

const hasUnsavedChanges = computed(() => {
    const baseline = isV0Selected.value ? props.versions?.[0]?.originalPrompt || '' : currentVersionOptimizedPrompt.value;
    return props.optimizedPrompt !== baseline;
});
const confirmDiscardChanges = async () => {
    if (!props.mobileLayout) return true;
    if (props.isOptimizing || props.isIterating) return false;
    if (!hasUnsavedChanges.value) return true;
    return confirmDialog.warning({
        title: t('common.warning'), content: t('prompt.unsavedChangesConfirm'),
        positiveText: t('common.confirm'), negativeText: t('common.cancel'),
    });
};

// 🆕 切换到 V0（原始内容）
const selectMobileVersion = (id: string) => {
    if (id === 'v0') return switchToV0()
    const version = props.versions?.find(item => item.id === id)
    if (version) return switchVersion(version)
}

const switchToV0 = async () => {
    if (!props.versions || props.versions.length === 0) return;

    const v0Content = props.versions[0].originalPrompt;
    if (!v0Content) return;

    if (props.mobileLayout && !(await confirmDiscardChanges())) return;

    // 标记为 V0 已选中
    isV0Selected.value = true;

    // 🔧 触发专用的 switchToV0 事件，让父组件知道这是 V0 切换
    // 传递第一个版本对象，父组件应该使用 originalPrompt 而不是 optimizedPrompt
    emit("switchToV0", props.versions[0]);

    // 更新显示内容为原始内容
    emit("update:optimizedPrompt", v0Content);

    // 等待父组件更新内容
    await nextTick();

    // 强制刷新 OutputDisplay 的内容
    if (outputDisplayRef.value) {
        outputDisplayRef.value.forceRefreshContent();
    }

    console.log('[PromptPanel] Switched to V0 (original content).');
};

// 处理评估按钮点击（触发评估）
const executeEvaluate = async (userFeedback?: string, preferredType?: EvaluationType) => {
    if (!props.optimizedPrompt?.trim()) {
        toast.error(t("prompt.error.noOptimizedPrompt"));
        return;
    }

    if (!evaluation) {
        toast.error(t("evaluation.error.serviceNotReady"));
        return;
    }

    const iterateRequirement = currentIterationNote.value.trim();
    const targetType =
        preferredType === "prompt-only" || preferredType === "prompt-iterate"
            ? preferredType
            : evaluationType.value;

    const target = buildEvaluationTarget();

    if (targetType === "prompt-iterate" && iterateRequirement) {
        // 有迭代需求时使用 prompt-iterate 评估
        await evaluation.evaluatePromptIterate({
            target,
            iterateRequirement,
            focus: userFeedback,
        });

        if (evaluation.state["prompt-iterate"].result) {
            promptIterateEvaluationFingerprint.value =
                buildEvaluationFingerprint("prompt-iterate");
        }
    } else {
        // 无迭代需求时使用 prompt-only 评估
        await evaluation.evaluatePromptOnly({
            target,
            focus: userFeedback,
        });

        if (evaluation.state["prompt-only"].result) {
            promptOnlyEvaluationFingerprint.value =
                buildEvaluationFingerprint("prompt-only");
        }
    }
};

// 处理评估按钮点击（触发评估）
const handleEvaluate = async () => {
    await executeEvaluate();
};

const handleEvaluateWithFeedback = async (payload: { type: EvaluationType; feedback: string }) => {
    await executeEvaluate(payload.feedback, payload.type);
};

// 处理显示评估详情
const handleShowEvaluationDetail = () => {
    if (!evaluation) return;
    evaluation.showDetail(evaluationType.value);
};

// 处理应用改进建议（仍需要 emit，因为需要父组件打开迭代弹窗）
const handleApplyImprovement = (payload: { improvement: string; type: EvaluationType }) => {
    emit("apply-improvement", payload);
};

// 处理应用补丁
const handleApplyPatch = (payload: { operation: PatchOperation }) => {
    emit("apply-patch", payload);
};

// 计算标题文本
const templateTitleText = computed(() => {
    return t("prompt.iterateTitle");
});

// 计算模板选择标题
const templateSelectText = computed(() => {
    return t("prompt.selectIterateTemplate");
});

// 计算上一版本的文本用于显示
const previousVersionText = computed(() => {
    // ✅ 增强：确保 versions 是数组（避免路由渲染时 props 未传递导致的类型错误）
    if (!Array.isArray(props.versions) || props.versions.length === 0) {
        return props.originalPrompt || "";
    }

    const currentIndex = props.versions.findIndex(
        (v) => v.id === props.currentVersionId,
    );

    if (currentIndex > 0) {
        // 当前版本有上一版本
        return props.versions[currentIndex - 1].optimizedPrompt;
    } else if (currentIndex === 0) {
        // 当前是V1，使用原始提示词
        return props.originalPrompt || "";
    } else {
        // 找不到当前版本，使用原始提示词
        return props.originalPrompt || "";
    }
});

// 获取当前版本号（保留用于未来功能）
// const getCurrentVersionNumber = () => {
//   if (!props.versions || props.versions.length === 0) return 0
//   const currentVersion = props.versions.find(v => v.id === props.currentVersionId)
//   return currentVersion ? currentVersion.version : 1
// }

const handleIterate = () => {
    showIterateInput.value = true;
};

const cancelIterate = () => {
    showIterateInput.value = false;
    iterateInput.value = "";
};

let submittedIteration = '';
let submittedVersionId = '';
watch(() => props.isIterating, (running, wasRunning) => {
    if (!running && wasRunning && props.currentVersionId !== submittedVersionId && iterateInput.value === submittedIteration) {
        iterateInput.value = '';
    }
});

const dispatchIterate = (input: string): boolean => {
    const trimmedInput = input.trim();
    if (!trimmedInput || props.isIterating) return false;

    if (!props.selectedIterateTemplate) {
        toast.error(t("prompt.error.noTemplate"));
        return false;
    }

    submittedIteration = trimmedInput;
    submittedVersionId = props.currentVersionId;
    emit("iterate", {
        originalPrompt: props.originalPrompt,
        optimizedPrompt: outputDisplayRef.value?.content || props.optimizedPrompt,
        iterateInput: trimmedInput,
    });

    return true;
};

const submitIterate = () => {
    if (!dispatchIterate(iterateInput.value)) return;

    showIterateInput.value = false;
};

// 添加版本切换函数
const switchVersion = async (version: PromptRecord) => {
    if (version.id === props.currentVersionId && !isV0Selected.value) return;

    if (props.mobileLayout) {
        if (!(await confirmDiscardChanges())) return;
    } else if (showSaveChanges.value) {
        const ok = await confirmDialog.warning({
            title: t("common.warning"),
            content: t("prompt.unsavedChangesConfirm"),
            positiveText: t("common.confirm"),
            negativeText: t("common.cancel"),
        });
        if (!ok) return;
    }

    // 🆕 清除 V0 选中状态
    isV0Selected.value = false;

    // 发出版本切换事件
    emit("switchVersion", version);

    // 等待父组件更新内容
    await nextTick();

    // 强制刷新OutputDisplay的内容
    if (outputDisplayRef.value) {
        outputDisplayRef.value.forceRefreshContent();
    }

    console.log('[PromptPanel] Version switch completed; forcing content refresh:', {
        versionId: version.id,
        version: version.version,
    });
};

const handleSaveChanges = () => {
    emit("save-local-edit", { note: t("prompt.saveChangesNote") });
};

// 监听流式状态变化，强制退出编辑状态
watch(
    [() => props.isOptimizing, () => props.isIterating],
    ([newOptimizing, newIterating], [oldOptimizing, oldIterating]) => {
        // 当开始优化或迭代时（从false变为true），强制退出编辑状态
        if (
            (!oldOptimizing && newOptimizing) ||
            (!oldIterating && newIterating)
        ) {
            if (outputDisplayRef.value) {
                outputDisplayRef.value.forceExitEditing();
                console.log(
                    '[PromptPanel] Detected optimization/iteration start; forcing the editor to exit editing mode',
                );
            }
        }
    },
    { immediate: false },
);

// 暴露刷新迭代模板选择的方法
const refreshIterateTemplateSelect = () => {
    if (iterateTemplateSelectRef.value?.refresh) {
        iterateTemplateSelectRef.value.refresh();
    }
};

// 打开迭代弹窗并可选预填充文本
const openIterateDialog = (input?: string) => {
    if (input) {
        iterateInput.value = input;
    }
    showIterateInput.value = true;
};

const runIterateWithInput = (input: string) => {
    const started = dispatchIterate(input);
    if (started) {
        iterateInput.value = input;
        showIterateInput.value = false;
    }
    return started;
};

defineExpose({
    refreshIterateTemplateSelect,
    openIterateDialog,
    runIterateWithInput,
    hasUnsavedChanges,
    confirmDiscardChanges,
});
</script>

<style scoped>
.prompt-panel-identity {
    display: flex;
    align-items: center;
    flex: 1 1 220px;
    min-width: 0;
    flex-wrap: wrap;
    gap: 4px 8px;
}

.prompt-panel-title {
    line-height: 28px;
    white-space: nowrap;
}

.version-tags {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0;
    min-width: 0;
}

.prompt-panel-actions {
    flex-shrink: 0;
    margin-left: auto;
}

.compact-shared-prompt .prompt-panel-identity {
    flex-basis: auto;
}

/* 版本容器样式 */
.version-container {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
}

/* 版本标签可点击样式 */
.version-tag-clickable {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: var(--version-muted);
    font: inherit;
    cursor: pointer;
    user-select: none;
}

.version-number {
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border: 1px solid var(--version-border);
    border-radius: 50%;
    font-size: 11px;
    line-height: 1;
    font-variant-numeric: tabular-nums;
    transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.version-tag-clickable:hover .version-number {
    background: color-mix(in srgb, currentColor 7%, transparent);
}

.version-tag-clickable[aria-pressed="true"] {
    color: var(--version-accent);
}

.version-tag-clickable[aria-pressed="true"] .version-number {
    background: color-mix(in srgb, currentColor 10%, transparent);
    border-color: color-mix(in srgb, currentColor 28%, transparent);
    font-weight: 600;
}

.version-tag-clickable:focus-visible {
    outline: 2px solid var(--version-accent);
    outline-offset: 1px;
}

.version-tag-clickable--source-change .version-number {
    animation: prompt-version-source-change-pulse 780ms ease-out;
}

.version-tag-clickable--source-error .version-number {
    color: var(--version-error);
    animation: prompt-version-source-error-pulse 860ms ease-out;
}

@media (prefers-reduced-motion: reduce) {
    .version-tag-clickable .version-number {
        animation: none;
        transition: none;
    }
}

@keyframes prompt-version-source-change-pulse {
    0% {
        transform: translateY(0) scale(1);
        filter: brightness(1) saturate(1);
        box-shadow: 0 0 0 0 currentColor;
    }
    24% {
        transform: translateY(-1px) scale(1.08);
        filter: brightness(1.08) saturate(1.35);
        box-shadow:
            0 0 0 2px currentColor,
            0 0 0 6px color-mix(in srgb, currentColor 18%, transparent);
    }
    62% {
        transform: translateY(-1px) scale(1.03);
        filter: brightness(1.04) saturate(1.18);
        box-shadow:
            0 0 0 1px currentColor,
            0 0 0 4px color-mix(in srgb, currentColor 12%, transparent);
    }
    100% {
        transform: translateY(0) scale(1);
        filter: brightness(1) saturate(1);
        box-shadow: 0 0 0 0 currentColor;
    }
}

@keyframes prompt-version-source-error-pulse {
    0% {
        transform: translateX(0);
        filter: brightness(1) saturate(1);
        box-shadow: 0 0 0 0 currentColor;
    }
    25% {
        transform: translateX(-2px);
        filter: brightness(1.1) saturate(1.35);
    }
    50% {
        transform: translateX(2px);
        filter: brightness(1.1) saturate(1.4);
        box-shadow:
            0 0 0 2px currentColor,
            0 0 0 6px color-mix(in srgb, currentColor 20%, transparent);
    }
    70% {
        box-shadow:
            0 0 0 1px currentColor,
            0 0 0 4px color-mix(in srgb, currentColor 12%, transparent);
    }
    100% {
        transform: translateX(0);
        filter: brightness(1) saturate(1);
        box-shadow: 0 0 0 0 currentColor;
    }
}

@media (max-width: 640px) {
    .version-container {
        margin-top: 4px;
    }
}

/* 评估入口样式 */
.evaluation-entry {
    display: flex;
    align-items: center;
    flex-shrink: 0;
}
</style>
