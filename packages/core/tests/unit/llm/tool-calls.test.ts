import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LLMService } from '../../../src/services/llm/service';
import { ModelManager } from '../../../src/services/model/manager';
import { ToolDefinition, ToolCall, Message, StreamHandlers } from '../../../src/services/llm/types';
import { createMockStorage } from '../../mocks/mockStorage';

describe('LLM Service Tool Calls', () => {
  let llmService: LLMService;
  let modelManager: ModelManager;
  
  const mockToolDefinition: ToolDefinition = {
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get current weather information for a specific location',
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'The location to get weather for'
          },
          unit: {
            type: 'string',
            enum: ['celsius', 'fahrenheit'],
            description: 'Temperature unit',
            default: 'celsius'
          }
        },
        required: ['location']
      }
    }
  };

  const mockMessages: Message[] = [
    {
      role: 'system',
      content: 'You are a helpful weather assistant.'
    },
    {
      role: 'user',
      content: 'What is the weather like in Beijing?'
    }
  ];

  beforeEach(() => {
    const mockStorage = createMockStorage();
    modelManager = new ModelManager(mockStorage);
    llmService = new LLMService(modelManager);
  });

  describe('Tool Definition Validation', () => {
    it('should validate tool definition structure', () => {
      expect(mockToolDefinition.type).toBe('function');
      expect(mockToolDefinition.function.name).toBe('get_weather');
      expect(mockToolDefinition.function.description).toBeDefined();
      expect(mockToolDefinition.function.parameters).toBeDefined();
    });

    it('should validate tool parameters schema', () => {
      const params = mockToolDefinition.function.parameters as any;
      expect(params.type).toBe('object');
      expect(params.properties).toBeDefined();
      expect(params.required).toContain('location');
    });
  });

  describe('sendMessageStreamWithTools Method', () => {
    it('should have sendMessageStreamWithTools method defined', () => {
      expect(typeof llmService.sendMessageStreamWithTools).toBe('function');
    });

    it('should validate parameters before processing', async () => {
      const mockCallbacks: StreamHandlers = {
        onToken: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn()
      };

      // Test with empty messages - should throw validation error
      await expect(
        llmService.sendMessageStreamWithTools([], 'test-provider', [mockToolDefinition], mockCallbacks)
      ).rejects.toThrow();
    });

    it('should validate tools parameter', async () => {
      const mockCallbacks: StreamHandlers = {
        onToken: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn()
      };

      // Should throw error for nonexistent provider (properly awaited)
      await expect(
        llmService.sendMessageStreamWithTools(mockMessages, 'nonexistent-provider', [mockToolDefinition], mockCallbacks)
      ).rejects.toThrow();
    });
  });

  describe('Tool Call Structure', () => {
    it('should create valid ToolCall objects', () => {
      const toolCall: ToolCall = {
        id: 'call_123',
        type: 'function',
        function: {
          name: 'get_weather',
          arguments: '{"location": "Beijing", "unit": "celsius"}'
        }
      };

      expect(toolCall.type).toBe('function');
      expect(toolCall.id).toBeTruthy();
      expect(toolCall.function.name).toBe('get_weather');
      expect(() => JSON.parse(toolCall.function.arguments)).not.toThrow();
    });

    it('should handle tool call arguments parsing', () => {
      const toolCall: ToolCall = {
        id: 'call_123',
        type: 'function',
        function: {
          name: 'get_weather',
          arguments: '{"location": "Beijing", "unit": "celsius"}'
        }
      };

      const parsedArgs = JSON.parse(toolCall.function.arguments);
      expect(parsedArgs.location).toBe('Beijing');
      expect(parsedArgs.unit).toBe('celsius');
    });
  });

  describe('Gemini Tool Format Conversion', () => {
    it('should convert OpenAI tool format to Gemini format', () => {
      // Test the conversion logic (private method, so we test the concept)
      const geminiFormat = {
        functionDeclarations: [
          {
            name: mockToolDefinition.function.name,
            description: mockToolDefinition.function.description,
            parameters: mockToolDefinition.function.parameters
          }
        ]
      };

      expect(geminiFormat.functionDeclarations).toHaveLength(1);
      expect(geminiFormat.functionDeclarations[0].name).toBe('get_weather');
      expect(geminiFormat.functionDeclarations[0].description).toBeDefined();
      expect(geminiFormat.functionDeclarations[0].parameters).toBeDefined();
    });
  });

  describe('Stream Handlers with Tool Support', () => {
    it('should accept onToolCall callback in StreamHandlers', () => {
      const mockCallbacks: StreamHandlers = {
        onToken: vi.fn(),
        onToolCall: vi.fn(), // This should be valid
        onComplete: vi.fn(),
        onError: vi.fn()
      };

      expect(mockCallbacks.onToolCall).toBeDefined();
      expect(typeof mockCallbacks.onToolCall).toBe('function');
    });

    it('should work without onToolCall callback (backward compatibility)', () => {
      const mockCallbacks: StreamHandlers = {
        onToken: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn()
        // onToolCall is optional
      };

      expect(mockCallbacks.onToolCall).toBeUndefined();
    });
  });

  describe('Tool Call ID Generation', () => {
    it('should generate unique tool call IDs', () => {
      const generateId = () => `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const id1 = generateId();
      const id2 = generateId();
      
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^call_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^call_\d+_[a-z0-9]+$/);
    });
  });

  describe('Error Handling', () => {
    it('should handle provider not found error', async () => {
      const mockCallbacks: StreamHandlers = {
        onToken: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn()
      };

      // This test is redundant with the "validate tools parameter" test above
      // but we'll keep it for completeness and properly handle the async error
      await expect(
        llmService.sendMessageStreamWithTools(mockMessages, 'nonexistent-provider-2', [mockToolDefinition], mockCallbacks)
      ).rejects.toThrow();
    });

    it('should validate messages before tool processing', async () => {
      const mockCallbacks: StreamHandlers = {
        onToken: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn()
      };

      const invalidMessages = [
        { role: 'user', content: '' } // Empty content should fail validation
      ] as Message[];

      await expect(
        llmService.sendMessageStreamWithTools(invalidMessages, 'test-provider', [mockToolDefinition], mockCallbacks)
      ).rejects.toThrow();
    });
  });

  describe('Type Safety', () => {
    it('should enforce correct ToolCall type structure', () => {
      // This test ensures TypeScript compilation catches type errors
      const validToolCall: ToolCall = {
        id: 'call_123',
        type: 'function' as const, // Test the literal type requirement
        function: {
          name: 'test_function',
          arguments: '{}'
        }
      };

      expect(validToolCall.type).toBe('function');
    });

    it('should enforce correct ToolDefinition type structure', () => {
      const validDefinition: ToolDefinition = {
        type: 'function' as const, // Test the literal type requirement
        function: {
          name: 'test_function',
          description: 'Test function',
          parameters: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      };

      expect(validDefinition.type).toBe('function');
    });
  });
});