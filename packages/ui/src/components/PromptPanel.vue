<template>
    <NFlex
        vertical
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
            class="flex-none"
            content-style="padding: 0;"
            :style="{ maxHeight: '120px', overflow: 'visible' }"
        >
            <NFlex justify="space-between" align="flex-start" :wrap="false">
                <!-- 左侧：标题和版本 -->
                <NSpace vertical :size="8" class="flex-1 min-w-0">
                    <NSpace align="center" :size="12">
                        <NText class="text-lg font-semibold">{{
                            t("prompt.optimized")
                        }}</NText>
                        <NSpace
                            v-if="versions && versions.length > 0"
                            :size="4"
                            class="version-tags"
                        >
                            <!-- V3, V2, V1... 按降序显示（最新版本在前） -->
                            <NTag
                                v-for="version in versions.slice().reverse()"
                                :key="version.id"
                                :type="
                                    currentVersionId === version.id && !isV0Selected
                                        ? 'success'
                                        : 'default'
                                "
                                size="small"
                                @click="switchVersion(version)"
                                :bordered="currentVersionId !== version.id || isV0Selected"
                            >
                                V{{ version.version }}
                            </NTag>
                            <!-- 🆕 V0 固定放在最后 -->
                            <NTag
                                v-if="showV0Tag"
                                :type="isV0Selected ? 'success' : 'default'"
                                size="small"
                                @click="switchToV0"
                                :bordered="!isV0Selected"
                            >
                                V0
                            </NTag>
                        </NSpace>
                    </NSpace>
                </NSpace>

                <!-- 右侧：操作按钮 -->
                <NSpace align="center" :size="8" class="flex-shrink-0">
                    <!-- 预览按钮 -->
                    <NButton
                        v-if="showPreview && optimizedPrompt"
                        @click="$emit('open-preview')"
                        type="tertiary"
                        size="small"
                        ghost
                        round
                        :title="t('common.preview')"
                    >
                        <template #icon>
                            <NIcon>
                                <svg
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                />
                            </svg>
                            </NIcon>
                        </template>
                    </NButton>
                    <!-- 应用到会话 -->
                    <NButton
                        v-if="showApplyButton && versions && versions.length > 0"
                        @click="$emit('apply-to-conversation')"
                        type="success"
                        size="small"
                        ghost
                        :disabled="isOptimizing || !currentVersionId"
                    >
                        <template #icon>
                            <NIcon>
                                <svg
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M5 13l4 4L19 7"
                                    />
                                </svg>
                            </NIcon>
                        </template>
                        {{ t("prompt.applyToConversation") }}
                    </NButton>
                    <!-- 评估入口：分数徽章或评估按钮 -->
                    <div v-if="showEvaluation && optimizedPrompt" class="evaluation-entry">
                        <EvaluationScoreBadge
                            v-if="hasEvaluationResult || isEvaluating"
                            :score="evaluationScore"
                            :level="evaluationScoreLevel"
                            :loading="isEvaluating"
                            :result="evaluationResult"
                            :type="evaluationType"
                            size="small"
                            @show-detail="handleShowEvaluationDetail"
                            @evaluate="handleEvaluate"
                            @apply-improvement="handleApplyImprovement"
                            @apply-patch="handleApplyPatch"
                        />
                        <NButton
                            v-else
                            size="small"
                            type="tertiary"
                            @click="handleEvaluate"
                        >
                            <template #icon>
                                <NIcon>
                                    <svg
                                        class="w-4 h-4"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                            stroke-width="2"
                                            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                                        ></path>
                                    </svg>
                                </NIcon>
                            </template>
                            {{ t("prompt.analyze") }}
                        </NButton>
                    </div>
                    <!-- 保存本地修改（手动编辑/直接修复后建议保存到历史版本） -->
                    <NButton
                        v-if="showSaveChanges"
                        type="default"
                        size="small"
                        class="min-w-[100px]"
                        @click="handleSaveChanges"
                    >
                        {{ t("prompt.saveChanges") }}
                    </NButton>
                    <!-- 继续优化按钮 -->
                    <NButton
                        v-if="optimizedPrompt"
                        @click="handleIterate"
                        :disabled="isIterating"
                        :loading="isIterating"
                        type="primary"
                        size="small"
                        class="min-w-[100px]"
                    >
                        <template #icon>
                            <svg
                                v-if="!isIterating"
                                class="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                ></path>
                            </svg>
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
        <OutputDisplay
            ref="outputDisplayRef"
            :content="optimizedPrompt"
            :original-content="previousVersionText"
            :reasoning="reasoning"
            mode="editable"
            :streaming="isOptimizing || isIterating"
            :enable-diff="true"
            :enable-copy="true"
            :enable-fullscreen="true"
            :enable-edit="true"
            :placeholder="t('prompt.optimizedPlaceholder')"
            :style="{
                height: '100%',
                maxHeight: '100%',
                flex: 1,
                minHeight: 0,
                overflow: 'hidden',
            }"
            @update:content="$emit('update:optimizedPrompt', $event)"
            @save-favorite="$emit('save-favorite', $event)"
        />
    </NFlex>
    <!-- 迭代优化弹窗 -->
    <Modal v-model="showIterateInput" @confirm="submitIterate">
        <template #title>
            {{ templateTitleText }}
        </template>

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
import { ref, computed, nextTick, watch } from "vue";
import { useI18n } from "vue-i18n";
import { NButton, NText, NInput, NCard, NFlex, NSpace, NTag, NIcon } from "naive-ui";
import { useToast } from '../composables/ui/useToast';
import { useEvaluationContextOptional } from '../composables/prompt/useEvaluationContext';
import { useProContextOptional } from '../composables/prompt/useProContext';
import TemplateSelect from "./TemplateSelect.vue";
import Modal from "./Modal.vue";
import OutputDisplay from "./OutputDisplay.vue";
import { EvaluationScoreBadge } from "./evaluation";
import type { Template, PromptRecord, EvaluationType, PatchOperation } from "@prompt-optimizer/core";

const { t } = useI18n();
const toast = useToast();

interface IteratePayload {
    originalPrompt: string;
    optimizedPrompt: string;
    iterateInput: string;
}

const props = defineProps({
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

// 计算评估相关的状态（从 context 获取）
const showEvaluation = computed(() => !!evaluation);

// 判断当前使用的评估类型：有迭代需求用 prompt-iterate，否则用 prompt-only
const evaluationType = computed<'prompt-only' | 'prompt-iterate'>(() => {
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

// 🆕 是否显示 V0 标签（只有当 versions 存在且有原始内容时才显示）
const showV0Tag = computed(() => {
    return props.versions && props.versions.length > 0 && props.versions[0]?.originalPrompt;
});

const currentVersionOptimizedPrompt = computed(() => {
    if (!props.versions || !props.currentVersionId) return "";
    return props.versions.find((v) => v.id === props.currentVersionId)?.optimizedPrompt || "";
});

const showSaveChanges = computed(() => {
    if (!props.optimizedPrompt) return false;
    if (!props.versions || props.versions.length === 0) return false;
    if (!props.currentVersionId) return false;
    if (isV0Selected.value) return false;
    return props.optimizedPrompt !== currentVersionOptimizedPrompt.value;
});

// 🆕 切换到 V0（原始内容）
const switchToV0 = async () => {
    if (!props.versions || props.versions.length === 0) return;

    const v0Content = props.versions[0].originalPrompt;
    if (!v0Content) return;

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

    console.log("[PromptPanel] 已切换到 V0（原始内容）");
};

// 处理评估按钮点击（触发评估）
const handleEvaluate = async () => {
    if (!props.optimizedPrompt?.trim()) {
        toast.error(t("prompt.error.noOptimizedPrompt"));
        return;
    }

    if (!evaluation) {
        console.warn("[PromptPanel] 评估上下文不可用");
        return;
    }

    const iterateRequirement = currentIterationNote.value.trim();
    // 获取 Pro 模式上下文（如果可用）
    const proContext = proContextRef?.value;

    if (iterateRequirement) {
        // 有迭代需求时使用 prompt-iterate 评估
        await evaluation.evaluatePromptIterate({
            originalPrompt: props.originalPrompt,
            optimizedPrompt: props.optimizedPrompt,
            iterateRequirement,
            proContext,
        });
    } else {
        // 无迭代需求时使用 prompt-only 评估
        await evaluation.evaluatePromptOnly({
            originalPrompt: props.originalPrompt,
            optimizedPrompt: props.optimizedPrompt,
            proContext,
        });
    }
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
    if (!props.versions || props.versions.length === 0) {
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

const submitIterate = () => {
    if (!iterateInput.value.trim()) return;
    if (!props.selectedIterateTemplate) {
        toast.error(t("prompt.error.noTemplate"));
        return;
    }

    emit("iterate", {
        originalPrompt: props.originalPrompt,
        optimizedPrompt: outputDisplayRef.value?.content || props.optimizedPrompt,
        iterateInput: iterateInput.value.trim(),
    });

    // 重置输入
    iterateInput.value = "";
    showIterateInput.value = false;
};

// 添加版本切换函数
const switchVersion = async (version: PromptRecord) => {
    if (version.id === props.currentVersionId && !isV0Selected.value) return;

    if (showSaveChanges.value) {
        const ok = window.confirm(t("prompt.unsavedChangesConfirm"));
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

    console.log("[PromptPanel] 版本切换完成，强制刷新内容:", {
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
                    "[PromptPanel] 检测到开始优化/迭代，强制退出编辑状态",
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

defineExpose({
    refreshIterateTemplateSelect,
    openIterateDialog,
});
</script>

<style scoped>
/* 版本容器样式 */
.version-container {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
}

/* 版本标签可点击样式 */
.version-tag-clickable {
    cursor: pointer;
    user-select: none;
    transition: transform 0.15s ease;
}

.version-tag-clickable:hover {
    transform: translateY(-1px);
}

.version-tag-clickable:active {
    transform: translateY(0);
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
