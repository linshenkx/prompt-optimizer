/**
 * 注册图像模型配置与图像生成相关的 Desktop IPC interface。
 * 保持现有 channel、位置参数和响应信封不变，仅从 main.js 拆出领域实现。
 *
 * @param {object} dependencies 图像领域注册依赖。
 * @param {Electron.IpcMain} dependencies.ipcMain Electron IPC 主进程对象。
 * @param {object} dependencies.imageModelManager 图像模型配置管理器。
 * @param {object} dependencies.imageService 图像生成领域服务。
 * @param {object} dependencies.imageAdapterRegistry 图像 provider 动态模型注册表。
 * @param {Function} dependencies.safeSerialize 清理 Vue 响应式对象，避免 IPC 序列化失败。
 * @param {Function} dependencies.createSuccessResponse 统一成功响应信封。
 * @param {Function} dependencies.createErrorResponse 统一失败响应信封。
 * @param {Function} dependencies.createStructuredErrorResponse 图像生成失败时的结构化错误信封。
 */
function registerImageIpcHandlers({
  ipcMain,
  imageModelManager,
  imageService,
  imageAdapterRegistry,
  safeSerialize,
  createSuccessResponse,
  createErrorResponse,
  createStructuredErrorResponse,
}) {
  // ===== Image Model handlers (Config-centric) =====
  ipcMain.handle('image-model-ensureInitialized', async () => {
    try {
      await imageModelManager.ensureInitialized();
      return createSuccessResponse(null);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('image-model-isInitialized', async () => {
    try {
      const result = await imageModelManager.isInitialized();
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('image-model-getAllConfigs', async () => {
    try {
      const result = await imageModelManager.getAllConfigs();
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('image-model-getConfig', async (_event, id) => {
    try {
      const result = await imageModelManager.getConfig(id);
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('image-model-addConfig', async (_event, config) => {
    try {
      const safeCfg = safeSerialize(config);
      await imageModelManager.addConfig(safeCfg);
      return createSuccessResponse(null);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('image-model-updateConfig', async (_event, id, updates) => {
    try {
      const safe = safeSerialize(updates);
      await imageModelManager.updateConfig(id, safe);
      return createSuccessResponse(null);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('image-model-deleteConfig', async (_event, id) => {
    try {
      await imageModelManager.deleteConfig(id);
      return createSuccessResponse(null);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('image-model-getEnabledConfigs', async () => {
    try {
      const result = await imageModelManager.getEnabledConfigs();
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('image-model-exportData', async () => {
    try {
      const result = await imageModelManager.exportData();
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('image-model-importData', async (_event, data) => {
    try {
      const safe = safeSerialize(data);
      await imageModelManager.importData(safe);
      return createSuccessResponse(null);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('image-model-getDataType', async () => {
    try {
      const result = await imageModelManager.getDataType();
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('image-model-validateData', async (_event, data) => {
    try {
      const safe = safeSerialize(data);
      const result = await imageModelManager.validateData(safe);
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  // ===== Image Service handlers =====
  ipcMain.handle('image-generate', async (_event, request) => {
    try {
      const safeReq = safeSerialize(request);
      const res = await imageService.generate(safeReq);
      return createSuccessResponse(res);
    } catch (error) {
      return createStructuredErrorResponse(error);
    }
  });

  // 显式模式：避免根据 inputImage 是否存在隐式推断
  ipcMain.handle('image-generateText2Image', async (_event, request) => {
    try {
      const safeReq = safeSerialize(request);
      const res = await imageService.generateText2Image(safeReq);
      return createSuccessResponse(res);
    } catch (error) {
      return createStructuredErrorResponse(error);
    }
  });

  ipcMain.handle('image-generateImage2Image', async (_event, request) => {
    try {
      const safeReq = safeSerialize(request);
      const res = await imageService.generateImage2Image(safeReq);
      return createSuccessResponse(res);
    } catch (error) {
      return createStructuredErrorResponse(error);
    }
  });

  ipcMain.handle('image-generateMultiImage', async (_event, request) => {
    try {
      const safeReq = safeSerialize(request);
      const res = await imageService.generateMultiImage(safeReq);
      return createSuccessResponse(res);
    } catch (error) {
      return createStructuredErrorResponse(error);
    }
  });

  ipcMain.handle('image-validateRequest', async (_event, request) => {
    try {
      const safeReq = safeSerialize(request);
      const res = await imageService.validateRequest(safeReq);
      return createSuccessResponse(res);
    } catch (error) {
      return createStructuredErrorResponse(error);
    }
  });

  ipcMain.handle('image-validateText2ImageRequest', async (_event, request) => {
    try {
      const safeReq = safeSerialize(request);
      const res = await imageService.validateText2ImageRequest(safeReq);
      return createSuccessResponse(res);
    } catch (error) {
      return createStructuredErrorResponse(error);
    }
  });

  ipcMain.handle('image-validateImage2ImageRequest', async (_event, request) => {
    try {
      const safeReq = safeSerialize(request);
      const res = await imageService.validateImage2ImageRequest(safeReq);
      return createSuccessResponse(res);
    } catch (error) {
      return createStructuredErrorResponse(error);
    }
  });

  ipcMain.handle('image-validateMultiImageRequest', async (_event, request) => {
    try {
      const safeReq = safeSerialize(request);
      const res = await imageService.validateMultiImageRequest(safeReq);
      return createSuccessResponse(res);
    } catch (error) {
      return createStructuredErrorResponse(error);
    }
  });

  // 连接测试在主进程执行，避免渲染端直接发起网络请求
  ipcMain.handle('image-testConnection', async (_event, config) => {
    try {
      const safeCfg = safeSerialize(config);
      // Reuse ImageService.testConnection to keep behavior consistent with Web:
      // - merges param overrides
      // - enforces base64-only input for image2image tests
      const result = await imageService.testConnection(safeCfg);
      return createSuccessResponse(result);
    } catch (error) {
      return createStructuredErrorResponse(error);
    }
  });

  // 动态模型拉取在主进程执行
  ipcMain.handle('image-getDynamicModels', async (_event, providerId, connectionConfig) => {
    try {
      const safeConn = safeSerialize(connectionConfig);
      const models = await imageAdapterRegistry.getDynamicModels(providerId, safeConn);
      return createSuccessResponse(models);
    } catch (error) {
      return createStructuredErrorResponse(error);
    }
  });
}

module.exports = {
  registerImageIpcHandlers,
};
