const fs = require('fs');
const path = require('path');

/**
 * 注册数据导入导出与本地存储信息相关的 Desktop IPC interface。
 * 保持现有 channel、位置参数和响应信封不变。
 *
 * @param {object} dependencies 数据领域注册依赖。
 */
function registerDataIpcHandlers({
  ipcMain,
  dataManager,
  app,
  shell,
  createSuccessResponse,
  createErrorResponse,
}) {
  ipcMain.handle('data-exportAllData', async () => {
    try {
      const result = await dataManager.exportAllData();
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('data-importAllData', async (_event, dataString) => {
    try {
      await dataManager.importAllData(dataString);
      return createSuccessResponse(null);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  // Desktop: storage helpers for Data Manager UI
  ipcMain.handle('data-getStorageInfo', async () => {
    try {
      const userDataPath = app.getPath('userData');
      const mainFilePath = path.join(userDataPath, 'prompt-optimizer-data.json');
      const backupFilePath = path.join(userDataPath, 'prompt-optimizer-data.json.backup');

      /** 安全读取文件体积，缺失时返回 0。 */
      const statSafe = async (targetPath) => {
        try {
          const stats = await fs.promises.stat(targetPath);
          return typeof stats?.size === 'number' ? stats.size : 0;
        } catch {
          return 0;
        }
      };

      const mainSizeBytes = await statSafe(mainFilePath);
      const backupSizeBytes = await statSafe(backupFilePath);

      return createSuccessResponse({
        userDataPath,
        mainFilePath,
        mainSizeBytes,
        backupFilePath,
        backupSizeBytes,
        totalBytes: mainSizeBytes + backupSizeBytes,
      });
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('data-openStorageDirectory', async () => {
    try {
      const userDataPath = app.getPath('userData');
      await shell.openPath(userDataPath);
      return createSuccessResponse(true);
    } catch (error) {
      return createErrorResponse(error);
    }
  });
}

module.exports = {
  registerDataIpcHandlers,
};
