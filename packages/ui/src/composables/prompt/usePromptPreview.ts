import { computed, type Ref } from 'vue'

import { PREDEFINED_VARIABLES, type ContextMode } from "@prompt-optimizer/core";

import {
  findMissingVariables,
  replaceVariablesInContent,
  scanVariableNames,
} from "../../utils/prompt-variables";

/**
 * 提示词预览 Composable
 *
 * 用于实时计算提示词渲染结果并检测缺失变量
 *
 * @param content - 提示词内容（响应式）
 * @param variables - 变量对象（响应式）
 * @param contextMode - 上下文模式（响应式，已保留但在渲染层面无差异）
 */
export function usePromptPreview(
  content: Ref<string>,
  variables: Ref<Record<string, string>>,
  contextMode: Ref<ContextMode>,
) {
  /**
   * 解析模板中的变量
   */
  const parsedVariables = computed(() => {
    if (!content.value) {
      return {
        builtinVars: new Set<string>(),
        customVars: new Set<string>(),
        allVars: new Set<string>(),
      };
    }

    const names = scanVariableNames(content.value);
    const allVars = new Set<string>(names);
    const builtinVars = new Set<string>();
    const customVars = new Set<string>();

    const predefinedSet = new Set<string>(PREDEFINED_VARIABLES);
    for (const name of names) {
      if (predefinedSet.has(name)) builtinVars.add(name);
      else customVars.add(name);
    }

    return { builtinVars, customVars, allVars };
  });

  /**
   * 缺失的变量
   */
  const missingVariables = computed(() => {
    return findMissingVariables(content.value || "", variables.value || {});
  });

  /**
   * 渲染后的预览内容
   *
   * 简化版本：统一使用简单替换逻辑
   * 注意：这里使用简单的正则替换而不是 Mustache，因为：
   * 1. UI 预览不需要 Mustache 的条件渲染等高级特性
   * 2. 简单替换性能更好，适合实时预览
   * 3. 与后端 Mustache 行为一致（都会保留值中的占位符）
   */
  const previewContent = computed(() => {
    if (!content.value) {
      return "";
    }

    try {
      const vars = variables.value || {};

      // Preview behavior: keep placeholders when value is missing/empty.
      // This makes missing variables obvious even though execution blocks them.
      const filledVars: Record<string, string> = {};
      for (const [key, value] of Object.entries(vars)) {
        if (value === undefined) continue;
        const str = String(value);
        if (str.trim() === '') continue;
        filledVars[key] = str;
      }

      return replaceVariablesInContent(content.value, filledVars);
    } catch (error) {
      console.error("[usePromptPreview] Preview rendering failed:", error);
      return content.value;
    }
  });

  /**
   * 是否有缺失变量
   */
  const hasMissingVariables = computed(() => missingVariables.value.length > 0);

  /**
   * 变量统计信息
   */
  const variableStats = computed(() => ({
    total: parsedVariables.value.allVars.size,
    builtin: parsedVariables.value.builtinVars.size,
    custom: parsedVariables.value.customVars.size,
    missing: missingVariables.value.length,
    provided:
      parsedVariables.value.allVars.size - missingVariables.value.length,
  }));

  return {
    /** 解析的变量信息 */
    parsedVariables,
    /** 缺失的变量列表 */
    missingVariables,
    /** 渲染后的预览内容 */
    previewContent,
    /** 是否有缺失变量 */
    hasMissingVariables,
    /** 变量统计信息 */
    variableStats,
  };
}
