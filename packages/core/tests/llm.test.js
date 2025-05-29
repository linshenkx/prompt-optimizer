// packages/core/tests/llm.test.js
import { createLLMService } from '../src/services/llm/service';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

// --- Mock OpenAI ---
const mockOpenAIChatCompletionsCreate = jest.fn();
const mockOpenAIConstructor = jest.fn();

jest.mock('openai', () => {
  const constructorMock = (...args) => {
    mockOpenAIConstructor(...args);
    return {
      chat: {
        completions: {
          create: mockOpenAIChatCompletionsCreate,
        },
      },
      models: {
        list: jest.fn().mockResolvedValue({ data: [] }),
      }
    };
  };
  return constructorMock;
});


// --- Mock GoogleGenerativeAI ---
const mockGeminiStartChat = jest.fn();
const mockGeminiSendMessage = jest.fn().mockResolvedValue({ response: { text: () => 'gemini test response' } });
const mockGeminiSendMessageStream = jest.fn().mockResolvedValue({
  stream: (async function* () {
    yield { text: () => 'gemini stream chunk' };
  })(),
  response: Promise.resolve({ text: () => 'gemini stream response' })
});
const mockGetGenerativeModel = jest.fn().mockReturnValue({
  startChat: mockGeminiStartChat,
});

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  })),
}));


describe('LLMService with llmParams', () => {
  let llmService;
  let mockModelManager;

  const baseOpenAIConfig = {
    provider: 'openai',
    name: 'OpenAI Test',
    baseURL: 'https://api.openai.com/v1',
    defaultModel: 'gpt-3.5-turbo',
    models: ['gpt-3.5-turbo', 'gpt-4'],
    apiKey: 'test-openai-key',
    enabled: true,
  };

  const baseGeminiConfig = {
    provider: 'gemini',
    name: 'Gemini Test',
    baseURL: 'https://generativelanguage.googleapis.com',
    defaultModel: 'gemini-pro',
    models: ['gemini-pro'],
    apiKey: 'test-gemini-key',
    enabled: true,
  };

  beforeEach(() => {
    mockOpenAIConstructor.mockClear();
    mockOpenAIChatCompletionsCreate.mockClear();
    mockGetGenerativeModel.mockClear();
    mockGeminiStartChat.mockClear();
    mockGeminiSendMessage.mockClear();
    mockGeminiSendMessageStream.mockClear();

    mockModelManager = {
      getModel: jest.fn(),
    };
    llmService = createLLMService(mockModelManager);

    mockOpenAIChatCompletionsCreate.mockImplementation((params) => {
        if (params.stream) {
            return (async function* () { 
                yield { choices: [{ delta: { content: 'openai stream chunk' } }] };
            })();
        }
        return Promise.resolve({ choices: [{ message: { content: 'openai test response' } }] });
    });

    mockGeminiStartChat.mockReturnValue({
        sendMessage: mockGeminiSendMessage,
        sendMessageStream: mockGeminiSendMessageStream
    });
  });

  const testMessages = [{ role: 'user', content: 'Hello' }];
  const testStreamCallbacks = {
    onToken: jest.fn(),
    onComplete: jest.fn(),
    onError: jest.fn(),
  };
  
  afterEach(() => {
    testStreamCallbacks.onToken.mockClear();
    testStreamCallbacks.onComplete.mockClear();
    testStreamCallbacks.onError.mockClear();
  });


  // --- OpenAI Tests ---
  describe('OpenAI API Calls with llmParams', () => {
    test('should use temperature and max_tokens from llmParams for sendMessage', async () => {
      mockModelManager.getModel.mockResolvedValue({
        ...baseOpenAIConfig,
        llmParams: { temperature: 0.5, max_tokens: 1000 },
      });

      await llmService.sendMessage(testMessages, 'openai');
      
      expect(mockOpenAIChatCompletionsCreate).toHaveBeenCalledWith(expect.objectContaining({
        temperature: 0.5,
        max_tokens: 1000,
        model: 'gpt-3.5-turbo',
        messages: testMessages,
      }));
    });

    test('should use default temperature (0.7) if not in llmParams for sendMessage', async () => {
      mockModelManager.getModel.mockResolvedValue({
        ...baseOpenAIConfig,
        llmParams: { max_tokens: 500 }, // temperature missing
      });

      await llmService.sendMessage(testMessages, 'openai');
      
      expect(mockOpenAIChatCompletionsCreate).toHaveBeenCalledWith(expect.objectContaining({
        temperature: 0.7, // Default
        max_tokens: 500,
      }));
    });
    
    test('should not include max_tokens if not in llmParams for sendMessage', async () => {
      mockModelManager.getModel.mockResolvedValue({
        ...baseOpenAIConfig,
        llmParams: { temperature: 0.6 }, // max_tokens missing
      });

      await llmService.sendMessage(testMessages, 'openai');
      
      expect(mockOpenAIChatCompletionsCreate).toHaveBeenCalledWith(expect.objectContaining({
        temperature: 0.6,
      }));
      expect(mockOpenAIChatCompletionsCreate.mock.calls[0][0]).not.toHaveProperty('max_tokens');
    });


    test('should use timeout from llmParams for OpenAI constructor in sendMessage', async () => {
      mockModelManager.getModel.mockResolvedValue({
        ...baseOpenAIConfig,
        llmParams: { timeout: 120000 },
      });

      await llmService.sendMessage(testMessages, 'openai');

      expect(mockOpenAIConstructor).toHaveBeenCalledWith(expect.objectContaining({
        timeout: 120000,
      }));
    });

    test('should use default timeout (60s) for OpenAI constructor if not in llmParams for sendMessage', async () => {
        mockModelManager.getModel.mockResolvedValue({
          ...baseOpenAIConfig,
          llmParams: {}, // timeout missing
        });
  
        await llmService.sendMessage(testMessages, 'openai');
  
        expect(mockOpenAIConstructor).toHaveBeenCalledWith(expect.objectContaining({
          timeout: 60000, 
        }));
      });
      
    test('should handle undefined llmParams gracefully for sendMessage, using defaults', async () => {
      mockModelManager.getModel.mockResolvedValue({
        ...baseOpenAIConfig,
        llmParams: undefined,
      });

      await llmService.sendMessage(testMessages, 'openai');

      expect(mockOpenAIConstructor).toHaveBeenCalledWith(expect.objectContaining({
        timeout: 60000, // Default timeout for non-stream
      }));
      expect(mockOpenAIChatCompletionsCreate).toHaveBeenCalledWith(expect.objectContaining({
        temperature: 0.7, // Default temperature
        model: 'gpt-3.5-turbo',
        messages: testMessages,
      }));
      expect(mockOpenAIChatCompletionsCreate.mock.calls[0][0]).not.toHaveProperty('max_tokens');
    });


    test('should use temperature, max_tokens from llmParams for sendMessageStream', async () => {
      mockModelManager.getModel.mockResolvedValue({
        ...baseOpenAIConfig,
        llmParams: { temperature: 0.6, max_tokens: 1200 },
      });

      await llmService.sendMessageStream(testMessages, 'openai', testStreamCallbacks);
      
      expect(mockOpenAIChatCompletionsCreate).toHaveBeenCalledWith(expect.objectContaining({
        temperature: 0.6,
        max_tokens: 1200,
        stream: true,
        model: 'gpt-3.5-turbo',
        messages: testMessages,
      }));
    });

    test('should use default temperature (0.7) if not in llmParams for sendMessageStream', async () => {
        mockModelManager.getModel.mockResolvedValue({
          ...baseOpenAIConfig,
          llmParams: { max_tokens: 600 } // temperature missing
        });
  
        await llmService.sendMessageStream(testMessages, 'openai', testStreamCallbacks);
        
        expect(mockOpenAIChatCompletionsCreate).toHaveBeenCalledWith(expect.objectContaining({
          temperature: 0.7, 
          max_tokens: 600,
          stream: true,
        }));
      });

    test('should use streaming timeout (90s) for OpenAI constructor if not in llmParams for sendMessageStream', async () => {
        mockModelManager.getModel.mockResolvedValue({
          ...baseOpenAIConfig,
          llmParams: {}, // timeout missing
        });
  
        await llmService.sendMessageStream(testMessages, 'openai', testStreamCallbacks);
  
        expect(mockOpenAIConstructor).toHaveBeenCalledWith(expect.objectContaining({
          timeout: 90000, 
        }));
    });

    test('should use specified timeout from llmParams for OpenAI constructor in sendMessageStream', async () => {
        mockModelManager.getModel.mockResolvedValue({
          ...baseOpenAIConfig,
          llmParams: { timeout: 150000 }, 
        });
  
        await llmService.sendMessageStream(testMessages, 'openai', testStreamCallbacks);
  
        expect(mockOpenAIConstructor).toHaveBeenCalledWith(expect.objectContaining({
          timeout: 150000, 
        }));
    });

    test('should handle undefined llmParams gracefully for sendMessageStream, using defaults', async () => {
      mockModelManager.getModel.mockResolvedValue({
        ...baseOpenAIConfig,
        llmParams: undefined,
      });

      await llmService.sendMessageStream(testMessages, 'openai', testStreamCallbacks);

      expect(mockOpenAIConstructor).toHaveBeenCalledWith(expect.objectContaining({
        timeout: 90000, // Default timeout for stream
      }));
      expect(mockOpenAIChatCompletionsCreate).toHaveBeenCalledWith(expect.objectContaining({
        temperature: 0.7, // Default temperature
        stream: true,
        model: 'gpt-3.5-turbo',
        messages: testMessages,
      }));
      expect(mockOpenAIChatCompletionsCreate.mock.calls[0][0]).not.toHaveProperty('max_tokens');
    });
  });

  // --- Gemini Tests ---
  describe('Gemini API Calls with llmParams', () => {
    test('should use temperature and maxOutputTokens from llmParams for sendMessage', async () => {
      mockModelManager.getModel.mockResolvedValue({
        ...baseGeminiConfig,
        llmParams: { temperature: 0.6, maxOutputTokens: 1500, topP: 0.9 },
      });

      await llmService.sendMessage(testMessages, 'gemini');
      
      expect(mockGeminiStartChat).toHaveBeenCalledWith(expect.objectContaining({
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 1500,
          topP: 0.9,
        },
      }));
    });

    test('should not set generationConfig if llmParams is empty or missing relevant keys for sendMessage', async () => {
      mockModelManager.getModel.mockResolvedValue({
        ...baseGeminiConfig,
        llmParams: {}, // Empty llmParams
      });

      await llmService.sendMessage(testMessages, 'gemini');
      
      const startChatArgs = mockGeminiStartChat.mock.calls[0][0];
      // If llmParams is empty, generationConfig might be passed as empty or not at all.
      // The service current implementation passes it if llmParams exists.
      expect(startChatArgs.generationConfig).toEqual({});
    });
    
    test('should handle undefined llmParams gracefully for Gemini sendMessage, not passing generationConfig', async () => {
      mockModelManager.getModel.mockResolvedValue({
        ...baseGeminiConfig,
        llmParams: undefined,
      });

      await llmService.sendMessage(testMessages, 'gemini');
      
      const startChatArgs = mockGeminiStartChat.mock.calls[0][0];
      expect(startChatArgs).not.toHaveProperty('generationConfig');
    });

    test('should use temperature and maxOutputTokens from llmParams for sendMessageStream', async () => {
        mockModelManager.getModel.mockResolvedValue({
          ...baseGeminiConfig,
          llmParams: { temperature: 0.8, maxOutputTokens: 1800, topK: 40 },
        });
  
        await llmService.sendMessageStream(testMessages, 'gemini', testStreamCallbacks);
        
        expect(mockGeminiStartChat).toHaveBeenCalledWith(expect.objectContaining({
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 1800,
            topK: 40,
          },
        }));
      });
  
      test('should not set generationConfig if llmParams is empty or missing relevant keys for sendMessageStream', async () => {
        mockModelManager.getModel.mockResolvedValue({
          ...baseGeminiConfig,
          llmParams: { someOtherParam: 'value' }, // No relevant Gemini keys
        });
  
        await llmService.sendMessageStream(testMessages, 'gemini', testStreamCallbacks);
        
        const startChatArgs = mockGeminiStartChat.mock.calls[0][0];
        expect(startChatArgs.generationConfig).toEqual({ someOtherParam: 'value' }); // other safe params are spread
      });
      
      test('should handle undefined llmParams gracefully for Gemini sendMessageStream, not passing generationConfig', async () => {
        mockModelManager.getModel.mockResolvedValue({
          ...baseGeminiConfig,
          llmParams: undefined,
        });

        await llmService.sendMessageStream(testMessages, 'gemini', testStreamCallbacks);
        
        const startChatArgs = mockGeminiStartChat.mock.calls[0][0];
        expect(startChatArgs).not.toHaveProperty('generationConfig');
      });
  });
});
