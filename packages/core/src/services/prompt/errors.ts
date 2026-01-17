/**
 * Prompt module error params for i18n interpolation.
 */
import type { ErrorParams } from '../../constants/error-codes';

export type PromptErrorParams = ErrorParams;

/**
 * 提示词服务基础错误
 *
 * code: i18n key (e.g. "error.prompt.optimization")
 * params: interpolation values for UI translation
 */
export class PromptError extends Error {
  public readonly code: string;
  public readonly params?: PromptErrorParams;

  constructor(code: string, message?: string, params?: PromptErrorParams) {
    super(message ? `[${code}] ${message}` : `[${code}]`);
    this.name = "PromptError";
    this.code = code;
    this.params = params;
  }
}

/**
 * 优化错误
 */
export class OptimizationError extends PromptError {
  constructor(originalPrompt: string, details?: string) {
    super('error.prompt.optimization', details, { details });
    this.name = "OptimizationError";
    this.originalPrompt = originalPrompt;
  }

  public originalPrompt: string;
}

/**
 * 迭代错误
 */
export class IterationError extends PromptError {
  constructor(originalPrompt: string, iterateInput: string, details?: string) {
    super('error.prompt.iteration', details, { details });
    this.name = "IterationError";
    this.originalPrompt = originalPrompt;
    this.iterateInput = iterateInput;
  }

  public originalPrompt: string;
  public iterateInput: string;
}

/**
 * 测试错误
 */
export class TestError extends PromptError {
  constructor(prompt: string, testInput: string, details?: string) {
    super('error.prompt.test', details, { details });
    this.name = "TestError";
    this.prompt = prompt;
    this.testInput = testInput;
  }

  public prompt: string;
  public testInput: string;
}

/**
 * 服务依赖错误
 */
export class ServiceDependencyError extends PromptError {
  constructor(serviceName: string, details?: string) {
    super('error.prompt.service_dependency', details, { details });
    this.name = "ServiceDependencyError";
    this.serviceName = serviceName;
  }

  public serviceName: string;
}
