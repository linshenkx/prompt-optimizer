/**
 * 注册文本模型管理相关的 Desktop IPC interface。
 * 保持现有 channel、位置参数和响应信封不变，仅从 main.js 拆出领域实现。
 *
 * @param {object} dependencies 模型领域注册依赖。
 * @param {Electron.IpcMain} dependencies.ipcMain Electron IPC 主进程对象。
 * @param {object} dependencies.modelManager Core 文本模型管理器。
 * @param {Function} dependencies.safeSerialize 清理 Vue 响应式对象，避免 IPC 序列化失败。
 * @param {Function} dependencies.createSuccessResponse 统一成功响应信封。
 * @param {Function} dependencies.createErrorResponse 统一失败响应信封。
 */
function registerModelIpcHandlers({
  ipcMain,
  modelManager,
  safeSerialize,
  createSuccessResponse,
  createErrorResponse,
}) {
  ipcMain.handle('model-getModels', async () => {
    try {
      const result = await modelManager.getAllModels();
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('model-addModel', async (_event, model) => {
    try {
      // 清理Vue响应式对象，防止IPC序列化错误
      const safeModel = safeSerialize(model);
      // model应该包含key和config，需要分离
      const { key, ...config } = safeModel;
      await modelManager.addModel(key, config);
      return createSuccessResponse(null);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('model-updateModel', async (_event, id, updates) => {
    try {
      // 清理Vue响应式对象，防止IPC序列化错误
      const safeUpdates = safeSerialize(updates);
      await modelManager.updateModel(id, safeUpdates);
      return createSuccessResponse(null);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('model-deleteModel', async (_event, id) => {
    try {
      await modelManager.deleteModel(id);
      return createSuccessResponse(null);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('model-ensureInitialized', async () => {
    try {
      await modelManager.ensureInitialized();
      return createSuccessResponse(null);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('model-isInitialized', async () => {
    try {
      const result = await modelManager.isInitialized();
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('model-getAllModels', async () => {
    try {
      const result = await modelManager.getAllModels();
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('model-getEnabledModels', async () => {
    try {
      const result = await modelManager.getEnabledModels();
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  // Model Import/Export Data handlers (for bulk operations)
  ipcMain.handle('model-exportData', async () => {
    try {
      const result = await modelManager.exportData();
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('model-importData', async (_event, data) => {
    try {
      // 清理Vue响应式对象，防止IPC序列化错误
      const safeData = safeSerialize(data);
      await modelManager.importData(safeData);
      return createSuccessResponse(null);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('model-getDataType', async () => {
    try {
      const result = modelManager.getDataType();
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('model-validateData', async (_event, data) => {
    try {
      // 清理Vue响应式对象，防止IPC序列化错误
      const safeData = safeSerialize(data);
      const result = await modelManager.validateData(safeData);
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });
}

module.exports = {
  registerModelIpcHandlers,
};
