/**
 * MCP Tools 基础测试
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { CoreServicesManager } from '../src/adapters/core-services.js';
import { ParameterValidator } from '../src/adapters/parameter-adapter.js';
import { MCPErrorHandler, MCP_ERROR_CODES } from '../src/adapters/error-handler.js';
import {
  buildPromptWithXCContext,
  buildWikiPromptGoal,
  getXCContextSchemaProperties,
  validateXCContext
} from '../src/adapters/xc-context.js';

describe('MCP Server Tools', () => {
  let coreServices: CoreServicesManager;

  beforeAll(async () => {
    // 设置测试环境变量
    process.env.MCP_DEFAULT_MODEL_API_KEY = 'test-key';
    process.env.MCP_DEFAULT_MODEL_PROVIDER = 'openai';
    process.env.MCP_DEFAULT_MODEL_NAME = 'gpt-4';

    coreServices = CoreServicesManager.getInstance();
    
    // 注意：这里只测试初始化，不测试实际的 LLM 调用
    // 实际的 LLM 调用需要真实的 API 密钥
  });

  describe('ParameterValidator', () => {
    it('validates prompt input', () => {
      expect(() => ParameterValidator.validatePrompt('valid prompt')).not.toThrow();
      expect(() => ParameterValidator.validatePrompt('')).toThrow('Prompt must be a non-empty string');
      expect(() => ParameterValidator.validatePrompt('   ')).toThrow('Prompt must be a non-empty string');
      expect(() => ParameterValidator.validatePrompt('a'.repeat(60000))).toThrow('Prompt must not exceed 50,000 characters');
    });

    it('validates requirements input', () => {
      expect(() => ParameterValidator.validateRequirements('valid requirements')).not.toThrow();
      expect(() => ParameterValidator.validateRequirements('')).toThrow('Requirements must be a non-empty string');
      expect(() => ParameterValidator.validateRequirements('   ')).toThrow('Requirements must be a non-empty string');
      expect(() => ParameterValidator.validateRequirements('a'.repeat(15000))).toThrow('Requirements must not exceed 10,000 characters');
    });

    it('validates template input', () => {
      expect(() => ParameterValidator.validateTemplate('valid-template')).not.toThrow();
      expect(() => ParameterValidator.validateTemplate(undefined)).not.toThrow();
      expect(() => ParameterValidator.validateTemplate('')).toThrow('Template must be a non-empty string');
      expect(() => ParameterValidator.validateTemplate('   ')).toThrow('Template must be a non-empty string');
    });
  });

  describe('MCPErrorHandler', () => {
    it('converts validation errors', () => {
      const error = new Error('Prompt must be a non-empty string');
      const mcpError = MCPErrorHandler.convertCoreError(error);

      expect(mcpError.code).toBe(MCP_ERROR_CODES.INVALID_PARAMS); // -32602
      expect(mcpError.message).toContain('Prompt must be a non-empty string');
    });

    it('converts optimization errors', () => {
      const error = new Error('Optimization failed');
      error.name = 'OptimizationError';
      const mcpError = MCPErrorHandler.convertCoreError(error);

      expect(mcpError.code).toBe(MCP_ERROR_CODES.PROMPT_OPTIMIZATION_FAILED); // -32001
      expect(mcpError.message).toContain('Prompt optimization failed');
    });

    it('converts unknown errors to internal errors', () => {
      const error = new Error('Unknown failure');
      const mcpError = MCPErrorHandler.convertCoreError(error);

      expect(mcpError.code).toBe(MCP_ERROR_CODES.INTERNAL_ERROR); // -32000
      expect(mcpError.message).toContain('Internal error');
    });

    it('creates validation errors', () => {
      const mcpError = MCPErrorHandler.createValidationError('Validation issue');

      expect(mcpError.code).toBe(MCP_ERROR_CODES.INVALID_PARAMS);
      expect(mcpError.message).toContain('Parameter validation failed: Validation issue');
    });

    it('creates internal errors', () => {
      const mcpError = MCPErrorHandler.createInternalError('Internal failure');

      expect(mcpError.code).toBe(MCP_ERROR_CODES.INTERNAL_ERROR);
      expect(mcpError.message).toContain('Internal failure');
    });
  });

  describe('XC context adapter', () => {
    it('validates supported caller systems and wiki source refs', () => {
      expect(() => validateXCContext({
        caller_system: 'feishu',
        wiki_context: {
          query: 'SOP',
          scope: 'factory/wiki',
          chunks: ['Use approved wiki procedures only.'],
          source_refs: [{
            title: 'SOP page',
            url: 'https://example.com/wiki/sop',
            excerpt: 'Approved procedure excerpt'
          }]
        }
      })).not.toThrow();

      expect(() => validateXCContext({ caller_system: 'unknown-system' }))
        .toThrow('caller_system must be one of');
      expect(() => validateXCContext({
        wiki_context: { chunks: Array.from({ length: 21 }, (_, index) => `chunk ${index}`) }
      })).toThrow('wiki_context.chunks must not exceed 20 items');
    });

    it('injects XC context into prompts', () => {
      const prompt = buildPromptWithXCContext('Summarize this process.', {
        caller_system: 'hermes',
        task_type: 'wiki_summary',
        output_contract: 'Return Chinese bullet points.',
        wiki_context: {
          scope: 'operations',
          chunks: ['Only cite confirmed wiki facts.']
        }
      });

      expect(prompt).toContain('[XC Context]');
      expect(prompt).toContain('Caller System: hermes');
      expect(prompt).toContain('Output Contract:');
      expect(prompt).toContain('[Original Prompt]');
    });

    it('builds wiki prompt generation goals with source boundaries', () => {
      const prompt = buildWikiPromptGoal('Create a Feishu embedded prompt.', {
        caller_system: 'feishu',
        source_refs: [{ id: 'wiki-1', title: 'Feishu SOP' }]
      });

      expect(prompt).toContain('Create a production-ready prompt for GlobalCloud XiaoC (XC).');
      expect(prompt).toContain('source boundaries');
      expect(prompt).toContain('id=wiki-1');
    });

    it('exposes XC context fields in tool schemas', () => {
      const schema = getXCContextSchemaProperties();
      expect(schema).toHaveProperty('caller_system');
      expect(schema).toHaveProperty('wiki_context');
      expect(schema).toHaveProperty('source_refs');
    });
  });
});
