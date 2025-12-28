import { describe, it, expect } from 'vitest';
import { TemplateProcessor, TemplateContext } from '../../../src/services/template/processor';
import { Template, MessageTemplate } from '../../../src/services/template/types';

describe('TemplateProcessor (Simplified)', () => {
  describe('processTemplate', () => {
    it('should process simple template without variable substitution', () => {
      const template: Template = {
        id: 'test',
        name: 'Test Template',
        content: 'You are a helpful assistant. Please help with optimization.',
        metadata: {
          version: '1.0',
          lastModified: Date.now(),
          templateType: 'optimize'
        }
      };

      const context: TemplateContext = {
        originalPrompt: 'Write a poem about cats'
      };

      const result = TemplateProcessor.processTemplate(template, context);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        role: 'system',
        content: 'You are a helpful assistant. Please help with optimization.'
      });
      expect(result[1]).toEqual({
        role: 'user',
        content: 'Write a poem about cats'
      });
    });

    it('should process message template with variable substitution', () => {
      const messageTemplates: MessageTemplate[] = [
        {
          role: 'system',
          content: 'You are a {{role}} expert.'
        },
        {
          role: 'user',
          content: 'Please help me with: {{originalPrompt}}'
        }
      ];

      const template: Template = {
        id: 'test-message',
        name: 'Test Message Template',
        content: messageTemplates,
        metadata: {
          version: '1.0',
          lastModified: Date.now(),
          templateType: 'optimize'
        }
      };

      const context: TemplateContext = {
        role: 'writing',
        originalPrompt: 'creating a novel'
      };

      const result = TemplateProcessor.processTemplate(template, context);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        role: 'system',
        content: 'You are a writing expert.'
      });
      expect(result[1]).toEqual({
        role: 'user',
        content: 'Please help me with: creating a novel'
      });
    });

    // 注：TemplateProcessor 不再负责迭代上下文检查
    // 该检查已移至 PromptService.iteratePrompt/iteratePromptStream 入口处

    it('should handle iteration context with advanced template', () => {
      const template: Template = {
        id: 'test-iterate',
        name: 'Test Iterate Template',
        content: [
          {
            role: 'system',
            content: 'You are an expert prompt optimizer.'
          },
          {
            role: 'user',
            content: 'Original: {{originalPrompt}}\n\nImprove: {{iterateInput}}'
          }
        ],
        metadata: {
          version: '1.0',
          lastModified: Date.now(),
          templateType: 'iterate'
        }
      };

      const context: TemplateContext = {
        originalPrompt: 'Write a story',
        iterateInput: 'Make it more dramatic'
      };

      const result = TemplateProcessor.processTemplate(template, context);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        role: 'system',
        content: 'You are an expert prompt optimizer.'
      });
      expect(result[1]).toEqual({
        role: 'user',
        content: 'Original: Write a story\n\nImprove: Make it more dramatic'
      });
    });
  });
}); 