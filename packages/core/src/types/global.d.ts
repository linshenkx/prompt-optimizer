interface Window {
  runtime_config?: {
    OPENAI_API_KEY?: string;
    GEMINI_API_KEY?: string;
    DEEPSEEK_API_KEY?: string;
    SILICONFLOW_API_KEY?: string;
    ZHIPU_API_KEY?: string;
    CUSTOM_API_KEY?: string;
    CUSTOM_API_BASE_URL?: string;
    CUSTOM_API_MODEL?: string;
    [key: string]: string | undefined;
  };
  electronAPI?: {
    llm: {
      // Define the methods for the LLM API proxy
      sendMessage: (messages: any[], provider: string) => Promise<string>;
      sendMessageStructured: (messages: any[], provider: string) => Promise<any>;
      sendMessageStream: (
        messages: any[],
        provider: string,
        callbacks: {
          onContent?: (content: string) => void;
          onThinking?: (thinking: string) => void;
          onToolCall?: (toolCall: any) => void;
          onFinish?: () => void;
          onError?: (error: Error) => void;
        }
      ) => Promise<void>;
      sendMessageStreamWithTools?: (
        messages: any[],
        provider: string,
        tools: any[],
        callbacks: {
          onContent?: (content: string) => void;
          onThinking?: (thinking: string) => void;
          onToolCall?: (toolCall: any) => void;
          onFinish?: () => void;
          onError?: (error: Error) => void;
        }
      ) => Promise<void>;
      testConnection: (provider: string) => Promise<void>;
      fetchModelList: (provider: string, customConfig?: any) => Promise<Array<{value: string, label: string}>>;
    };
    model: {
      getModels: () => Promise<any[]>;
      addModel: (model: any) => Promise<void>;
      updateModel: (id: string, updates: any) => Promise<void>;
      deleteModel: (id: string) => Promise<void>;
      getEnabledModels: () => Promise<Array<any>>;
    };
    template: {
      getTemplates: () => Promise<any[]>;
      getTemplate: (id: string) => Promise<any>;
      createTemplate: (template: any) => Promise<any>;
      updateTemplate: (id: string, updates: any) => Promise<void>;
      deleteTemplate: (id: string) => Promise<void>;
      listTemplatesByType: (type: 'optimize' | 'userOptimize' | 'iterate') => Promise<any[]>;
    };
    history: {
      getHistory: () => Promise<any[]>;
      addRecord: (record: any) => Promise<any>;
      deleteRecord: (id: string) => Promise<void>;
      clearHistory: () => Promise<void>;
      getIterationChain: (recordId: string) => Promise<any[]>;
      getAllChains: () => Promise<any[]>;
      getChain: (chainId: string) => Promise<any>;
      createNewChain: (record: any) => Promise<any>;
      addIteration: (params: {
        chainId: string;
        originalPrompt: string;
        optimizedPrompt: string;
        iterationNote?: string;
        modelKey: string;
        templateId: string;
      }) => Promise<any>;
      deleteChain: (chainId: string) => Promise<void>;
    };
    context: {
      list: () => Promise<Array<{ id: string; title: string; updatedAt: string }>>;
      getCurrentId: () => Promise<string>;
      setCurrentId: (id: string) => Promise<void>;
      get: (id: string) => Promise<any>;
      create: (meta?: { title?: string }) => Promise<string>;
      duplicate: (id: string) => Promise<string>;
      rename: (id: string, title: string) => Promise<void>;
      save: (ctx: any) => Promise<void>;
      update: (id: string, patch: any) => Promise<void>;
      remove: (id: string) => Promise<void>;
      exportAll: () => Promise<any>;
      importAll: (bundle: any, mode: 'replace' | 'append' | 'merge') => Promise<any>;
      exportData?: () => Promise<any>;
      importData?: (data: any) => Promise<void>;
      getDataType?: () => Promise<string>;
      validateData?: (data: any) => Promise<boolean>;
    };
    config: {
      getEnvironmentVariables: () => Promise<Record<string, string>>;
    };
    image: {
      generate: (request: any) => Promise<any>;
      validateRequest: (request: any) => Promise<void>;
      testConnection: (config: any) => Promise<any>;
      getDynamicModels: (providerId: string, connectionConfig: any) => Promise<any[]>;
    };
    imageModel: {
      ensureInitialized: () => Promise<void>;
      isInitialized: () => Promise<boolean>;
      getAllConfigs: () => Promise<any[]>;
      getConfig: (id: string) => Promise<any>;
      addConfig: (config: any) => Promise<void>;
      updateConfig: (id: string, updates: any) => Promise<void>;
      deleteConfig: (id: string) => Promise<void>;
      getEnabledConfigs: () => Promise<any[]>;
      exportData: () => Promise<any>;
      importData: (data: any) => Promise<void>;
      getDataType: () => Promise<string>;
      validateData: (data: any) => Promise<boolean>;
    };
    storage: {
      // Define the methods for the Storage API proxy
      getItem: (key: string) => Promise<string | null>;
      setItem: (key: string, value: string) => Promise<void>;
      removeItem: (key: string) => Promise<void>;
      clearAll: () => Promise<void>;
      atomicUpdate: <T>(key: string, updateFn: (currentValue: T | null) => T) => Promise<void>;
      updateData: <T>(key: string, modifier: (currentValue: T | null) => T) => Promise<void>;
      batchUpdate: (operations: Array<{ key: string; operation: 'set' | 'remove'; value?: string }>) => Promise<void>;
      getStorageInfo: () => Promise<{ itemCount: number; estimatedSize: number; lastUpdated: number | null }>;
      exportAll: () => Promise<Record<string, string>>;
      importAll: (data: Record<string, string>) => Promise<void>;
      close: () => Promise<void>;
    };
  };
} 
