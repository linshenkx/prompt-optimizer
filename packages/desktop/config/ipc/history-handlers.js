/**
 * 注册历史记录相关的 Desktop IPC interface。
 * 保持现有 channel、位置参数和响应信封不变，仅从 main.js 拆出领域实现。
 *
 * @param {object} dependencies 历史领域注册依赖。
 * @param {Electron.IpcMain} dependencies.ipcMain Electron IPC 主进程对象。
 * @param {object} dependencies.historyManager Core 历史记录管理器。
 * @param {Function} dependencies.safeSerialize 清理 Vue 响应式对象，避免 IPC 序列化失败。
 * @param {Function} dependencies.createSuccessResponse 统一成功响应信封。
 * @param {Function} dependencies.createErrorResponse 统一失败响应信封。
 */
function registerHistoryIpcHandlers({
  ipcMain,
  historyManager,
  safeSerialize,
  createSuccessResponse,
  createErrorResponse,
}) {
  ipcMain.handle('history-getHistory', async () => {
    try {
      const result = await historyManager.getRecords();
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('history-addRecord', async (_event, record) => {
    try {
      // 清理Vue响应式对象，防止IPC序列化错误
      const safeRecord = safeSerialize(record);
      const result = await historyManager.addRecord(safeRecord);
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('history-deleteRecord', async (_event, id) => {
    try {
      await historyManager.deleteRecord(id);
      return createSuccessResponse(null);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('history-clearHistory', async () => {
    try {
      await historyManager.clearHistory();
      return createSuccessResponse(null);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  // 历史记录链相关接口
  ipcMain.handle('history-getIterationChain', async (_event, recordId) => {
    try {
      const result = await historyManager.getIterationChain(recordId);
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('history-getAllChains', async () => {
    try {
      const result = await historyManager.getAllChains();
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('history-getChain', async (_event, chainId) => {
    try {
      const result = await historyManager.getChain(chainId);
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('history-createNewChain', async (_event, record) => {
    try {
      // 清理Vue响应式对象，防止IPC序列化错误
      const safeRecord = safeSerialize(record);
      const result = await historyManager.createNewChain(safeRecord);
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('history-addIteration', async (_event, params) => {
    try {
      // 清理Vue响应式对象，防止IPC序列化错误
      const safeParams = safeSerialize(params);
      const result = await historyManager.addIteration(safeParams);
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('history-deleteChain', async (_event, chainId) => {
    try {
      await historyManager.deleteChain(chainId);
      return createSuccessResponse(null);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  // History Import/Export Data handlers (for bulk operations)
  ipcMain.handle('history-exportData', async () => {
    try {
      const result = await historyManager.exportData();
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('history-importData', async (_event, data) => {
    try {
      // 清理Vue响应式对象，防止IPC序列化错误
      const safeData = safeSerialize(data);
      await historyManager.importData(safeData);
      return createSuccessResponse(null);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('history-getDataType', async () => {
    try {
      const result = historyManager.getDataType();
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('history-validateData', async (_event, data) => {
    try {
      // 清理Vue响应式对象，防止IPC序列化错误
      const safeData = safeSerialize(data);
      const result = await historyManager.validateData(safeData);
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });
}

module.exports = {
  registerHistoryIpcHandlers,
};
