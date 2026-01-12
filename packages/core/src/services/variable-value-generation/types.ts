/**
 * 变量值生成服务 - 类型定义
 *
 * 提供智能变量值生成功能的类型系统
 */

/**
 * 需要生成值的变量
 */
export interface VariableToGenerate {
  /** 变量名 */
  name: string;

  /** 当前值（可选，用于LLM参考） */
  currentValue?: string;

  /** 变量来源标识（用于LLM理解变量性质）
   * - global: 全局变量
   * - predefined: 预定义变量
   * - test: 临时测试变量
   * - empty: 扫描出的空变量（未分配来源）
   */
  source?: 'global' | 'predefined' | 'test' | 'empty';
}

/**
 * 生成的变量值
 */
export interface GeneratedVariableValue {
  /** 变量名 */
  name: string;

  /** 生成的值 */
  value: string;

  /** 生成理由 */
  reason: string;

  /** 置信度（0-1，可选） */
  confidence?: number;
}

/**
 * 变量值生成请求
 */
export interface VariableValueGenerationRequest {
  /** 提示词内容（用于推测变量值的上下文） */
  promptContent: string;

  /** 需要生成值的变量列表 */
  variables: VariableToGenerate[];

  /** 生成使用的模型键 */
  generationModelKey: string;
}

/**
 * 变量值生成响应
 */
export interface VariableValueGenerationResponse {
  /** 生成的变量值列表 */
  values: GeneratedVariableValue[];

  /** 一句话总结 */
  summary: string;
}

/**
 * 变量值生成服务接口
 */
export interface IVariableValueGenerationService {
  /**
   * 生成变量值
   *
   * @param request - 生成请求
   * @returns 生成结果
   */
  generate(request: VariableValueGenerationRequest): Promise<VariableValueGenerationResponse>;
}
