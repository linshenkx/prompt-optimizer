import { computed, type Ref } from 'vue'

import { isValidVariableName } from '../../types/variable'


/**
 * 检测到的变量信息
 */
export interface DetectedVariable {
  /** 变量名 */
  name: string;
  /** 变量来源 */
  source: "global" | "temporary" | "predefined" | "missing";
  /** 变量值 */
  value: string;
  /** 在文档中的起始位置 */
  from: number;
  /** 在文档中的结束位置 */
  to: number;
}

/**
 * 变量检测 Composable
 *
 * 功能:
 * 1. 从文本中提取所有 {{variable}} 占位符
 * 2. 根据变量来源分类 (全局/临时/预定义/缺失)
 * 3. 返回变量的位置信息,用于高亮渲染
 *
 * @param globalVariables 全局变量
 * @param temporaryVariables 临时变量
 * @param predefinedVariables 预定义变量
 */
export function useVariableDetection(
  globalVariables: Ref<Record<string, string>>,
  temporaryVariables: Ref<Record<string, string>>,
  predefinedVariables: Ref<Record<string, string>>,
) {
  /**
   * 从文本中提取所有变量
   *
   * @param text 要分析的文本
   * @returns 检测到的变量列表
   */
  const extractVariables = (text: string): DetectedVariable[] => {
    const regex = /\{\{\s*([^\d{}\s][^{}\s]*)\s*\}\}/gu;
    const variables: DetectedVariable[] = [];
    let match;

    while ((match = regex.exec(text)) !== null) {
      const name = match[1];
      // 防止异常键/不合法变量名进入高亮与缺失提示
      if (!isValidVariableName(name)) {
        continue
      }
      const from = match.index;
      const to = from + match[0].length;

      // 分类变量并获取值
      let source: DetectedVariable["source"];
      let value = "";

      // 优先级: 预定义 > 全局 > 临时 > 缺失
      if (predefinedVariables.value[name] !== undefined) {
        source = "predefined";
        value = predefinedVariables.value[name];
      } else if (globalVariables.value[name] !== undefined) {
        source = "global";
        value = globalVariables.value[name];
      } else if (temporaryVariables.value[name] !== undefined) {
        source = "temporary";
        value = temporaryVariables.value[name];
      } else {
        source = "missing";
        value = "";
      }

      variables.push({ name, source, value, from, to });
    }

    return variables;
  };

  /**
   * 获取缺失的变量列表
   */
  const missingVariables = computed(() => {
    // 这个方法需要在外部调用 extractVariables 后使用
    // 这里提供一个辅助方法
    return (text: string) => {
      return extractVariables(text).filter((v) => v.source === "missing");
    };
  });

  /**
   * 获取变量统计信息
   */
  const getVariableStats = (text: string) => {
    const variables = extractVariables(text);
    return {
      total: variables.length,
      global: variables.filter((v) => v.source === "global").length,
      temporary: variables.filter((v) => v.source === "temporary").length,
      predefined: variables.filter((v) => v.source === "predefined").length,
      missing: variables.filter((v) => v.source === "missing").length,
    };
  };

  return {
    extractVariables,
    missingVariables,
    getVariableStats,
  };
}
