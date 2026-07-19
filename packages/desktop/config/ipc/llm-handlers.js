const {
  assertValidStreamId,
  createIpcError,
} = require('../ipc-security');

const LLM_STREAM_CHANNELS = Object.freeze({
  token: 'stream-content',
  reasoning: 'stream-thinking',
  finish: 'stream-finish',
  error: 'stream-error',
});

const LLM_TOOL_STREAM_CHANNELS = Object.freeze({
  ...LLM_STREAM_CHANNELS,
  toolCall: 'stream-tool-call',
});

/** 校验模型配置标识，阻止空值或异常超长字符串进入 Core。 */
function assertProvider(provider) {
  if (typeof provider !== 'string' || provider.trim().length === 0 || provider.length > 256) {
    throw createIpcError('IPC_INVALID_ARGUMENT', 'Invalid IPC request arguments');
  }
}

/** 校验消息集合的最小 IPC 结构，详细领域校验继续由 Core 负责。 */
function assertMessages(messages) {
  if (!Array.isArray(messages)) {
    throw createIpcError('IPC_INVALID_ARGUMENT', 'Invalid IPC request arguments');
  }
}

/** 校验工具定义集合的最小 IPC 结构。 */
function assertTools(tools) {
  if (!Array.isArray(tools)) {
    throw createIpcError('IPC_INVALID_ARGUMENT', 'Invalid IPC request arguments');
  }
}

/**
 * 注册 Desktop 后端的 LLM IPC interface，保持现有 channel 与响应语义不变。
 *
 * @param {object} dependencies LLM 后端注册依赖。
 * @param {Function} dependencies.registerSensitiveIpc 统一执行 sender 校验和错误封装的注册函数。
 * @param {object} dependencies.llmService Core LLM 领域服务。
 * @param {object} dependencies.streamRegistry 管理流所有权和取消状态的注册表。
 * @param {Function} dependencies.runOwnedStream 执行 sender 绑定流任务的函数。
 */
function registerLlmIpcHandlers({
  registerSensitiveIpc,
  llmService,
  streamRegistry,
  runOwnedStream,
}) {
  registerSensitiveIpc('llm-testConnection', async (_event, provider) => {
    await llmService.testConnection(provider);
    return null;
  }, ([provider]) => assertProvider(provider));

  registerSensitiveIpc('llm-sendMessage', async (_event, messages, provider) => {
    return llmService.sendMessage(messages, provider);
  }, ([messages, provider]) => {
    assertMessages(messages);
    assertProvider(provider);
  });

  registerSensitiveIpc('llm-sendMessageStructured', async (_event, messages, provider) => {
    return llmService.sendMessageStructured(messages, provider);
  }, ([messages, provider]) => {
    assertMessages(messages);
    assertProvider(provider);
  });

  registerSensitiveIpc('llm-fetchModelList', async (_event, provider, customConfig) => {
    return llmService.fetchModelList(provider, customConfig);
  }, ([provider]) => assertProvider(provider));

  registerSensitiveIpc('llm-sendMessageStream', async (event, messages, provider, streamId) => {
    return runOwnedStream(
      event,
      streamId,
      LLM_STREAM_CHANNELS,
      (callbacks, signal) => llmService.sendMessageStream(
        messages,
        provider,
        callbacks,
        { signal },
      ),
    );
  }, ([messages, provider, streamId]) => {
    assertMessages(messages);
    assertProvider(provider);
    assertValidStreamId(streamId);
  });

  registerSensitiveIpc('llm-sendMessageStreamWithTools', async (event, messages, provider, tools, streamId) => {
    return runOwnedStream(
      event,
      streamId,
      LLM_TOOL_STREAM_CHANNELS,
      (callbacks, signal) => llmService.sendMessageStreamWithTools(
        messages,
        provider,
        tools,
        callbacks,
        { signal },
      ),
    );
  }, ([messages, provider, tools, streamId]) => {
    assertMessages(messages);
    assertProvider(provider);
    assertTools(tools);
    assertValidStreamId(streamId);
  });

  registerSensitiveIpc('stream-cancel', async (event, streamId) => ({
    cancelled: streamRegistry.cancel(event.sender, streamId),
  }), ([streamId]) => assertValidStreamId(streamId));
}

module.exports = {
  registerLlmIpcHandlers,
};
