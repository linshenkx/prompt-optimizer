/**
 * 将收藏领域错误整理为可序列化的结构化错误载荷。
 * 保留 code/details/cause，方便 renderer 做领域错误展示。
 */
function formatFavoriteError(error) {
  if (!error || typeof error !== 'object') {
    return { message: String(error || 'Unknown error'), code: 'UNKNOWN_ERROR' };
  }

  const formatted = {
    message: error.message || 'Unknown error',
    code: error.code || 'UNKNOWN_ERROR',
    name: error.name || 'Error',
  };

  if (error.details) {
    formatted.details = error.details;
  }

  if (error.cause) {
    formatted.cause = {
      message: error.cause.message || String(error.cause),
      code: error.cause.code,
      name: error.cause.name,
    };
  }

  return formatted;
}

/**
 * 输出收藏 IPC 失败日志，并返回与历史实现一致的错误信封。
 */
function createFavoriteErrorResponse(error) {
  console.error('[Favorite IPC Error]', error);
  return { success: false, error: formatFavoriteError(error) };
}

/**
 * 注册收藏管理相关的 Desktop IPC interface。
 * 保持现有 channel、位置参数和响应信封不变，仅从 main.js 拆出领域实现。
 *
 * @param {object} dependencies 收藏领域注册依赖。
 * @param {Electron.IpcMain} dependencies.ipcMain Electron IPC 主进程对象。
 * @param {object} dependencies.favoriteManager Core 收藏管理器。
 * @param {Function} dependencies.safeSerialize 清理 Vue 响应式对象，避免 IPC 序列化失败。
 * @param {Function} dependencies.createSuccessResponse 统一成功响应信封。
 */
function registerFavoriteIpcHandlers({
  ipcMain,
  favoriteManager,
  safeSerialize,
  createSuccessResponse,
}) {
  ipcMain.handle('favorite-addFavorite', async (_event, favorite) => {
    try {
      const safeFavorite = safeSerialize(favorite);
      const result = await favoriteManager.addFavorite(safeFavorite);
      return createSuccessResponse(result);
    } catch (error) {
      return createFavoriteErrorResponse(error);
    }
  });

  ipcMain.handle('favorite-getFavorites', async (_event, options) => {
    try {
      const safeOptions = safeSerialize(options);
      const result = await favoriteManager.getFavorites(safeOptions || undefined);
      return createSuccessResponse(result);
    } catch (error) {
      return createFavoriteErrorResponse(error);
    }
  });

  ipcMain.handle('favorite-getFavorite', async (_event, id) => {
    try {
      const result = await favoriteManager.getFavorite(id);
      return createSuccessResponse(result);
    } catch (error) {
      return createFavoriteErrorResponse(error);
    }
  });

  ipcMain.handle('favorite-updateFavorite', async (_event, id, updates) => {
    try {
      const safeUpdates = safeSerialize(updates);
      await favoriteManager.updateFavorite(id, safeUpdates);
      return createSuccessResponse(null);
    } catch (error) {
      return createFavoriteErrorResponse(error);
    }
  });

  ipcMain.handle('favorite-setFavoritePromptAssetCurrentVersion', async (_event, id, versionId) => {
    try {
      await favoriteManager.setFavoritePromptAssetCurrentVersion(id, versionId);
      return createSuccessResponse(null);
    } catch (error) {
      return createFavoriteErrorResponse(error);
    }
  });

  ipcMain.handle('favorite-deleteFavoritePromptAssetVersion', async (_event, id, versionId) => {
    try {
      await favoriteManager.deleteFavoritePromptAssetVersion(id, versionId);
      return createSuccessResponse(null);
    } catch (error) {
      return createFavoriteErrorResponse(error);
    }
  });

  ipcMain.handle('favorite-deleteFavorite', async (_event, id) => {
    try {
      await favoriteManager.deleteFavorite(id);
      return createSuccessResponse(null);
    } catch (error) {
      return createFavoriteErrorResponse(error);
    }
  });

  ipcMain.handle('favorite-deleteFavorites', async (_event, ids) => {
    try {
      const safeIds = safeSerialize(ids);
      await favoriteManager.deleteFavorites(safeIds);
      return createSuccessResponse(null);
    } catch (error) {
      return createFavoriteErrorResponse(error);
    }
  });

  ipcMain.handle('favorite-incrementUseCount', async (_event, id) => {
    try {
      await favoriteManager.incrementUseCount(id);
      return createSuccessResponse(null);
    } catch (error) {
      return createFavoriteErrorResponse(error);
    }
  });

  ipcMain.handle('favorite-getCategories', async () => {
    try {
      const result = await favoriteManager.getCategories();
      return createSuccessResponse(result);
    } catch (error) {
      return createFavoriteErrorResponse(error);
    }
  });

  ipcMain.handle('favorite-addCategory', async (_event, category) => {
    try {
      const safeCategory = safeSerialize(category);
      const result = await favoriteManager.addCategory(safeCategory);
      return createSuccessResponse(result);
    } catch (error) {
      return createFavoriteErrorResponse(error);
    }
  });

  ipcMain.handle('favorite-updateCategory', async (_event, id, updates) => {
    try {
      const safeUpdates = safeSerialize(updates);
      await favoriteManager.updateCategory(id, safeUpdates);
      return createSuccessResponse(null);
    } catch (error) {
      return createFavoriteErrorResponse(error);
    }
  });

  ipcMain.handle('favorite-deleteCategory', async (_event, id) => {
    try {
      const result = await favoriteManager.deleteCategory(id);
      return createSuccessResponse(result);
    } catch (error) {
      return createFavoriteErrorResponse(error);
    }
  });

  ipcMain.handle('favorite-getStats', async () => {
    try {
      const result = await favoriteManager.getStats();
      return createSuccessResponse(result);
    } catch (error) {
      return createFavoriteErrorResponse(error);
    }
  });

  ipcMain.handle('favorite-searchFavorites', async (_event, keyword, options) => {
    try {
      const safeOptions = safeSerialize(options);
      const result = await favoriteManager.searchFavorites(keyword, safeOptions || undefined);
      return createSuccessResponse(result);
    } catch (error) {
      return createFavoriteErrorResponse(error);
    }
  });

  ipcMain.handle('favorite-exportFavorites', async (_event, ids) => {
    try {
      const safeIds = safeSerialize(ids);
      const result = await favoriteManager.exportFavorites(safeIds || undefined);
      return createSuccessResponse(result);
    } catch (error) {
      return createFavoriteErrorResponse(error);
    }
  });

  ipcMain.handle('favorite-importFavorites', async (_event, data, options) => {
    try {
      const safeData = typeof data === 'string' ? data : safeSerialize(data);
      const safeOptions = safeSerialize(options);
      const result = await favoriteManager.importFavorites(safeData, safeOptions || undefined);
      return createSuccessResponse(result);
    } catch (error) {
      return createFavoriteErrorResponse(error);
    }
  });

  ipcMain.handle('favorite-getAllTags', async () => {
    try {
      const result = await favoriteManager.getAllTags();
      return createSuccessResponse(result);
    } catch (error) {
      return createFavoriteErrorResponse(error);
    }
  });

  ipcMain.handle('favorite-addTag', async (_event, tag) => {
    try {
      await favoriteManager.addTag(tag);
      return createSuccessResponse(null);
    } catch (error) {
      return createFavoriteErrorResponse(error);
    }
  });

  ipcMain.handle('favorite-renameTag', async (_event, oldTag, newTag) => {
    try {
      const result = await favoriteManager.renameTag(oldTag, newTag);
      return createSuccessResponse(result);
    } catch (error) {
      return createFavoriteErrorResponse(error);
    }
  });

  ipcMain.handle('favorite-mergeTags', async (_event, sourceTags, targetTag) => {
    try {
      const safeSourceTags = safeSerialize(sourceTags);
      const result = await favoriteManager.mergeTags(safeSourceTags, targetTag);
      return createSuccessResponse(result);
    } catch (error) {
      return createFavoriteErrorResponse(error);
    }
  });

  ipcMain.handle('favorite-deleteTag', async (_event, tag) => {
    try {
      const result = await favoriteManager.deleteTag(tag);
      return createSuccessResponse(result);
    } catch (error) {
      return createFavoriteErrorResponse(error);
    }
  });

  ipcMain.handle('favorite-reorderCategories', async (_event, categoryIds) => {
    try {
      const safeCategoryIds = safeSerialize(categoryIds);
      await favoriteManager.reorderCategories(safeCategoryIds);
      return createSuccessResponse(null);
    } catch (error) {
      return createFavoriteErrorResponse(error);
    }
  });

  ipcMain.handle('favorite-getCategoryUsage', async (_event, categoryId) => {
    try {
      const result = await favoriteManager.getCategoryUsage(categoryId);
      return createSuccessResponse(result);
    } catch (error) {
      return createFavoriteErrorResponse(error);
    }
  });

  ipcMain.handle('favorite-ensureDefaultCategories', async (_event, defaultCategories) => {
    try {
      const safeCategories = safeSerialize(defaultCategories);
      await favoriteManager.ensureDefaultCategories(safeCategories);
      return createSuccessResponse(null);
    } catch (error) {
      return createFavoriteErrorResponse(error);
    }
  });
}

module.exports = {
  registerFavoriteIpcHandlers,
  formatFavoriteError,
  createFavoriteErrorResponse,
};
