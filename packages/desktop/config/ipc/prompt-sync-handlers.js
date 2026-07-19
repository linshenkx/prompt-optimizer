/**
 * 注册 Prompt 同步（非流式）IPC interface。
 * 流式 Prompt 通道仍由 prompt-stream-handlers 负责；本模块只覆盖位置参数同步调用。
 *
 * @param {object} dependencies Prompt 同步注册依赖。
 */
function registerPromptSyncIpcHandlers({
  ipcMain,
  promptService,
  historyManager,
  createSuccessResponse,
  createErrorResponse,
}) {
  ipcMain.handle('prompt-optimizePrompt', async (_event, request) => {
    try {
      const result = await promptService.optimizePrompt(request);
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('prompt-optimizeMessage', async (_event, request) => {
    try {
      const result = await promptService.optimizeMessage(request);
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('prompt-iteratePrompt', async (
    _event,
    originalPrompt,
    lastOptimizedPrompt,
    iterateInput,
    modelKey,
    templateId,
    contextData,
  ) => {
    try {
      const result = await promptService.iteratePrompt(
        originalPrompt,
        lastOptimizedPrompt,
        iterateInput,
        modelKey,
        templateId,
        contextData,
      );
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('prompt-testPrompt', async (_event, systemPrompt, userPrompt, modelKey, inputImages) => {
    try {
      const result = await promptService.testPrompt(systemPrompt, userPrompt, modelKey, inputImages);
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  // 历史兼容：部分 renderer 仍通过 prompt 前缀读取历史数据。
  ipcMain.handle('prompt-getHistory', async () => {
    try {
      const result = await historyManager.getHistory();
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('prompt-getIterationChain', async (_event, recordId) => {
    try {
      const result = await historyManager.getIterationChain(recordId);
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });
}

module.exports = {
  registerPromptSyncIpcHandlers,
};
