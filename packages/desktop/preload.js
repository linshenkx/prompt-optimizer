const { contextBridge, ipcRenderer } = require('electron');

// IPC事件名称常量 - 直接内联避免沙箱环境的模块加载问题
const IPC_EVENTS = {
  UPDATE_CHECK: 'updater-check-update',
  UPDATE_START_DOWNLOAD: 'updater-start-download',
  UPDATE_INSTALL: 'updater-install-update',
  UPDATE_IGNORE_VERSION: 'updater-ignore-version',
  UPDATE_UNIGNORE_VERSION: 'updater-unignore-version',
  UPDATE_GET_IGNORED_VERSIONS: 'updater-get-ignored-versions',
  UPDATE_DOWNLOAD_SPECIFIC_VERSION: 'updater-download-specific-version',
  UPDATE_CHECK_ALL_VERSIONS: 'updater-check-all-versions', // 新增常量

  // 主进程发送给渲染进程的事件
  UPDATE_AVAILABLE_INFO: 'update-available-info',
  UPDATE_NOT_AVAILABLE: 'update-not-available',
  UPDATE_DOWNLOAD_PROGRESS: 'update-download-progress',
  UPDATE_DOWNLOADED: 'update-downloaded',
  UPDATE_ERROR: 'update-error',
  UPDATE_DOWNLOAD_STARTED: 'updater-download-started'
};

// 简单的超时包装器，避免过度设计
const withTimeout = (promise, timeoutMs = 30000) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => {
        const timeoutError = new Error(`Operation timed out after ${timeoutMs}ms`);
        timeoutError.code = 'TIMEOUT';
        timeoutError.detailedMessage = `[${new Date().toISOString()}] Timeout Error:\n\nOperation timed out after ${timeoutMs}ms\nThis usually indicates network connectivity issues or server problems.`;
        reject(timeoutError);
      }, timeoutMs);
    })
  ]);
};

// 生成唯一的流式请求ID
function generateStreamId() {
  return `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function createIpcError(payload) {
  if (!payload) {
    // Throw a plain object so renderer can still read properties across contextBridge.
    return { message: 'Unknown IPC error' };
  }

  if (typeof payload === 'string') {
    return new Error(payload);
  }

  // IMPORTANT:
  // Errors do NOT reliably preserve custom fields (e.g. `code`, `params`) across
  // Electron contextBridge/isolated worlds. If we wrap a structured payload
  // into an Error and throw it, the renderer may only receive `message`.
  //
  // So for structured IPC errors, throw a plain object. UI will translate via
  // `code + params` (see getI18nErrorMessage).
  if (payload && typeof payload === 'object') {
    const hasCode = typeof payload.code === 'string' && payload.code.length > 0
    const hasParams = payload.params && typeof payload.params === 'object'

    const message = typeof payload.message === 'string' && payload.message
      ? payload.message
      : (typeof payload.code === 'string' ? `[${payload.code}]` : 'Unknown IPC error');

    // For plain message-only errors, throw an Error so callers relying on
    // `instanceof Error` (and `.message`) keep working.
    if (!hasCode && !hasParams) {
      return new Error(message)
    }

    return { ...payload, message };
  }

  return new Error(String(payload));
}

async function invokeFavorite(channel, ...args) {
  const result = await ipcRenderer.invoke(channel, ...args);
  if (!result.success) {
    throw createIpcError(result.error);
  }
  return result.data;
}

contextBridge.exposeInMainWorld('electronAPI', {
  // IPC event listeners
  on: (channel, callback) => {
    ipcRenderer.on(channel, (event, ...args) => callback(...args));
  },
  off: (channel, callback) => {
    ipcRenderer.removeListener(channel, callback);
  },

  // High-level LLM service interface
  llm: {
    // Test connection to a provider
    testConnection: async (provider) => {
      const result = await ipcRenderer.invoke('llm-testConnection', provider);
      if (!result.success) {
        throw createIpcError(result.error);
      }
      return result.data;
    },

    // Send a simple message
    sendMessage: async (messages, provider) => {
      const result = await ipcRenderer.invoke('llm-sendMessage', messages, provider);
      if (!result.success) {
        throw createIpcError(result.error);
      }
      return result.data;
    },

    // Send a structured message
    sendMessageStructured: async (messages, provider) => {
      const result = await ipcRenderer.invoke('llm-sendMessageStructured', messages, provider);
      if (!result.success) {
        throw createIpcError(result.error);
      }
      return result.data;
    },

    // Fetch model list
    fetchModelList: async (provider, customConfig) => {
      const result = await ipcRenderer.invoke('llm-fetchModelList', provider, customConfig);
      if (!result.success) {
        throw createIpcError(result.error);
      }
      return result.data;
    },

    // Send streaming message
    sendMessageStream: async (messages, provider, callbacks) => {
      const streamId = generateStreamId();
      
      // Set up event listeners for streaming responses
      const contentListener = (event, content) => {
        if (callbacks.onContent) callbacks.onContent(content);
      };
      const thinkingListener = (event, thinking) => {
        if (callbacks.onThinking) callbacks.onThinking(thinking);
      };
      const finishListener = (event) => {
        cleanup();
        if (callbacks.onFinish) callbacks.onFinish();
      };
      const errorListener = (event, error) => {
        cleanup();
        if (callbacks.onError) callbacks.onError(new Error(error));
      };

      // Clean up listeners
      const cleanup = () => {
        ipcRenderer.removeListener(`stream-content-${streamId}`, contentListener);
        ipcRenderer.removeListener(`stream-thinking-${streamId}`, thinkingListener);
        ipcRenderer.removeListener(`stream-finish-${streamId}`, finishListener);
        ipcRenderer.removeListener(`stream-error-${streamId}`, errorListener);
      };

      // Register listeners
      ipcRenderer.on(`stream-content-${streamId}`, contentListener);
      ipcRenderer.on(`stream-thinking-${streamId}`, thinkingListener);
      ipcRenderer.on(`stream-finish-${streamId}`, finishListener);
      ipcRenderer.on(`stream-error-${streamId}`, errorListener);

      // Send the streaming request
      try {
        const result = await ipcRenderer.invoke('llm-sendMessageStream', messages, provider, streamId);
        if (!result.success) {
          cleanup();
          throw createIpcError(result.error);
        }
      } catch (error) {
        cleanup();
        throw error;
      }
    },

    // Send streaming message with tools (supports tool-call events)
    sendMessageStreamWithTools: async (messages, provider, tools, callbacks) => {
      const streamId = generateStreamId();

      // Set up event listeners for streaming responses
      const contentListener = (event, content) => {
        if (callbacks.onContent) callbacks.onContent(content);
      };
      const thinkingListener = (event, thinking) => {
        if (callbacks.onThinking) callbacks.onThinking(thinking);
      };
      const toolCallListener = (event, toolCall) => {
        if (callbacks.onToolCall) callbacks.onToolCall(toolCall);
      };
      const finishListener = (event) => {
        cleanup();
        if (callbacks.onFinish) callbacks.onFinish();
      };
      const errorListener = (event, error) => {
        cleanup();
        if (callbacks.onError) callbacks.onError(new Error(error));
      };

      // Clean up listeners
      const cleanup = () => {
        ipcRenderer.removeListener(`stream-content-${streamId}`, contentListener);
        ipcRenderer.removeListener(`stream-thinking-${streamId}`, thinkingListener);
        ipcRenderer.removeListener(`stream-tool-call-${streamId}`, toolCallListener);
        ipcRenderer.removeListener(`stream-finish-${streamId}`, finishListener);
        ipcRenderer.removeListener(`stream-error-${streamId}`, errorListener);
      };

      // Register listeners
      ipcRenderer.on(`stream-content-${streamId}`, contentListener);
      ipcRenderer.on(`stream-thinking-${streamId}`, thinkingListener);
      ipcRenderer.on(`stream-tool-call-${streamId}`, toolCallListener);
      ipcRenderer.on(`stream-finish-${streamId}`, finishListener);
      ipcRenderer.on(`stream-error-${streamId}`, errorListener);

      // Send the streaming request
      try {
        const result = await ipcRenderer.invoke(
          'llm-sendMessageStreamWithTools',
          messages,
          provider,
          tools,
          streamId
        );
        if (!result.success) {
          cleanup();
          throw createIpcError(result.error);
        }
      } catch (error) {
        cleanup();
        throw error;
      }
    }
  },

  // Model Manager interface
  model: {
    ensureInitialized: async () => {
      const result = await ipcRenderer.invoke('model-ensureInitialized');
      if (!result.success) throw createIpcError(result.error);
    },

    isInitialized: async () => {
      const result = await ipcRenderer.invoke('model-isInitialized');
      if (!result.success) throw createIpcError(result.error);
      return result.data;
    },

    // Get all models
    getAllModels: async () => {
      const result = await ipcRenderer.invoke('model-getAllModels');
      if (!result.success) {
        throw createIpcError(result.error);
      }
      return result.data;
    },

    // Get all models
    getModels: async () => {
      console.warn('`getModels` is deprecated, please use `getAllModels`');
      const result = await ipcRenderer.invoke('model-getAllModels');
      if (!result.success) {
        throw createIpcError(result.error);
      }
      return result.data;
    },

    // Add a new model
    addModel: async (model) => {
      const result = await ipcRenderer.invoke('model-addModel', model);
      if (!result.success) {
        throw createIpcError(result.error);
      }
      return result.data;
    },

    // Update an existing model
    updateModel: async (id, updates) => {
      const result = await ipcRenderer.invoke('model-updateModel', id, updates);
      if (!result.success) {
        throw createIpcError(result.error);
      }
    },

    // Delete a model
    deleteModel: async (id) => {
      const result = await ipcRenderer.invoke('model-deleteModel', id);
      if (!result.success) {
        throw createIpcError(result.error);
      }
    },

    getEnabledModels: async () => {
      const result = await ipcRenderer.invoke('model-getEnabledModels');
      if (!result.success) {
        throw createIpcError(result.error);
      }
      return result.data;
    },

    // Export all model data
    exportData: async () => {
      const result = await ipcRenderer.invoke('model-exportData');
      if (!result.success) {
        throw createIpcError(result.error);
      }
      return result.data;
    },

    // Import model data
    importData: async (data) => {
      const result = await ipcRenderer.invoke('model-importData', data);
      if (!result.success) {
        throw createIpcError(result.error);
      }
    },

    // Get data type identifier
    getDataType: async () => {
      const result = await ipcRenderer.invoke('model-getDataType');
      if (!result.success) {
        throw createIpcError(result.error);
      }
      return result.data;
    },

    // Validate data format
    validateData: async (data) => {
      const result = await ipcRenderer.invoke('model-validateData', data);
      if (!result.success) {
        throw createIpcError(result.error);
      }
      return result.data;
    },
  },

  // Image Model Manager interface (Config-centric)
  imageModel: {
    ensureInitialized: async () => {
      const result = await ipcRenderer.invoke('image-model-ensureInitialized');
      if (!result.success) throw createIpcError(result.error);
    },
    isInitialized: async () => {
      const result = await ipcRenderer.invoke('image-model-isInitialized');
      if (!result.success) throw createIpcError(result.error);
      return result.data;
    },
    getAllConfigs: async () => {
      const result = await ipcRenderer.invoke('image-model-getAllConfigs');
      if (!result.success) throw createIpcError(result.error);
      return result.data;
    },
    getConfig: async (id) => {
      const result = await ipcRenderer.invoke('image-model-getConfig', id);
      if (!result.success) throw createIpcError(result.error);
      return result.data;
    },
    addConfig: async (config) => {
      const result = await ipcRenderer.invoke('image-model-addConfig', config);
      if (!result.success) throw createIpcError(result.error);
    },
    updateConfig: async (id, updates) => {
      const result = await ipcRenderer.invoke('image-model-updateConfig', id, updates);
      if (!result.success) throw createIpcError(result.error);
    },
    deleteConfig: async (id) => {
      const result = await ipcRenderer.invoke('image-model-deleteConfig', id);
      if (!result.success) throw createIpcError(result.error);
    },
    getEnabledConfigs: async () => {
      const result = await ipcRenderer.invoke('image-model-getEnabledConfigs');
      if (!result.success) throw createIpcError(result.error);
      return result.data;
    },
    exportData: async () => {
      const result = await ipcRenderer.invoke('image-model-exportData');
      if (!result.success) throw createIpcError(result.error);
      return result.data;
    },
    importData: async (data) => {
      const result = await ipcRenderer.invoke('image-model-importData', data);
      if (!result.success) throw createIpcError(result.error);
    },
    getDataType: async () => {
      const result = await ipcRenderer.invoke('image-model-getDataType');
      if (!result.success) throw createIpcError(result.error);
      return result.data;
    },
    validateData: async (data) => {
      const result = await ipcRenderer.invoke('image-model-validateData', data);
      if (!result.success) throw createIpcError(result.error);
      return result.data;
    },
  },

  // Image Service interface
  image: {
     generate: async (request) => {
       const result = await ipcRenderer.invoke('image-generate', request);
       if (!result.success) {
         throw createIpcError(result.error);
       }
       return result.data;
     },
 
     // 显式模式：避免根据 inputImage 是否存在隐式推断
     generateText2Image: async (request) => {
       const result = await ipcRenderer.invoke('image-generateText2Image', request);
       if (!result.success) {
         throw createIpcError(result.error);
       }
       return result.data;
     },
     generateImage2Image: async (request) => {
       const result = await ipcRenderer.invoke('image-generateImage2Image', request);
       if (!result.success) {
         throw createIpcError(result.error);
       }
       return result.data;
     },
 
     validateRequest: async (request) => {
       const result = await ipcRenderer.invoke('image-validateRequest', request);
       if (!result.success) {
         throw createIpcError(result.error);
       }
       return result.data;
     },
     validateText2ImageRequest: async (request) => {
       const result = await ipcRenderer.invoke('image-validateText2ImageRequest', request);
       if (!result.success) {
         throw createIpcError(result.error);
       }
       return result.data;
     },
     validateImage2ImageRequest: async (request) => {
       const result = await ipcRenderer.invoke('image-validateImage2ImageRequest', request);
       if (!result.success) {
         throw createIpcError(result.error);
       }
       return result.data;
     },
 
     // 新增：连接测试在主进程执行
     testConnection: async (config) => {
       const result = await ipcRenderer.invoke('image-testConnection', config);
       if (!result.success) {
         throw createIpcError(result.error);
       }
       return result.data;
     },
     // 新增：动态模型列表在主进程获取
     getDynamicModels: async (providerId, connectionConfig) => {
       const result = await ipcRenderer.invoke('image-getDynamicModels', providerId, connectionConfig);
       if (!result.success) {
         throw createIpcError(result.error);
       }
       return result.data;
     }
   },

  // Template Manager interface
  template: {
    // Get all templates
    getTemplates: async () => {
      const result = await ipcRenderer.invoke('template-getTemplates');
      if (!result.success) {
        throw createIpcError(result.error);
      }
      return result.data;
    },

    // Get a specific template
    getTemplate: async (id) => {
      const result = await ipcRenderer.invoke('template-getTemplate', id);
      if (!result.success) {
        throw createIpcError(result.error);
      }
      return result.data;
    },

    // Create a new template
    createTemplate: async (template) => {
      const result = await ipcRenderer.invoke('template-createTemplate', template);
      if (!result.success) {
        throw createIpcError(result.error);
      }
      return result.data;
    },

    // Update an existing template
    updateTemplate: async (id, updates) => {
      const result = await ipcRenderer.invoke('template-updateTemplate', id, updates);
      if (!result.success) {
        throw createIpcError(result.error);
      }
    },

    // Delete a template
    deleteTemplate: async (id) => {
      const result = await ipcRenderer.invoke('template-deleteTemplate', id);
      if (!result.success) {
        throw createIpcError(result.error);
      }
    },

    // Add listTemplatesByType
    listTemplatesByType: async (type) => {
      const result = await ipcRenderer.invoke('template-listTemplatesByType', type);
      if (!result.success) {
        throw createIpcError(result.error);
      }
      return result.data;
    },

  // Template Import/Export
    exportTemplate: async (id) => {
      const result = await ipcRenderer.invoke('template-exportTemplate', id);
      if (!result.success) throw createIpcError(result.error);
      return result.data;
    },
    importTemplate: async (jsonString) => {
      const result = await ipcRenderer.invoke('template-importTemplate', jsonString);
      if (!result.success) throw createIpcError(result.error);
    },

    // Export all user templates data
    exportData: async () => {
      const result = await ipcRenderer.invoke('template-exportData');
      if (!result.success) {
        throw createIpcError(result.error);
      }
      return result.data;
    },

    // Import user templates data
    importData: async (data) => {
      const result = await ipcRenderer.invoke('template-importData', data);
      if (!result.success) {
        throw createIpcError(result.error);
      }
    },

    // Get data type identifier
    getDataType: async () => {
      const result = await ipcRenderer.invoke('template-getDataType');
      if (!result.success) {
        throw createIpcError(result.error);
      }
      return result.data;
    },

    // Validate data format
    validateData: async (data) => {
      const result = await ipcRenderer.invoke('template-validateData', data);
      if (!result.success) {
        throw createIpcError(result.error);
      }
      return result.data;
    },

    // Template language methods
    changeBuiltinTemplateLanguage: async (language) => {
      const result = await ipcRenderer.invoke('template-changeBuiltinTemplateLanguage', language);
      if (!result.success) {
        throw createIpcError(result.error);
      }
    },

    getCurrentBuiltinTemplateLanguage: async () => {
      const result = await ipcRenderer.invoke('template-getCurrentBuiltinTemplateLanguage');
      if (!result.success) throw createIpcError(result.error);
      return result.data;
    },

    getSupportedBuiltinTemplateLanguages: async () => {
      const result = await ipcRenderer.invoke('template-getSupportedBuiltinTemplateLanguages');
      if (!result.success) throw createIpcError(result.error);
      return result.data;
    },

  },


  // History Manager interface
  history: {
    // Get all history records
    getHistory: async () => {
      const result = await ipcRenderer.invoke('history-getHistory');
      if (!result.success) {
        throw createIpcError(result.error);
      }
      return result.data;
    },

    // Add a new history record
    addRecord: async (record) => {
      const result = await ipcRenderer.invoke('history-addRecord', record);
      if (!result.success) {
        throw createIpcError(result.error);
      }
      return result.data;
    },

    // Delete a history record
    deleteRecord: async (id) => {
      const result = await ipcRenderer.invoke('history-deleteRecord', id);
      if (!result.success) {
        throw createIpcError(result.error);
      }
    },

    // Clear all history
    clearHistory: async () => {
      const result = await ipcRenderer.invoke('history-clearHistory');
      if (!result.success) {
        throw createIpcError(result.error);
      }
    },

    // 添加缺失的历史记录链功能
    getIterationChain: async (recordId) => {
      const result = await ipcRenderer.invoke('history-getIterationChain', recordId);
      if (!result.success) {
        throw createIpcError(result.error);
      }
      return result.data;
    },

    getAllChains: async () => {
      const result = await ipcRenderer.invoke('history-getAllChains');
      if (!result.success) {
        throw createIpcError(result.error);
      }
      return result.data;
    },

    getChain: async (chainId) => {
      const result = await ipcRenderer.invoke('history-getChain', chainId);
      if (!result.success) {
        throw createIpcError(result.error);
      }
      return result.data;
    },

    createNewChain: async (record) => {
      const result = await ipcRenderer.invoke('history-createNewChain', record);
      if (!result.success) {
        throw createIpcError(result.error);
      }
      return result.data;
    },

    addIteration: async (params) => {
      const result = await ipcRenderer.invoke('history-addIteration', params);
      if (!result.success) {
        throw createIpcError(result.error);
      }
      return result.data;
    },

    deleteChain: async (chainId) => {
      const result = await ipcRenderer.invoke('history-deleteChain', chainId);
      if (!result.success) {
        throw createIpcError(result.error);
      }
    },

    // Export all history data
    exportData: async () => {
      const result = await ipcRenderer.invoke('history-exportData');
      if (!result.success) {
        throw createIpcError(result.error);
      }
      return result.data;
    },

    // Import history data
    importData: async (data) => {
      const result = await ipcRenderer.invoke('history-importData', data);
      if (!result.success) {
        throw createIpcError(result.error);
      }
    },

    // Get data type identifier
    getDataType: async () => {
      const result = await ipcRenderer.invoke('history-getDataType');
      if (!result.success) {
        throw createIpcError(result.error);
      }
      return result.data;
    },

    // Validate data format
    validateData: async (data) => {
      const result = await ipcRenderer.invoke('history-validateData', data);
      if (!result.success) {
        throw createIpcError(result.error);
      }
      return result.data;
    }
  },

  // Favorite Manager interface
  favoriteManager: {
    addFavorite: async (favorite) => {
      return await invokeFavorite('favorite-addFavorite', favorite);
    },
    getFavorites: async (options) => {
      return await invokeFavorite('favorite-getFavorites', options);
    },
    getFavorite: async (id) => {
      return await invokeFavorite('favorite-getFavorite', id);
    },
    updateFavorite: async (id, updates) => {
      await invokeFavorite('favorite-updateFavorite', id, updates);
    },
    deleteFavorite: async (id) => {
      await invokeFavorite('favorite-deleteFavorite', id);
    },
    deleteFavorites: async (ids) => {
      await invokeFavorite('favorite-deleteFavorites', ids);
    },
    incrementUseCount: async (id) => {
      await invokeFavorite('favorite-incrementUseCount', id);
    },
    getCategories: async () => {
      return await invokeFavorite('favorite-getCategories');
    },
    addCategory: async (category) => {
      return await invokeFavorite('favorite-addCategory', category);
    },
    updateCategory: async (id, updates) => {
      await invokeFavorite('favorite-updateCategory', id, updates);
    },
    deleteCategory: async (id) => {
      return await invokeFavorite('favorite-deleteCategory', id);
    },
    getStats: async () => {
      return await invokeFavorite('favorite-getStats');
    },
    searchFavorites: async (keyword, options) => {
      return await invokeFavorite('favorite-searchFavorites', keyword, options);
    },
    exportFavorites: async (ids) => {
      return await invokeFavorite('favorite-exportFavorites', ids);
    },
    importFavorites: async (data, options) => {
      return await invokeFavorite('favorite-importFavorites', data, options);
    },
    getAllTags: async () => {
      return await invokeFavorite('favorite-getAllTags');
    },
    addTag: async (tag) => {
      await invokeFavorite('favorite-addTag', tag);
    },
    renameTag: async (oldTag, newTag) => {
      return await invokeFavorite('favorite-renameTag', oldTag, newTag);
    },
    mergeTags: async (sourceTags, targetTag) => {
      return await invokeFavorite('favorite-mergeTags', sourceTags, targetTag);
    },
    deleteTag: async (tag) => {
      return await invokeFavorite('favorite-deleteTag', tag);
    },
    reorderCategories: async (categoryIds) => {
      await invokeFavorite('favorite-reorderCategories', categoryIds);
    },
    getCategoryUsage: async (categoryId) => {
      return await invokeFavorite('favorite-getCategoryUsage', categoryId);
    },
    ensureDefaultCategories: async (defaultCategories) => {
      await invokeFavorite('favorite-ensureDefaultCategories', defaultCategories);
    }
  },

  // Prompt Service interface
  prompt: {
    optimizePrompt: async (request) => {
      const result = await ipcRenderer.invoke('prompt-optimizePrompt', request);
      if (!result.success) {
        throw createIpcError(result.error);
      }
      return result.data;
    },
    // 统一的流式封装（与 llm.sendMessageStream 同模式）
    optimizePromptStream: async (request, callbacks) => {
      const streamId = generateStreamId();

      const tokenListener = (event, token) => {
        if (callbacks?.onToken) callbacks.onToken(token);
      };
      const reasoningListener = (event, token) => {
        if (callbacks?.onReasoningToken) callbacks.onReasoningToken(token);
      };
      const finishListener = () => {
        cleanup();
        if (callbacks?.onComplete) callbacks.onComplete();
      };
      const errorListener = (event, error) => {
        cleanup();
        if (callbacks?.onError) callbacks.onError(new Error(error));
      };

      const cleanup = () => {
        ipcRenderer.removeListener(`stream-token-${streamId}`, tokenListener);
        ipcRenderer.removeListener(`stream-reasoning-token-${streamId}`, reasoningListener);
        ipcRenderer.removeListener(`stream-finish-${streamId}`, finishListener);
        ipcRenderer.removeListener(`stream-error-${streamId}`, errorListener);
      };

      ipcRenderer.on(`stream-token-${streamId}`, tokenListener);
      ipcRenderer.on(`stream-reasoning-token-${streamId}`, reasoningListener);
      ipcRenderer.on(`stream-finish-${streamId}`, finishListener);
      ipcRenderer.on(`stream-error-${streamId}`, errorListener);

      const result = await ipcRenderer.invoke('prompt-optimizePromptStream', request, streamId);
      if (!result.success) {
        cleanup();
        throw createIpcError(result.error);
      }
    },
    iteratePromptStream: async (originalPrompt, lastOptimizedPrompt, iterateInput, modelKey, templateId, callbacks, contextData) => {
      const streamId = generateStreamId();

      const tokenListener = (event, token) => {
        if (callbacks?.onToken) callbacks.onToken(token);
      };
      const reasoningListener = (event, token) => {
        if (callbacks?.onReasoningToken) callbacks.onReasoningToken(token);
      };
      const finishListener = () => {
        cleanup();
        if (callbacks?.onComplete) callbacks.onComplete();
      };
      const errorListener = (event, error) => {
        cleanup();
        if (callbacks?.onError) callbacks.onError(new Error(error));
      };

      const cleanup = () => {
        ipcRenderer.removeListener(`stream-token-${streamId}`, tokenListener);
        ipcRenderer.removeListener(`stream-reasoning-token-${streamId}`, reasoningListener);
        ipcRenderer.removeListener(`stream-finish-${streamId}`, finishListener);
        ipcRenderer.removeListener(`stream-error-${streamId}`, errorListener);
      };

      ipcRenderer.on(`stream-token-${streamId}`, tokenListener);
      ipcRenderer.on(`stream-reasoning-token-${streamId}`, reasoningListener);
      ipcRenderer.on(`stream-finish-${streamId}`, finishListener);
      ipcRenderer.on(`stream-error-${streamId}`, errorListener);

      const result = await ipcRenderer.invoke('prompt-iteratePromptStream', originalPrompt, lastOptimizedPrompt, iterateInput, modelKey, templateId, streamId, contextData);
      if (!result.success) {
        cleanup();
        throw createIpcError(result.error);
      }
    },
    testPromptStream: async (systemPrompt, userPrompt, modelKey, callbacks) => {
      const streamId = generateStreamId();

      const tokenListener = (event, token) => {
        if (callbacks?.onToken) callbacks.onToken(token);
      };
      const reasoningListener = (event, token) => {
        if (callbacks?.onReasoningToken) callbacks.onReasoningToken(token);
      };
      const finishListener = () => {
        cleanup();
        if (callbacks?.onComplete) callbacks.onComplete();
      };
      const errorListener = (event, error) => {
        cleanup();
        if (callbacks?.onError) callbacks.onError(new Error(error));
      };

      const cleanup = () => {
        ipcRenderer.removeListener(`stream-token-${streamId}`, tokenListener);
        ipcRenderer.removeListener(`stream-reasoning-token-${streamId}`, reasoningListener);
        ipcRenderer.removeListener(`stream-finish-${streamId}`, finishListener);
        ipcRenderer.removeListener(`stream-error-${streamId}`, errorListener);
      };

      ipcRenderer.on(`stream-token-${streamId}`, tokenListener);
      ipcRenderer.on(`stream-reasoning-token-${streamId}`, reasoningListener);
      ipcRenderer.on(`stream-finish-${streamId}`, finishListener);
      ipcRenderer.on(`stream-error-${streamId}`, errorListener);

      const result = await ipcRenderer.invoke('prompt-testPromptStream', systemPrompt, userPrompt, modelKey, streamId);
      if (!result.success) {
        cleanup();
        throw createIpcError(result.error);
      }
    },
    // 自定义会话测试（支持工具调用）
    testCustomConversationStream: async (request, callbacks) => {
      const streamId = generateStreamId();

      const tokenListener = (event, token) => {
        if (callbacks?.onToken) callbacks.onToken(token);
      };
      const reasoningListener = (event, token) => {
        if (callbacks?.onReasoningToken) callbacks.onReasoningToken(token);
      };
      const toolCallListener = (event, toolCall) => {
        if (callbacks?.onToolCall) callbacks.onToolCall(toolCall);
      };
      const finishListener = () => {
        cleanup();
        if (callbacks?.onComplete) callbacks.onComplete();
      };
      const errorListener = (event, error) => {
        cleanup();
        if (callbacks?.onError) callbacks.onError(new Error(error));
      };

      const cleanup = () => {
        ipcRenderer.removeListener(`stream-token-${streamId}`, tokenListener);
        ipcRenderer.removeListener(`stream-reasoning-token-${streamId}`, reasoningListener);
        ipcRenderer.removeListener(`stream-tool-call-${streamId}`, toolCallListener);
        ipcRenderer.removeListener(`stream-finish-${streamId}`, finishListener);
        ipcRenderer.removeListener(`stream-error-${streamId}`, errorListener);
      };

      ipcRenderer.on(`stream-token-${streamId}`, tokenListener);
      ipcRenderer.on(`stream-reasoning-token-${streamId}`, reasoningListener);
      ipcRenderer.on(`stream-tool-call-${streamId}`, toolCallListener);
      ipcRenderer.on(`stream-finish-${streamId}`, finishListener);
      ipcRenderer.on(`stream-error-${streamId}`, errorListener);

      const result = await ipcRenderer.invoke('prompt-testCustomConversationStream', request, streamId);
      if (!result.success) {
        cleanup();
        throw createIpcError(result.error);
      }
    },
    iteratePrompt: async (originalPrompt, lastOptimizedPrompt, iterateInput, modelKey, templateId) => {
      const result = await ipcRenderer.invoke('prompt-iteratePrompt', originalPrompt, lastOptimizedPrompt, iterateInput, modelKey, templateId);
      if (!result.success) {
        throw createIpcError(result.error);
      }
      return result.data;
    },
    testPrompt: async (systemPrompt, userPrompt, modelKey) => {
      const result = await ipcRenderer.invoke('prompt-testPrompt', systemPrompt, userPrompt, modelKey);
      if (!result.success) {
        throw createIpcError(result.error);
      }
      return result.data;
    },
    getHistory: async () => {
      const result = await ipcRenderer.invoke('prompt-getHistory');
      if (!result.success) {
        throw createIpcError(result.error);
      }
      return result.data;
    },
    getIterationChain: async (recordId) => {
      const result = await ipcRenderer.invoke('prompt-getIterationChain', recordId);
      if (!result.success) {
        throw createIpcError(result.error);
      }
      return result.data;
    },
  },

  // 配置同步接口 - 从主进程获取统一配置
  config: {
    // 获取环境变量（主进程作为唯一源）
    getEnvironmentVariables: async () => {
      const result = await ipcRenderer.invoke('config-getEnvironmentVariables');
      if (!result.success) {
        throw createIpcError(result.error);
      }
      return result.data;
    }
  },


  
  // Data Manager interface
  data: {
    // Export all data
    exportAllData: async () => {
      const result = await ipcRenderer.invoke('data-exportAllData');
      if (!result.success) {
        throw createIpcError(result.error);
      }
      return result.data;
    },

    // Import all data
    importAllData: async (dataString) => {
      const result = await ipcRenderer.invoke('data-importAllData', dataString);
      if (!result.success) {
        throw createIpcError(result.error);
      }
    },

    // Get local storage info (desktop only)
    getStorageInfo: async () => {
      const result = await ipcRenderer.invoke('data-getStorageInfo');
      if (!result.success) {
        throw createIpcError(result.error);
      }
      return result.data;
    },

    // Open the userData directory (desktop only)
    openStorageDirectory: async () => {
      const result = await ipcRenderer.invoke('data-openStorageDirectory');
      if (!result.success) {
        throw createIpcError(result.error);
      }
      return result.data;
    }
  },

  // Context Repository interface
  context: {
    list: async () => {
      const result = await ipcRenderer.invoke('context-list');
      if (!result.success) {
        throw createIpcError(result.error);
      }
      return result.data;
    },

    getCurrentId: async () => {
      const result = await ipcRenderer.invoke('context-getCurrentId');
      if (!result.success) {
        throw createIpcError(result.error);
      }
      return result.data;
    },

    setCurrentId: async (id) => {
      const result = await ipcRenderer.invoke('context-setCurrentId', id);
      if (!result.success) {
        throw createIpcError(result.error);
      }
    },

    get: async (id) => {
      const result = await ipcRenderer.invoke('context-get', id);
      if (!result.success) {
        throw createIpcError(result.error);
      }
      return result.data;
    },

    create: async (meta) => {
      const result = await ipcRenderer.invoke('context-create', meta);
      if (!result.success) {
        throw createIpcError(result.error);
      }
      return result.data;
    },

    duplicate: async (id, options) => {
      const result = await ipcRenderer.invoke('context-duplicate', id, options);
      if (!result.success) {
        throw createIpcError(result.error);
      }
      return result.data;
    },

    rename: async (id, title) => {
      const result = await ipcRenderer.invoke('context-rename', id, title);
      if (!result.success) {
        throw createIpcError(result.error);
      }
    },

    save: async (ctx) => {
      const result = await ipcRenderer.invoke('context-save', ctx);
      if (!result.success) {
        throw createIpcError(result.error);
      }
    },

    update: async (id, patch) => {
      const result = await ipcRenderer.invoke('context-update', id, patch);
      if (!result.success) {
        throw createIpcError(result.error);
      }
    },

    remove: async (id) => {
      const result = await ipcRenderer.invoke('context-remove', id);
      if (!result.success) {
        throw createIpcError(result.error);
      }
    },

    exportAll: async () => {
      const result = await ipcRenderer.invoke('context-exportAll');
      if (!result.success) {
        throw createIpcError(result.error);
      }
      return result.data;
    },

    importAll: async (bundle, mode) => {
      const result = await ipcRenderer.invoke('context-importAll', bundle, mode);
      if (!result.success) {
        throw createIpcError(result.error);
      }
      return result.data;
    },

    exportData: async () => {
      const result = await ipcRenderer.invoke('context-exportData');
      if (!result.success) {
        throw createIpcError(result.error);
      }
      return result.data;
    },

    importData: async (data) => {
      const result = await ipcRenderer.invoke('context-importData', data);
      if (!result.success) {
        throw createIpcError(result.error);
      }
    },

    getDataType: async () => {
      const result = await ipcRenderer.invoke('context-getDataType');
      if (!result.success) {
        throw createIpcError(result.error);
      }
      return result.data;
    },

    validateData: async (data) => {
      const result = await ipcRenderer.invoke('context-validateData', data);
      if (!result.success) {
        throw createIpcError(result.error);
      }
      return result.data;
    }
  },

  // Add an identifier so the frontend knows it's running in Electron
  isElectron: true,

  // Preference Service interface
  preference: {
    get: async (key, defaultValue) => {
      const result = await ipcRenderer.invoke('preference-get', key, defaultValue);
      if (!result.success) {
        throw createIpcError(result.error);
      }
      return result.data;
    },
    set: async (key, value) => {
      const result = await ipcRenderer.invoke('preference-set', key, value);
      if (!result.success) {
        throw createIpcError(result.error);
      }
    },
    delete: async (key) => {
      const result = await ipcRenderer.invoke('preference-delete', key);
      if (!result.success) {
        throw createIpcError(result.error);
      }
    },
    keys: async () => {
      const result = await ipcRenderer.invoke('preference-keys');
      if (!result.success) {
        throw createIpcError(result.error);
      }
      return result.data;
    },
    clear: async () => {
      const result = await ipcRenderer.invoke('preference-clear');
      if (!result.success) {
        throw createIpcError(result.error);
      }
    },

    getAll: async () => {
      const result = await ipcRenderer.invoke('preference-getAll');
      if (!result.success) {
        throw createIpcError(result.error);
      }
      return result.data;
    },

    // Export all preference data
    exportData: async () => {
      const result = await ipcRenderer.invoke('preference-exportData');
      if (!result.success) {
        throw createIpcError(result.error);
      }
      return result.data;
    },

    // Import preference data
    importData: async (data) => {
      const result = await ipcRenderer.invoke('preference-importData', data);
      if (!result.success) {
        throw createIpcError(result.error);
      }
    },

    // Get data type identifier
    getDataType: async () => {
      const result = await ipcRenderer.invoke('preference-getDataType');
      if (!result.success) {
        throw createIpcError(result.error);
      }
      return result.data;
    },

    // Validate data format
    validateData: async (data) => {
      const result = await ipcRenderer.invoke('preference-validateData', data);
      if (!result.success) {
        throw createIpcError(result.error);
      }
      return result.data;
    },
  },

  // Shell operations
  shell: {
    openExternal: async (url) => {
      const result = await ipcRenderer.invoke('shell-openExternal', url);
      if (!result.success) {
        throw createIpcError(result.error);
      }
      return result.data;
    },
  },

  // App information
  app: {
    getVersion: async () => {
      const result = await withTimeout(
        ipcRenderer.invoke('app-get-version'),
        5000 // 5秒超时，获取版本应该很快
      );
      if (!result.success) {
        throw createIpcError(result.error);
      }
      return result.data;
    },
  },

  // Auto-updater interface with timeout protection
  updater: {
    checkUpdate: async () => {
      const result = await withTimeout(
        ipcRenderer.invoke(IPC_EVENTS.UPDATE_CHECK),
        30000 // 30秒超时，检查更新可能需要网络请求
      );
      if (!result.success) {
        console.error('[DEBUG] Preload received error result:', result);
        // 保留完整的错误信息，不要创建新的 Error 对象
        const error = new Error(result.error);
        error.originalError = result.error;
        error.detailedMessage = result.error;
        console.error('[DEBUG] Preload throwing enhanced error:', error);
        throw error;
      }
      return result.data;
    },
    
    checkAllVersions: async () => {
      const result = await withTimeout(
        ipcRenderer.invoke(IPC_EVENTS.UPDATE_CHECK_ALL_VERSIONS),
        60000 // 60秒超时，需要检查两个版本
      );
      if (!result.success) {
        throw createIpcError(result.error);
      }
      return result.data;
    },
    
    startDownload: async () => {
      const result = await withTimeout(
        ipcRenderer.invoke(IPC_EVENTS.UPDATE_START_DOWNLOAD),
        10000 // 10秒超时，启动下载应该很快
      );
      if (!result.success) {
        // 保留完整的错误信息
        const error = new Error(result.error);
        error.originalError = result.error;
        error.detailedMessage = result.error;
        throw error;
      }
      return result.data;
    },
    installUpdate: async () => {
      const result = await withTimeout(
        ipcRenderer.invoke(IPC_EVENTS.UPDATE_INSTALL),
        10000 // 10秒超时，安装启动应该很快
      );
      if (!result.success) {
        // 保留完整的错误信息
        const error = new Error(result.error);
        error.originalError = result.error;
        error.detailedMessage = result.error;
        throw error;
      }
      return result.data;
    },
    ignoreVersion: async (version, versionType) => {
      const result = await withTimeout(
        ipcRenderer.invoke(IPC_EVENTS.UPDATE_IGNORE_VERSION, version, versionType),
        5000 // 5秒超时，设置偏好应该很快
      );
      if (!result.success) {
        // 保留完整的错误信息
        const error = new Error(result.error);
        error.originalError = result.error;
        error.detailedMessage = result.error;
        throw error;
      }
      return result.data;
    },

    getIgnoredVersions: async () => {
      const result = await withTimeout(
        ipcRenderer.invoke(IPC_EVENTS.UPDATE_GET_IGNORED_VERSIONS),
        5000 // 5秒超时，读取偏好应该很快
      );
      if (!result.success) {
        const error = new Error(result.error);
        error.originalError = result.error;
        error.detailedMessage = result.error;
        throw error;
      }
      return result.data;
    },

    unignoreVersion: async (versionType) => {
      const result = await withTimeout(
        ipcRenderer.invoke(IPC_EVENTS.UPDATE_UNIGNORE_VERSION, versionType),
        5000 // 5秒超时，设置偏好应该很快
      );
      if (!result.success) {
        const error = new Error(result.error);
        error.originalError = result.error;
        error.detailedMessage = result.error;
        throw error;
      }
      return result.data;
    },

    downloadSpecificVersion: async (versionType) => {
      const result = await withTimeout(
        ipcRenderer.invoke(IPC_EVENTS.UPDATE_DOWNLOAD_SPECIFIC_VERSION, versionType),
        30000 // 30秒超时，现在只等待下载启动，不等待完成，所以30秒足够
      );
      if (!result.success) {
        const error = new Error(result.error || 'Failed to download specific version');
        error.originalError = result.error;
        error.detailedMessage = result.error;
        throw error;
      }
      return result.data;
    },
  },
});
