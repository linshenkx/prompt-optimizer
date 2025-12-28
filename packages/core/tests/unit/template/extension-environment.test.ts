import { describe, it, expect } from 'vitest';
import { TemplateProcessor } from '../../../src/services/template/processor';
import type { Template, TemplateContext } from '../../../src/services/template/processor';

describe('TemplateProcessor with Mustache (Universal CSP-safe)', () => {
  it('should process simple templates correctly', () => {
    const template: Template = {
      id: 'simple-test',
      name: 'Simple Test',
      content: 'Hello, this is a simple template',
      metadata: {
        version: '1.0.0',
        lastModified: Date.now(),
        author: 'Test',
        templateType: 'optimize',
        language: 'zh'
      },
      isBuiltin: false
    };

    const context: TemplateContext = {
      originalPrompt: 'Test prompt'
    };

    const result = TemplateProcessor.processTemplate(template, context);
    
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      role: 'system',
      content: 'Hello, this is a simple template'
    });
    expect(result[1]).toEqual({
      role: 'user',
      content: 'Test prompt'
    });
  });

  it('should process advanced templates with variables', () => {
    const template: Template = {
      id: 'advanced-test',
      name: 'Advanced Test',
      content: [
        {
          role: 'system',
          content: 'Hello {{name}}, this is a test template.'
        },
        {
          role: 'user',  
          content: '{{originalPrompt}}'
        }
      ],
      metadata: {
        version: '1.0.0',
        lastModified: Date.now(),
        author: 'Test',
        templateType: 'optimize',
        language: 'zh'
      },
      isBuiltin: false
    };

    const context: TemplateContext = {
      name: 'World',
      originalPrompt: 'Test prompt'
    };

    const result = TemplateProcessor.processTemplate(template, context);
    
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      role: 'system',
      content: 'Hello World, this is a test template.'
    });
    expect(result[1]).toEqual({
      role: 'user',
      content: 'Test prompt'
    });
  });

  it('should process conditional blocks', () => {
    const template: Template = {
      id: 'conditional-test',
      name: 'Conditional Test',
      content: [
        {
          role: 'system',
          content: `{{#conversationContext}}Context: {{conversationContext}}{{/conversationContext}}{{^conversationContext}}No context{{/conversationContext}}`
        }
      ],
      metadata: {
        version: '1.0.0',
        lastModified: Date.now(),
        author: 'Test',
        templateType: 'optimize',
        language: 'zh'
      },
      isBuiltin: false
    };

    // Test with context
    const contextWithConversation: TemplateContext = {
      conversationContext: 'Some conversation'
    };

    let result = TemplateProcessor.processTemplate(template, contextWithConversation);
    expect(result[0].content).toBe('Context: Some conversation');

    // Test without context
    const contextWithoutConversation: TemplateContext = {};

    result = TemplateProcessor.processTemplate(template, contextWithoutConversation);
    expect(result[0].content).toBe('No context');
  });

  it('should process tool context information', () => {
    const template: Template = {
      id: 'tools-test',
      name: 'Tools Test',
      content: [
        {
          role: 'system',
          content: `{{#toolsContext}}Available tools:\n{{toolsContext}}{{/toolsContext}}{{^toolsContext}}No tools available{{/toolsContext}}`
        }
      ],
      metadata: {
        version: '1.0.0',
        lastModified: Date.now(),
        author: 'Test',
        templateType: 'optimize',
        language: 'zh'
      },
      isBuiltin: false
    };

    // Test with tools
    const contextWithTools: TemplateContext = {
      toolsContext: 'Tool 1: Search\nTool 2: Calculate'
    };

    let result = TemplateProcessor.processTemplate(template, contextWithTools);
    expect(result[0].content).toBe('Available tools:\nTool 1: Search\nTool 2: Calculate');

    // Test without tools
    const contextWithoutTools: TemplateContext = {};

    result = TemplateProcessor.processTemplate(template, contextWithoutTools);
    expect(result[0].content).toBe('No tools available');
  });

  it('should handle iteration context', () => {
    const template: Template = {
      id: 'iterate-test',
      name: 'Iterate Test',
      content: [
        {
          role: 'system',
          content: 'Original: {{originalPrompt}}\nIterate: {{iterateInput}}'
        }
      ],
      metadata: {
        version: '1.0.0',
        lastModified: Date.now(),
        author: 'Test',
        templateType: 'iterate',
        language: 'zh'
      },
      isBuiltin: false
    };

    const context: TemplateContext = {
      originalPrompt: 'Original prompt',
      iterateInput: 'Iterate input'
    };

    const result = TemplateProcessor.processTemplate(template, context);
    expect(result[0].content).toBe('Original: Original prompt\nIterate: Iterate input');
  });

  it('should validate template content', () => {
    const invalidTemplate: Template = {
      id: 'invalid-test',
      name: 'Invalid Test',
      content: '',
      metadata: {
        version: '1.0.0',
        lastModified: Date.now(),
        author: 'Test',
        templateType: 'optimize',
        language: 'zh'
      },
      isBuiltin: false
    };

    const context: TemplateContext = {};

    expect(() => {
      TemplateProcessor.processTemplate(invalidTemplate, context);
    }).toThrow('Template content is missing or invalid');
  });

  // 注：TemplateProcessor 不再负责迭代上下文检查
  // 该检查已移至 PromptService.iteratePrompt/iteratePromptStream 入口处
  // 相关测试已移至 prompt service 测试文件
});