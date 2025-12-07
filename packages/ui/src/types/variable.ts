/**
 * 变量管理相关类型定义
 */

// 统一的消息结构
export interface ConversationMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string  // 可包含变量语法 {{variableName}}
  name?: string
  tool_calls?: {
    id: string
    type: 'function'
    function: {
      name: string
      arguments: string
    }
  }[]
  tool_call_id?: string
}

// 自定义会话测试请求
export interface CustomConversationRequest {
  modelKey: string;
  messages: ConversationMessage[];
  variables: Record<string, string>;
}

// 变量值类型（MVP阶段只支持字符串）
export interface VariableValue {
  value: string;
  type: 'string';  // MVP阶段只支持string类型
  description?: string;
  lastModified: number;
}

// 变量存储结构
export interface VariableStorage {
  customVariables: Record<string, string>;  // 简化存储，只存值
  advancedModeEnabled: boolean;
  lastConversationMessages?: ConversationMessage[];
}

// 变量来源标识
export type VariableSource = 'predefined' | 'custom';

// 变量管理器接口
export interface IVariableManager {
  // 变量CRUD
  setVariable(name: string, value: string): void;
  getVariable(name: string): string | undefined;
  deleteVariable(name: string): void;
  listVariables(): Record<string, string>;
  
  // 变量解析（预定义 + 自定义）
  resolveAllVariables(context?: Record<string, unknown>): Record<string, string>;
  
  // 验证
  validateVariableName(name: string): boolean;
  scanVariablesInContent(content: string): string[];
  
  // 变量来源检查
  getVariableSource(name: string): VariableSource;
  isPredefinedVariable(name: string): boolean;
  
  // 高级模式状态
  getAdvancedModeEnabled(): boolean;
  setAdvancedModeEnabled(enabled: boolean): void;
  
  // 会话消息管理
  getLastConversationMessages(): ConversationMessage[];
  setLastConversationMessages(messages: ConversationMessage[]): void;
  
  // 缺失的方法
  getStatistics(): { customVariableCount: number; predefinedVariableCount: number; totalVariableCount: number; advancedModeEnabled: boolean; };
  replaceVariables(content: string, variables?: Record<string, string>): string;
  detectMissingVariables(content: string | ConversationMessage[], availableVariables?: Record<string, string>): string[];
  exportVariables(): string;
  importVariables(jsonData: string): void;
}

// 变量错误类
export class VariableError extends Error {
  constructor(
    message: string, 
    public variableName?: string, 
    public position?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'VariableError';
  }
}

import { PREDEFINED_VARIABLES as CORE_PREDEFINED_VARIABLES } from '@prompt-optimizer/core';

// 预定义变量常量（从core导入，保证一致性）
export const PREDEFINED_VARIABLES = CORE_PREDEFINED_VARIABLES;

export type PredefinedVariable = typeof PREDEFINED_VARIABLES[number];

// 变量验证规则
export const VARIABLE_VALIDATION = {
  // 变量名规则：不能为空，不能包含空白字符和花括号
  NAME_PATTERN: /^[^\s{}]+$/,
  MAX_NAME_LENGTH: 50,
  MAX_VALUE_LENGTH: 10000,
  VARIABLE_SCAN_PATTERN: /\{\{([^}]+)\}\}/g
} as const;
