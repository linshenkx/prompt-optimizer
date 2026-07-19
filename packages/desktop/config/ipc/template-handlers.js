/**
 * 注册模板管理相关的 Desktop IPC interface。
 * 保持现有 channel、位置参数和响应信封不变，仅从 main.js 拆出领域实现。
 *
 * @param {object} dependencies 模板领域注册依赖。
 * @param {Electron.IpcMain} dependencies.ipcMain Electron IPC 主进程对象。
 * @param {object} dependencies.templateManager Core 模板管理器。
 * @param {Function} dependencies.safeSerialize 清理 Vue 响应式对象，避免 IPC 序列化失败。
 * @param {Function} dependencies.createSuccessResponse 统一成功响应信封。
 * @param {Function} dependencies.createErrorResponse 统一失败响应信封。
 */
function registerTemplateIpcHandlers({
  ipcMain,
  templateManager,
  safeSerialize,
  createSuccessResponse,
  createErrorResponse,
}) {
  ipcMain.handle('template-getTemplates', async () => {
    try {
      const result = await templateManager.listTemplates();
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('template-getTemplate', async (_event, id) => {
    try {
      const result = await templateManager.getTemplate(id);
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('template-createTemplate', async (_event, template) => {
    try {
      // 清理Vue响应式对象，防止IPC序列化错误
      const safeTemplate = safeSerialize(template);
      await templateManager.saveTemplate(safeTemplate);
      return createSuccessResponse(null);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('template-updateTemplate', async (_event, id, updates) => {
    try {
      // Get existing template and merge with updates
      const existingTemplate = await templateManager.getTemplate(id);
      // 清理Vue响应式对象，防止IPC序列化错误
      const safeUpdates = safeSerialize(updates);
      const updatedTemplate = { ...existingTemplate, ...safeUpdates, id };
      await templateManager.saveTemplate(updatedTemplate);
      return createSuccessResponse(null);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('template-deleteTemplate', async (_event, id) => {
    try {
      await templateManager.deleteTemplate(id);
      return createSuccessResponse(null);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('template-listTemplatesByType', async (_event, type) => {
    try {
      const result = await templateManager.listTemplatesByType(type);
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  // Template Import/Export handlers
  ipcMain.handle('template-exportTemplate', async (_event, id) => {
    try {
      const result = await templateManager.exportTemplate(id);
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('template-importTemplate', async (_event, jsonString) => {
    try {
      await templateManager.importTemplate(jsonString);
      return createSuccessResponse(null);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  // Template Import/Export Data handlers (for bulk operations)
  ipcMain.handle('template-exportData', async () => {
    try {
      const result = await templateManager.exportData();
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('template-importData', async (_event, data) => {
    try {
      // 清理Vue响应式对象，防止IPC序列化错误
      const safeData = safeSerialize(data);
      await templateManager.importData(safeData);
      return createSuccessResponse(null);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('template-getDataType', async () => {
    try {
      const result = templateManager.getDataType();
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('template-validateData', async (_event, data) => {
    try {
      // 清理Vue响应式对象，防止IPC序列化错误
      const safeData = safeSerialize(data);
      const result = templateManager.validateData(safeData);
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  // Template language handlers
  ipcMain.handle('template-changeBuiltinTemplateLanguage', async (_event, language) => {
    try {
      await templateManager.changeBuiltinTemplateLanguage(language);
      return createSuccessResponse(null);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('template-getCurrentBuiltinTemplateLanguage', async () => {
    try {
      const result = await templateManager.getCurrentBuiltinTemplateLanguage();
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('template-getSupportedBuiltinTemplateLanguages', async () => {
    try {
      const result = await templateManager.getSupportedBuiltinTemplateLanguages();
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('template-getSupportedLanguages', async (_event, template) => {
    try {
      const result = templateManager.getSupportedLanguages(template);
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });
}

module.exports = {
  registerTemplateIpcHandlers,
};
