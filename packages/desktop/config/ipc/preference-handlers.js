/**
 * 注册偏好设置相关的 Desktop IPC interface。
 * 保持现有 channel、位置参数和响应信封不变。
 *
 * @param {object} dependencies 偏好设置注册依赖。
 */
function registerPreferenceIpcHandlers({
  ipcMain,
  preferenceService,
  safeSerialize,
  createSuccessResponse,
  createErrorResponse,
}) {
  ipcMain.handle('preference-get', async (_event, key, defaultValue) => {
    try {
      const value = await preferenceService.get(key, defaultValue);
      return createSuccessResponse(value);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('preference-set', async (_event, key, value) => {
    try {
      await preferenceService.set(key, value);
      return createSuccessResponse(null);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('preference-delete', async (_event, key) => {
    try {
      await preferenceService.delete(key);
      return createSuccessResponse(null);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('preference-keys', async () => {
    try {
      const result = await preferenceService.keys();
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('preference-clear', async () => {
    try {
      await preferenceService.clear();
      return createSuccessResponse(null);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('preference-getAll', async () => {
    try {
      const result = await preferenceService.getAll();
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  // Preference Import/Export Data handlers (for bulk operations)
  ipcMain.handle('preference-exportData', async () => {
    try {
      const result = await preferenceService.exportData();
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('preference-importData', async (_event, data) => {
    try {
      // 清理Vue响应式对象，防止IPC序列化错误
      const safeData = safeSerialize(data);
      await preferenceService.importData(safeData);
      return createSuccessResponse(null);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('preference-getDataType', async () => {
    try {
      const result = preferenceService.getDataType();
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('preference-validateData', async (_event, data) => {
    try {
      // 清理Vue响应式对象，防止IPC序列化错误
      const safeData = safeSerialize(data);
      const result = await preferenceService.validateData(safeData);
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });
}

module.exports = {
  registerPreferenceIpcHandlers,
};
