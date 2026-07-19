/**
 * 注册会话上下文相关的 Desktop IPC interface。
 * 保持现有 channel、位置参数和响应信封不变。
 *
 * @param {object} dependencies 上下文领域注册依赖。
 */
function registerContextIpcHandlers({
  ipcMain,
  contextRepo,
  safeSerialize,
  createSuccessResponse,
  createErrorResponse,
}) {
  ipcMain.handle('context-list', async () => {
    try {
      const result = await contextRepo.list();
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('context-getCurrentId', async () => {
    try {
      const result = await contextRepo.getCurrentId();
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('context-setCurrentId', async (_event, id) => {
    try {
      await contextRepo.setCurrentId(id);
      return createSuccessResponse(null);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('context-get', async (_event, id) => {
    try {
      const result = await contextRepo.get(id);
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('context-create', async (_event, meta) => {
    try {
      const safeMeta = meta ? safeSerialize(meta) : undefined;
      const result = await contextRepo.create(safeMeta);
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('context-duplicate', async (_event, id, options) => {
    try {
      const safeOptions = options ? safeSerialize(options) : undefined;
      const result = await contextRepo.duplicate(id, safeOptions);
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('context-rename', async (_event, id, title) => {
    try {
      await contextRepo.rename(id, title);
      return createSuccessResponse(null);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('context-save', async (_event, ctx) => {
    try {
      const safeCtx = safeSerialize(ctx);
      await contextRepo.save(safeCtx);
      return createSuccessResponse(null);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('context-update', async (_event, id, patch) => {
    try {
      const safePatch = safeSerialize(patch);
      await contextRepo.update(id, safePatch);
      return createSuccessResponse(null);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('context-remove', async (_event, id) => {
    try {
      await contextRepo.remove(id);
      return createSuccessResponse(null);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('context-exportAll', async () => {
    try {
      const result = await contextRepo.exportAll();
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('context-importAll', async (_event, bundle, mode) => {
    try {
      const safeBundle = safeSerialize(bundle);
      const result = await contextRepo.importAll(safeBundle, mode);
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('context-exportData', async () => {
    try {
      const result = await contextRepo.exportData();
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('context-importData', async (_event, data) => {
    try {
      const safeData = safeSerialize(data);
      await contextRepo.importData(safeData);
      return createSuccessResponse(null);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('context-getDataType', async () => {
    try {
      const result = contextRepo.getDataType();
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('context-validateData', async (_event, data) => {
    try {
      const safeData = safeSerialize(data);
      const result = await contextRepo.validateData(safeData);
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });
}

module.exports = {
  registerContextIpcHandlers,
};
