const path = require('path');

/**
 * 注册应用信息、运行时配置、外链和日志相关 IPC。
 * 这些 handler 横切多个领域，但接口边界清晰，适合从 composition root 拆出。
 *
 * @param {object} dependencies 系统级 IPC 注册依赖。
 */
function registerSystemIpcHandlers({
  ipcMain,
  shell,
  consoleLogger,
  registerSensitiveIpc,
  getPublicRuntimeConfig,
  isSafeExternalUrl,
  createIpcError,
  createSuccessResponse,
  createErrorResponse,
  setUiLocale,
  normalizeUiLocale,
  packageJsonPath = path.join(__dirname, '../../package.json'),
}) {
  // 环境配置同步 - 主进程作为唯一配置源
  registerSensitiveIpc('config-getEnvironmentVariables', async () => {
    const publicEnv = getPublicRuntimeConfig(process.env);
    console.log('[Main Process] Public runtime configuration requested by UI process');
    console.log(`[Main Process] Returning ${Object.keys(publicEnv).length / 2} public VITE_* variables (with no-prefix duplicates)`);
    return publicEnv;
  });

  // 外部链接处理器
  registerSensitiveIpc('shell-openExternal', async (_event, url) => {
    await shell.openExternal(url);
    return true;
  }, ([url]) => {
    if (typeof url !== 'string' || !isSafeExternalUrl(url)) {
      throw createIpcError('IPC_INVALID_ARGUMENT', 'Invalid IPC request arguments');
    }
  });

  // 应用信息处理器
  ipcMain.handle('app-get-version', () => {
    try {
      // package.json 由 Desktop 包自身提供，路径相对本 module 固定
      // eslint-disable-next-line import/no-dynamic-require, global-require
      const packageJson = require(packageJsonPath);
      return createSuccessResponse(packageJson.version);
    } catch (error) {
      console.error('[Main Process] Failed to get app version:', error);
      return createErrorResponse(error);
    }
  });

  // UI locale sync (renderer -> main)
  // Used to localize Electron-only UI like context menus.
  ipcMain.handle('app-set-locale', (_event, locale) => {
    try {
      setUiLocale(normalizeUiLocale(locale) || 'en-US');
      return createSuccessResponse(null);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  // 日志相关处理器
  ipcMain.handle('logs-get-paths', () => {
    try {
      const paths = consoleLogger.getLogPaths();
      return createSuccessResponse(paths);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('logs-open-directory', async () => {
    try {
      const { logDir } = consoleLogger.getLogPaths();
      await shell.openPath(logDir);
      return createSuccessResponse(true);
    } catch (error) {
      return createErrorResponse(error);
    }
  });
}

module.exports = {
  registerSystemIpcHandlers,
};
