const { assertValidStreamId } = require('../ipc-security');

const PROMPT_STREAM_CHANNELS = Object.freeze({
  token: 'stream-token',
  reasoning: 'stream-reasoning-token',
  toolCall: 'stream-tool-call',
  finish: 'stream-finish',
  error: 'stream-error',
});

/**
 * 为位置参数式 IPC interface 创建 streamId 校验函数，避免注册处重复索引逻辑。
 */
function createStreamIdValidator(index) {
  /** 校验指定参数位置上的流标识。 */
  return function validateStreamId(args) {
    assertValidStreamId(args[index]);
  };
}

/**
 * 注册 Prompt 领域的流式后端 IPC interface，所有事件只回传给发起请求的 renderer。
 *
 * @param {object} dependencies Prompt 流式注册依赖。
 * @param {Function} dependencies.registerSensitiveIpc 统一执行 sender 校验和错误封装的注册函数。
 * @param {object} dependencies.promptService Core Prompt 领域服务。
 * @param {Function} dependencies.runOwnedStream 执行 sender 绑定流任务的函数。
 */
function registerPromptStreamIpcHandlers({
  registerSensitiveIpc,
  promptService,
  runOwnedStream,
}) {
  /** 执行 Prompt 流任务，并将服务异常同步为 stream error 事件。 */
  function runPromptStream(event, streamId, operation) {
    return runOwnedStream(event, streamId, PROMPT_STREAM_CHANNELS, operation, true);
  }

  registerSensitiveIpc('prompt-optimizePromptStream', async (event, request, streamId) => {
    return runPromptStream(event, streamId, (streamHandlers, signal) => (
      promptService.optimizePromptStream(request, streamHandlers, { signal })
    ));
  }, createStreamIdValidator(1));

  registerSensitiveIpc('prompt-optimizeMessageStream', async (event, request, streamId) => {
    return runPromptStream(event, streamId, (streamHandlers, signal) => (
      promptService.optimizeMessageStream(request, streamHandlers, { signal })
    ));
  }, createStreamIdValidator(1));

  registerSensitiveIpc('prompt-iteratePromptStream', async (
    event,
    originalPrompt,
    lastOptimizedPrompt,
    iterateInput,
    modelKey,
    templateId,
    streamId,
    contextData,
  ) => {
    return runPromptStream(event, streamId, (streamHandlers, signal) => (
      promptService.iteratePromptStream(
        originalPrompt,
        lastOptimizedPrompt,
        iterateInput,
        modelKey,
        streamHandlers,
        templateId,
        contextData,
        { signal },
      )
    ));
  }, createStreamIdValidator(5));

  // IPC order: system, user, model, streamId, inputImages (preserves #196 contract)
  registerSensitiveIpc('prompt-testPromptStream', async (
    event,
    systemPrompt,
    userPrompt,
    modelKey,
    streamId,
    inputImages,
  ) => {
    return runPromptStream(event, streamId, (streamHandlers, signal) => (
      promptService.testPromptStream(
        systemPrompt,
        userPrompt,
        modelKey,
        streamHandlers,
        inputImages,
        { signal },
      )
    ));
  }, createStreamIdValidator(3));

  registerSensitiveIpc('prompt-testCustomConversationStream', async (event, request, streamId) => {
    return runPromptStream(event, streamId, (streamHandlers, signal) => (
      promptService.testCustomConversationStream(request, streamHandlers, { signal })
    ));
  }, createStreamIdValidator(1));
}

module.exports = {
  registerPromptStreamIpcHandlers,
};
