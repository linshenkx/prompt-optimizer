<template>
    <div
        class="variable-aware-input-wrapper"
        :style="completionColorVars"
    >
        <!-- CodeMirror 编辑器容器 -->
        <div ref="editorRef" class="codemirror-container"></div>

        <!-- 悬浮的"提取为变量"按钮 -->
        <NPopover
            v-model:show="showExtractionButton"
            :x="popoverPosition.x"
            :y="popoverPosition.y"
            placement="top"
            trigger="manual"
            :show-arrow="false"
            :style="{ padding: '4px' }"
        >
            <template #trigger>
                <div
                    :style="{
                        position: 'fixed',
                        left: popoverPosition.x + 'px',
                        top: popoverPosition.y + 'px',
                        pointerEvents: 'none',
                        width: '1px',
                        height: '1px',
                    }"
                />
            </template>
            <NButton size="small" type="primary" @click="handleExtractVariable">
                {{ t("variableExtraction.extractButton") }}
            </NButton>
        </NPopover>

        <!-- 变量提取对话框 -->
        <VariableExtractionDialog
            v-model:show="showExtractionDialog"
            :selected-text="currentSelection.displayText"
            :existing-global-variables="existingGlobalVariables"
            :existing-temporary-variables="existingTemporaryVariables"
            :predefined-variables="predefinedVariables"
            :occurrence-count="occurrenceCount"
            @confirm="handleExtractionConfirm"
            @cancel="handleExtractionCancel"
        />
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'

import { EditorView, highlightSpecialChars, drawSelection, dropCursor, rectangularSelection, crosshairCursor, keymap, placeholder as cmPlaceholder } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { history, historyKeymap, defaultKeymap, indentWithTab } from "@codemirror/commands";
import { foldGutter, foldKeymap, indentOnInput, bracketMatching, defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { closeBrackets, completionKeymap } from "@codemirror/autocomplete";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { lintKeymap } from "@codemirror/lint";

import { NPopover, NButton, useThemeVars } from "naive-ui";
import { useI18n } from "vue-i18n";
import { useToast } from "../../composables/ui/useToast";
import { useVariableDetection } from "./useVariableDetection";
import VariableExtractionDialog from "./VariableExtractionDialog.vue";
import {
    variableHighlighter,
    variableAutocompletion,
    missingVariableTooltip,
    existingVariableTooltip,
    createThemeExtension,
    type VariableDetectionLabels,
} from "./codemirror-extensions";

/**
 * 支持变量高亮和智能管理的输入框组件
 *
 * 基于 CodeMirror 6 实现,提供:
 * 1. 变量实时高亮 (全局/临时/预定义/缺失)
 * 2. 变量自动完成 (输入 {{ 触发)
 * 3. 缺失变量快捷添加
 * 4. 文本选择提取变量 (保留原有功能)
 */

// Props 定义
interface Props {
    /** 输入框的值 */
    modelValue: string;
    /** 占位符文本 */
    placeholder?: string;
    /** 🆕 是否只读 */
    readonly?: boolean;
    /** 自动调整高度 */
    autosize?: boolean | { minRows?: number; maxRows?: number };
    /** 已存在的全局变量名列表 */
    existingGlobalVariables?: string[];
    /** 已存在的临时变量名列表 */
    existingTemporaryVariables?: string[];
    /** 系统预定义变量名列表 */
    predefinedVariables?: string[];
    /** 全局变量名到变量值的映射 */
    globalVariableValues?: Record<string, string>;
    /** 临时变量名到变量值的映射 */
    temporaryVariableValues?: Record<string, string>;
    /** 预定义变量名到变量值的映射 */
    predefinedVariableValues?: Record<string, string>;
}

const props = withDefaults(defineProps<Props>(), {
    placeholder: "",
    readonly: false,
    autosize: () => ({ minRows: 4, maxRows: 12 }),
    existingGlobalVariables: () => [],
    existingTemporaryVariables: () => [],
    predefinedVariables: () => [],
    globalVariableValues: () => ({}),
    temporaryVariableValues: () => ({}),
    predefinedVariableValues: () => ({}),
});

// Emits 定义
interface Emits {
    /** 更新输入框的值 */
    (e: "update:modelValue", value: string): void;
    /** 变量提取事件 */
    (
        e: "variable-extracted",
        data: {
            variableName: string;
            variableValue: string;
            variableType: "global" | "temporary";
        },
    ): void;
    /** 添加缺失变量事件 */
    (e: "add-missing-variable", varName: string): void;
}

const emit = defineEmits<Emits>();

const { t } = useI18n();
const message = useToast();
const themeVars = useThemeVars();
const completionColorVars = computed(() => ({
    "--variable-completion-temporary-color":
        themeVars.value.successColor || "#18a058",
    "--variable-completion-global-color":
        themeVars.value.infoColor || "#2080f0",
    "--variable-completion-predefined-color":
        themeVars.value.warningColor || "#8a63d2",
    "--variable-completion-selected-bg":
        themeVars.value.primaryColorSuppl || "rgba(32, 128, 240, 0.12)",
    "--variable-completion-selected-color":
        themeVars.value.primaryColor || "#2080f0",
}));
const editorRef = ref<HTMLElement>();
let editorView: EditorView | null = null;

// 防止“外部 props 同步 -> CodeMirror dispatch -> updateListener emit -> 再同步”的回路
const isSyncingFromModel = ref(false);

// 创建 Compartment 用于动态更新扩展
const autocompletionCompartment = new Compartment();
const highlighterCompartment = new Compartment();
const missingVariableTooltipCompartment = new Compartment();
const existingVariableTooltipCompartment = new Compartment();
const placeholderCompartment = new Compartment();
const themeCompartment = new Compartment();
const readOnlyCompartment = new Compartment();
const lineWrappingCompartment = new Compartment();

const buildVariableMap = (
    names: string[] | undefined,
    values: Record<string, string> | undefined,
): Record<string, string> => {
    const map: Record<string, string> = { ...(values || {}) };
    (names || []).forEach((name) => {
        if (!(name in map)) {
            map[name] = "";
        }
    });
    return map;
};

// 将变量名转换为 Record 格式 (包含变量值,用于检测与补全)
const globalVariablesMap = computed(() =>
    buildVariableMap(props.existingGlobalVariables, props.globalVariableValues),
);

const temporaryVariablesMap = computed(() =>
    buildVariableMap(
        props.existingTemporaryVariables,
        props.temporaryVariableValues,
    ),
);

const predefinedVariablesMap = computed(() =>
    buildVariableMap(
        props.predefinedVariables,
        props.predefinedVariableValues,
    ),
);

// 变量检测
const { extractVariables } = useVariableDetection(
    globalVariablesMap,
    temporaryVariablesMap,
    predefinedVariablesMap,
);

// 变量相关多语言文案
const variableDetectionLabels = computed<VariableDetectionLabels>(() => {
    return {
        sourceGlobal: t("variableDetection.sourceGlobal"),
        sourceTemporary: t("variableDetection.sourceTemporary"),
        sourcePredefined: t("variableDetection.sourcePredefined"),
        missingVariable: t("variableDetection.missingVariable"),
        addToTemporary: t("variableDetection.addToTemporary"),
        emptyValue: t("variableDetection.emptyValue"),
        valuePreview: (value: string) =>
            t("variableDetection.valuePreview", { value }),
    };
});

/** 判断给定位置是否位于变量占位符内部 */
const isInsideVariablePlaceholder = (text: string, index: number): boolean => {
    const beforeText = text.substring(0, index);
    const openBraces = (beforeText.match(/\{\{/g) || []).length;
    const closeBraces = (beforeText.match(/\}\}/g) || []).length;
    return openBraces > closeBraces;
};

/** 校验选中文本是否合法 (不得跨越变量边界) */
const validateSelection = (
    fullText: string,
    start: number,
    end: number,
    selectedText: string,
): { isValid: boolean; reason?: string } => {
    // 是否有有效选择
    if (start === end || !selectedText.trim()) {
        return { isValid: false, reason: "未选中任何文本" };
    }

    // 检查是否跨越变量边界
    const beforeSelection = fullText.substring(0, start);
    const afterSelection = fullText.substring(end);

    const openBracesBefore = (beforeSelection.match(/\{\{/g) || []).length;
    const closeBracesBefore = (beforeSelection.match(/\}\}/g) || []).length;
    if (openBracesBefore > closeBracesBefore) {
        return { isValid: false, reason: "不能跨越变量边界" };
    }

    const openBracesAfter = (afterSelection.match(/\{\{/g) || []).length;
    const closeBracesAfter = (afterSelection.match(/\}\}/g) || []).length;
    if (closeBracesAfter > openBracesAfter) {
        return { isValid: false, reason: "不能跨越变量边界" };
    }

    const openBracesInSelection = (selectedText.match(/\{\{/g) || []).length;
    const closeBracesInSelection = (selectedText.match(/\}\}/g) || []).length;
    if (openBracesInSelection !== closeBracesInSelection) {
        return { isValid: false, reason: "不能跨越变量边界" };
    }

    return { isValid: true };
};

/** 统计文本中目标字符串的出现次数 (忽略变量占位符内部) */
const isOutsideVariableRange = (
    fullText: string,
    start: number,
    length: number,
): boolean => {
    if (length <= 0) return false;
    if (isInsideVariablePlaceholder(fullText, start)) {
        return false;
    }
    const endIndex = start + length - 1;
    return !isInsideVariablePlaceholder(fullText, endIndex);
};

const countOccurrencesOutsideVariables = (
    fullText: string,
    searchText: string,
): number => {
    if (!searchText || !searchText.trim()) return 0;

    let count = 0;
    let position = 0;

    while (position < fullText.length) {
        const index = fullText.indexOf(searchText, position);
        if (index === -1) break;

        if (isOutsideVariableRange(fullText, index, searchText.length)) {
            count += 1;
            position = index + searchText.length;
        } else {
            position = index + 1;
        }
    }

    return count;
};

/** 替换文本中所有目标字符串 (忽略变量占位符内部) */
const replaceAllOccurrencesOutsideVariables = (
    fullText: string,
    searchText: string,
    replaceWith: string,
): string => {
    if (!searchText || !searchText.trim()) return fullText;

    let result = fullText;
    let position = 0;

    while (position < result.length) {
        const index = result.indexOf(searchText, position);
        if (index === -1) break;

        if (isOutsideVariableRange(result, index, searchText.length)) {
            result =
                result.substring(0, index) +
                replaceWith +
                result.substring(index + searchText.length);
            position = index + replaceWith.length;
        } else {
            position = index + 1;
        }
    }

    return result;
};

// 变量提取相关状态
const showExtractionButton = ref(false);
const showExtractionDialog = ref(false);
const popoverPosition = ref({ x: 0, y: 0 });
const currentSelection = ref({
    rawText: "",
    displayText: "",
    start: 0,
    end: 0,
});
const occurrenceCount = ref(1);

// 处理添加缺失变量
const handleAddMissingVariable = (varName: string) => {
    emit("add-missing-variable", varName);

    // 显示成功提示
    window.$message?.success(
        t("variableDetection.addSuccess", { name: varName }),
    );
};

// 计算编辑器高度
const editorHeight = computed(() => {
    const autosize = props.autosize;
    if (typeof autosize === "boolean") {
        // autosize === true 时，完全自适应容器高度（100%）
        // autosize === false 时，使用固定高度
        return autosize
            ? { min: '100%', max: 'none' }
            : { min: '200px', max: '200px' };
    }
    const minRows = autosize.minRows || 4;
    const maxRows = autosize.maxRows || 12;
    return {
        min: `${minRows * 1.5}em`,
        max: `${maxRows * 1.5}em`,
    };
});

// 检查选中文本
const checkSelection = () => {
    if (!editorView) return;

    // 🔒 只读模式下禁用变量提取功能
    if (props.readonly) {
        showExtractionButton.value = false;
        return;
    }

    const { from, to } = editorView.state.selection.main;
    const selectedText = editorView.state.sliceDoc(from, to);

    const text = editorView.state.doc.toString();
    const validation = validateSelection(text, from, to, selectedText);

    if (!validation.isValid) {
        showExtractionButton.value = false;
        occurrenceCount.value = 0;

        if (
            validation.reason &&
            validation.reason !== "未选中任何文本"
        ) {
            window.$message?.warning(validation.reason);
        }
        return;
    }

    const trimmedSelection = selectedText.trim();
    occurrenceCount.value = Math.max(
        1,
        countOccurrencesOutsideVariables(text, selectedText),
    );

    currentSelection.value = {
        rawText: selectedText,
        displayText: trimmedSelection,
        start: from,
        end: to,
    };

    calculatePopoverPosition();
    showExtractionButton.value = true;
};

// 计算悬浮框位置
const calculatePopoverPosition = () => {
    if (!editorView) return;

    const { from } = editorView.state.selection.main;
    const coords = editorView.coordsAtPos(from);

    if (coords) {
        popoverPosition.value = {
            x: coords.left,
            y: coords.top - 40,
        };
    }
};

// 处理提取变量按钮点击
const handleExtractVariable = () => {
    showExtractionButton.value = false;
    showExtractionDialog.value = true;
};

// 处理变量提取确认
const handleExtractionConfirm = (data: {
    variableName: string;
    variableValue: string;
    variableType: "global" | "temporary";
    replaceAll: boolean;
}) => {
    if (!editorView) return;

    // 🔒 只读模式下禁止修改文本（双重防护）
    if (props.readonly) {
        message.warning(t("variableExtraction.readonlyWarning"));
        showExtractionDialog.value = false;
        return;
    }

    const placeholder = `{{${data.variableName}}}`;
    const text = editorView.state.doc.toString();
    let newValue = text;

    if (data.replaceAll && occurrenceCount.value > 1) {
        // 全部替换
        newValue = replaceAllOccurrencesOutsideVariables(
            text,
            currentSelection.value.rawText,
            placeholder,
        );
    } else {
        // 仅替换当前选中的文本
        newValue =
            text.substring(0, currentSelection.value.start) +
            placeholder +
            text.substring(currentSelection.value.end);
    }

    // 更新编辑器内容
    editorView.dispatch({
        changes: {
            from: 0,
            to: editorView.state.doc.length,
            insert: newValue,
        },
        selection: {
            anchor: currentSelection.value.start + placeholder.length,
        },
    });

    // 发射变量提取事件
    emit("variable-extracted", {
        variableName: data.variableName,
        variableValue: data.variableValue,
        variableType: data.variableType,
    });

    // 显示成功消息
    if (data.replaceAll && occurrenceCount.value > 1) {
        window.$message?.success(
            t("variableExtraction.extractSuccessAll", {
                count: occurrenceCount.value,
                variableName: data.variableName,
            }),
        );
    } else {
        window.$message?.success(
            t("variableExtraction.extractSuccess", {
                variableName: data.variableName,
            }),
        );
    }

    // 关闭对话框
    showExtractionDialog.value = false;
};

// 处理变量提取取消
const handleExtractionCancel = () => {
    showExtractionDialog.value = false;
};

// 初始化 CodeMirror
onMounted(() => {
    if (!editorRef.value) return;

    const startState = EditorState.create({
        doc: props.modelValue,
        extensions: [
            highlightSpecialChars(),
            history(),
            foldGutter(),
            drawSelection(),
            dropCursor(),
            EditorState.allowMultipleSelections.of(true),
            indentOnInput(),
            syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
            bracketMatching(),
            closeBrackets(),
            autocompletionCompartment.of(
                variableAutocompletion(
                    globalVariablesMap.value,
                    temporaryVariablesMap.value,
                    predefinedVariablesMap.value,
                    variableDetectionLabels.value,
                )
            ),
            rectangularSelection(),
            crosshairCursor(),
            highlightSelectionMatches(),
            keymap.of([
                ...defaultKeymap,
                ...searchKeymap,
                ...historyKeymap,
                ...foldKeymap,
                ...completionKeymap,
                ...lintKeymap,
                indentWithTab
            ]),
            // 变量高亮 (使用 Compartment)
            highlighterCompartment.of(variableHighlighter(extractVariables)),
            // 缺失变量提示
            missingVariableTooltipCompartment.of(
                missingVariableTooltip(
                    handleAddMissingVariable,
                    variableDetectionLabels.value,
                    {
                        backgroundColor: themeVars.value.cardColor,
                        borderColor: themeVars.value.borderColor,
                        borderRadius: themeVars.value.borderRadius,
                        textColor: themeVars.value.textColor2,
                        primaryColor: themeVars.value.primaryColor,
                        primaryColorHover: themeVars.value.primaryColorHover,
                    },
                ),
            ),
            // 已存在变量提示
            existingVariableTooltipCompartment.of(
                existingVariableTooltip(
                    variableDetectionLabels.value,
                    {
                        backgroundColor: themeVars.value.cardColor,
                        borderColor: themeVars.value.borderColor,
                        borderRadius: themeVars.value.borderRadius,
                        textColor: themeVars.value.textColor2,
                        shadow: themeVars.value.boxShadow2,
                        sourceGlobalColor: themeVars.value.infoColor,
                        sourceTemporaryColor: themeVars.value.successColor,
                        sourcePredefinedColor: themeVars.value.warningColor,
                        surfaceOverlay: themeVars.value.popoverColor,
                    },
                ),
            ),
            // 主题适配
            themeCompartment.of(createThemeExtension(themeVars.value)),
            // 🆕 只读状态
            readOnlyCompartment.of(EditorState.readOnly.of(props.readonly)),
            // 🆕 自动换行功能
            lineWrappingCompartment.of(EditorView.lineWrapping),
            // 监听文档变化
            EditorView.updateListener.of((update) => {
                if (update.docChanged) {
                    // 外部同步导致的变更不回写（避免循环/重复写入）
                    if (!isSyncingFromModel.value) {
                        const newValue = update.state.doc.toString();
                        emit("update:modelValue", newValue);
                    }
                }

                // 监听选择变化
                if (update.selectionSet) {
                    checkSelection();
                }
            }),
            // 占位符（使用官方 placeholder 扩展）
            placeholderCompartment.of(
                props.placeholder ? cmPlaceholder(props.placeholder) : []
            ),
        ],
    });

    editorView = new EditorView({
        state: startState,
        parent: editorRef.value,
    });
});

// 监听外部值变化
watch(
    () => props.modelValue,
    (newValue) => {
        if (editorView && newValue !== editorView.state.doc.toString()) {
            isSyncingFromModel.value = true;
            editorView.dispatch({
                changes: {
                    from: 0,
                    to: editorView.state.doc.length,
                    insert: newValue,
                },
            });
            queueMicrotask(() => {
                isSyncingFromModel.value = false;
            });
        }
    },
);

// 监听变量列表与多语言变化,动态更新扩展
watch(
    [
        () => globalVariablesMap.value,
        () => temporaryVariablesMap.value,
        () => predefinedVariablesMap.value,
        () => variableDetectionLabels.value,
    ],
    () => {
        if (!editorView) return;

        editorView.dispatch({
            effects: [
                autocompletionCompartment.reconfigure(
                    variableAutocompletion(
                        globalVariablesMap.value,
                        temporaryVariablesMap.value,
                        predefinedVariablesMap.value,
                        variableDetectionLabels.value,
                    ),
                ),
                highlighterCompartment.reconfigure(
                    variableHighlighter(extractVariables),
                ),
                missingVariableTooltipCompartment.reconfigure(
                    missingVariableTooltip(
                        handleAddMissingVariable,
                        variableDetectionLabels.value,
                        {
                            backgroundColor: themeVars.value.cardColor,
                            borderColor: themeVars.value.borderColor,
                            borderRadius: themeVars.value.borderRadius,
                            textColor: themeVars.value.textColor2,
                            primaryColor: themeVars.value.primaryColor,
                            primaryColorHover: themeVars.value.primaryColorHover,
                        },
                    ),
                ),
                existingVariableTooltipCompartment.reconfigure(
                    existingVariableTooltip(
                        variableDetectionLabels.value,
                        {
                            backgroundColor: themeVars.value.cardColor,
                            borderColor: themeVars.value.borderColor,
                            borderRadius: themeVars.value.borderRadius,
                            textColor: themeVars.value.textColor2,
                            shadow: themeVars.value.boxShadow2,
                            sourceGlobalColor: themeVars.value.infoColor,
                            sourceTemporaryColor: themeVars.value.successColor,
                            sourcePredefinedColor: themeVars.value.warningColor,
                            surfaceOverlay: themeVars.value.popoverColor,
                        },
                    ),
                ),
            ],
        });
    },
);

// 监听占位符变化,动态更新编辑器属性
watch(
    () => props.placeholder,
    (placeholder) => {
        if (!editorView) return;

        editorView.dispatch({
            effects: [
                placeholderCompartment.reconfigure(
                    placeholder ? cmPlaceholder(placeholder) : []
                ),
            ],
        });
    },
);

// 🆕 监听 readonly 变化,动态更新编辑器只读状态
watch(
    () => props.readonly,
    (readonly) => {
        if (!editorView) return;

        editorView.dispatch({
            effects: [
                readOnlyCompartment.reconfigure(EditorState.readOnly.of(readonly)),
            ],
        });
    },
);

// 监听主题变化,动态更新 CodeMirror 主题
watch(
    themeVars,
    (vars) => {
        if (!editorView) return;

        editorView.dispatch({
            effects: [
                themeCompartment.reconfigure(createThemeExtension(vars)),
                missingVariableTooltipCompartment.reconfigure(
                    missingVariableTooltip(
                        handleAddMissingVariable,
                        variableDetectionLabels.value,
                        {
                            backgroundColor: vars.cardColor,
                            borderColor: vars.borderColor,
                            borderRadius: vars.borderRadius,
                            textColor: vars.textColor2,
                            primaryColor: vars.primaryColor,
                            primaryColorHover: vars.primaryColorHover,
                        },
                    ),
                ),
                existingVariableTooltipCompartment.reconfigure(
                    existingVariableTooltip(
                        variableDetectionLabels.value,
                        {
                            backgroundColor: vars.cardColor,
                            borderColor: vars.borderColor,
                            borderRadius: vars.borderRadius,
                            textColor: vars.textColor2,
                            shadow: vars.boxShadow2,
                            sourceGlobalColor: vars.infoColor,
                            sourceTemporaryColor: vars.successColor,
                            sourcePredefinedColor: vars.warningColor,
                            surfaceOverlay: vars.popoverColor,
                        },
                    ),
                ),
            ],
        });
    },
    { deep: true },
);

// 清理
onBeforeUnmount(() => {
    if (editorView) {
        editorView.destroy();
        editorView = null;
    }
});

// 暴露方法供父组件调用
defineExpose({
    // 获取编辑器实例
    getEditorView: () => editorView,
    // 获取当前值
    getValue: () => editorView?.state.doc.toString() || "",
    // 设置值
    setValue: (value: string) => {
        if (editorView) {
            editorView.dispatch({
                changes: {
                    from: 0,
                    to: editorView.state.doc.length,
                    insert: value,
                },
            });
        }
    },
    // 获取选中文本
    getSelection: () => {
        if (!editorView) return { text: "", from: 0, to: 0 };
        const { from, to } = editorView.state.selection.main;
        return {
            text: editorView.state.sliceDoc(from, to),
            from,
            to,
        };
    },
    // 替换选中文本
    replaceSelection: (text: string) => {
        if (!editorView) return;
        const { from, to } = editorView.state.selection.main;
        editorView.dispatch({
            changes: { from, to, insert: text },
            selection: { anchor: from + text.length },
        });
    },
    // 聚焦编辑器
    focus: () => {
        editorView?.focus();
    },
});
</script>

<style scoped>
.variable-aware-input-wrapper {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
}

.codemirror-container {
    border: 1px solid var(--n-border-color);
    border-radius: var(--n-border-radius);
    overflow: hidden;
    transition: border-color 0.3s var(--n-bezier);
    flex: 1;
    min-height: 0;
}

.codemirror-container:hover {
    border-color: var(--n-border-color-hover);
}

.codemirror-container:focus-within {
    border-color: var(--n-primary-color);
    box-shadow: 0 0 0 2px var(--n-primary-color-suppl);
}

/* CodeMirror 内部样式调整 */
.codemirror-container :deep(.cm-editor) {
    height: 100%;
}

.codemirror-container :deep(.cm-scroller) {
    overflow: auto;
    min-height: v-bind("editorHeight.min");
    max-height: v-bind("editorHeight.max");
}

.codemirror-container :deep(.cm-content) {
    min-height: v-bind("editorHeight.min");
    /* 🆕 支持文本自动换行 */
    white-space: pre-wrap;
    word-wrap: break-word;
    overflow-wrap: break-word;
}

/* 🆕 确保长行文本正确换行 */
.codemirror-container :deep(.cm-line) {
    white-space: pre-wrap;
    word-break: break-word;
}

/* 占位符样式（使用 CodeMirror 官方 placeholder 扩展） */
.codemirror-container :deep(.cm-placeholder) {
    color: var(--n-placeholder-color);
    pointer-events: none;
    font-style: italic;
}

/* 自动完成面板样式 */
.codemirror-container :deep(.cm-tooltip-autocomplete) {
    background: var(--n-color);
    border: 1px solid var(--n-border-color);
    border-radius: var(--n-border-radius);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.codemirror-container
    :deep(.cm-tooltip-autocomplete ul li[aria-selected="true"]) {
    background: var(--variable-completion-selected-bg, rgba(32, 128, 240, 0.12));
}

.codemirror-container
    :deep(
        .cm-tooltip-autocomplete ul li[aria-selected="true"] .cm-completionLabel
    ) {
    color: var(--variable-completion-selected-color, #2080f0);
}

.codemirror-container :deep(.cm-completionLabel) {
    color: var(--n-text-color-1);
}

.codemirror-container :deep(.variable-completion-temporary .cm-completionLabel) {
    color: var(--variable-completion-temporary-color, #18a058);
}

.codemirror-container :deep(.variable-completion-global .cm-completionLabel) {
    color: var(--variable-completion-global-color, #2080f0);
}

.codemirror-container :deep(.variable-completion-predefined .cm-completionLabel) {
    color: var(--variable-completion-predefined-color, #8a63d2);
}

.codemirror-container :deep(.cm-completionDetail) {
    color: var(--n-text-color-3);
    font-style: normal;
}

.codemirror-container :deep(.cm-completionInfo) {
    background: var(--n-color);
    border: 1px solid var(--n-border-color);
    color: var(--n-text-color-2);
}

.codemirror-container
    :deep(.cm-tooltip.cm-completionInfo.cm-completionInfo-right) {
    margin-left: 4px;
}
</style>
