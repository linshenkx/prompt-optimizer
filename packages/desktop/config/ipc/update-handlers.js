/**
 * 自动更新 IPC 与 autoUpdater 事件装配。
 * 通过 ctx 读取/写回 main 进程的 preferenceService、mainWindow、isUpdaterQuitting，
 * 避免与 Electron 生命周期状态脱节。
 *
 * @param {object} ctx 主进程注入的依赖与可变状态访问器。
 * @returns {{ setupUpdateHandlers: Function }}
 */
function createUpdateHandlers(ctx) {
  const {
    ipcMain,
    autoUpdater,
    app,
    path,
    createSuccessResponse,
    createErrorResponse,
    createDetailedErrorResponse,
    DEFAULT_CONFIG,
    IPC_EVENTS,
    PREFERENCE_KEYS,
    validateVersion,
    buildReleaseUrl,
  } = ctx;

  // 忽略版本管理辅助函数（全局作用域）
  const getIgnoredVersions = async () => {
    try {
      const ignoredVersions = await ctx.preferenceService.get(PREFERENCE_KEYS.IGNORED_VERSIONS, null);
      if (ignoredVersions && typeof ignoredVersions === 'object') {
        return ignoredVersions;
      }
      return { stable: null, prerelease: null };
    } catch (error) {
      console.warn('[Updater] Failed to read ignored versions, using defaults:', error);
      return { stable: null, prerelease: null };
    }
  };

  const isVersionIgnored = async (version) => {
    const ignoredVersions = await getIgnoredVersions();
    const versionType = version.includes('-') ? 'prerelease' : 'stable';

    // 检查对应类型的忽略版本
    if (versionType === 'stable' && ignoredVersions.stable === version) {
      return true;
    }
    if (versionType === 'prerelease' && ignoredVersions.prerelease === version) {
      return true;
    }

    return false;
  };

  // 自动更新处理器设置
  async function setupUpdateHandlers() {
    console.log('[Main Process] Setting up auto-update handlers...');



    // 更新操作状态锁，防止并发调用
    let isCheckingForUpdate = false;
    let isDownloadingUpdate = false;
    let isInstallingUpdate = false;

    // 配置更新器基本设置
    autoUpdater.autoDownload = DEFAULT_CONFIG.autoDownload;
    autoUpdater.allowPrerelease = DEFAULT_CONFIG.allowPrerelease;
    autoUpdater.allowDowngrade = false; // 默认不允许降级，只在渠道切换时临时启用

    // 环境变量动态配置支持（仅支持公开仓库）
    const defaultRepo = 'linshenkx/prompt-optimizer';
    let currentRepo = null;

    // 检测环境变量中的仓库信息
    if (process.env.GITHUB_REPOSITORY) {
      currentRepo = process.env.GITHUB_REPOSITORY;
    } else if (process.env.DEV_REPO_OWNER && process.env.DEV_REPO_NAME) {
      currentRepo = `${process.env.DEV_REPO_OWNER}/${process.env.DEV_REPO_NAME}`;
    }

    // 如果环境变量中的仓库与默认仓库不同，使用setFeedURL动态配置
    if (currentRepo && currentRepo !== defaultRepo) {
      try {
        const [owner, repo] = currentRepo.split('/');

        const feedConfig = {
          provider: 'github',
          owner,
          repo,
          private: false // 只支持公开仓库
        };

        console.log('[Updater] Using custom repository configuration:', {
          owner,
          repo,
          private: false,
          source: 'environment variables'
        });

        autoUpdater.setFeedURL(feedConfig);
      } catch (configError) {
        console.error('[Updater] Failed to configure custom repository:', configError);
        console.log('[Updater] Falling back to default configuration');
      }
    } else {
      console.log('[Updater] Using default repository configuration:', defaultRepo);
    }

    // 开发模式下的更新检查配置
    if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
      console.log('[Updater] Development mode detected');
    
      // 设置开发环境专用的日志器（官方推荐）
      const log = require('electron-log');
      autoUpdater.logger = log;
      autoUpdater.logger.transports.file.level = 'debug';
      autoUpdater.logger.transports.console.level = 'debug';
    
      // 为更新器创建专门的日志文件
      const userDataPath = app.getPath('userData');
      autoUpdater.logger.transports.file.resolvePathFn = () => 
        path.join(userDataPath, 'logs', 'auto-updater.log');
    
      // 强制启用开发模式更新检查
      autoUpdater.forceDevUpdateConfig = true;
    
      console.log('[Updater] Development mode configuration:');
      console.log('[Updater] - forceDevUpdateConfig: true');
      console.log('[Updater] - Looking for dev-app-update.yml in:', path.join(__dirname, 'dev-app-update.yml'));
      console.log('[Updater] - dev-app-update.yml exists:', require('fs').existsSync(path.join(__dirname, 'dev-app-update.yml')));
    
      console.log('[Updater] Development mode update testing enabled');
      console.log('[Updater] Auto-updater logs will be saved to:', path.join(userDataPath, 'logs', 'auto-updater.log'));
    }

    // 设置更新事件处理 - 仅在应用启动时设置一次
    autoUpdater.on('update-available', async (info) => {
      console.log('[Updater] Update available:', info);

      try {
        // 验证版本号格式
        if (!validateVersion(info.version)) {
          console.error('[Updater] Invalid version format:', info.version);
          return;
        }

        // 检查版本是否被忽略
        try {
          const isIgnored = await isVersionIgnored(info.version);
          if (isIgnored) {
            console.log('[Updater] Ignoring version:', info.version);
            return;
          }
        } catch (prefError) {
          console.warn('[Updater] Failed to check ignored versions, continuing with update check:', prefError);
          // 继续执行，不阻断更新流程
        }

        // 构建安全的GitHub Release页面链接
        let releaseUrl;
        try {
          releaseUrl = buildReleaseUrl(info.version);
        } catch (urlError) {
          console.error('[Updater] Failed to build release URL:', urlError);
          // 使用fallback URL或跳过URL
          releaseUrl = null;
        }

        // 发送更新可用通知到UI
        if (ctx.mainWindow && !ctx.mainWindow.isDestroyed()) {
          ctx.mainWindow.webContents.send(IPC_EVENTS.UPDATE_AVAILABLE_INFO, {
            version: info.version,
            releaseDate: info.releaseDate,
            releaseNotes: info.releaseNotes,
            releaseUrl: releaseUrl
          });
        }
      } catch (error) {
        console.error('[Updater] Critical error in update-available handler:', error);
        // 即使出错也要通知用户有更新可用，但不包含详细信息
        if (ctx.mainWindow && !ctx.mainWindow.isDestroyed()) {
          ctx.mainWindow.webContents.send(IPC_EVENTS.UPDATE_AVAILABLE_INFO, {
            version: info.version || 'Unknown',
            releaseDate: info.releaseDate || null,
            releaseNotes: null,
            releaseUrl: null,
            error: 'Failed to process update information'
          });
        }
      }
    });

    autoUpdater.on('update-not-available', (info) => {
      console.log('[Updater] No update available:', info);
      // 注意：现在这个事件监听器主要用于日志记录
      // 实际的UI更新逻辑已经移到前端的请求-响应模式中
      // 这样避免了竞争条件和全局状态的问题
    });

    autoUpdater.on('error', (error) => {
      console.error('[Updater] Update error:', error);

      // 如果是 403 错误，提供基本的调试信息
      if (error.code === 'HTTP_ERROR_403' || (error.message && error.message.includes('403'))) {
        console.log('[Updater Debug] ===== 403 ERROR DEBUGGING =====');
        console.log('[Updater Debug] This is a 403 Forbidden error, likely repository access issue');

        console.log('[Updater Debug] Common 403 causes:');
        console.log('[Updater Debug] 1. Repository is private (not supported)');
        console.log('[Updater Debug] 2. Repository does not exist');
        console.log('[Updater Debug] 3. Network/firewall blocking GitHub API');
        console.log('[Updater Debug] 4. GitHub API rate limiting');

        console.log('[Updater Debug] Error details:', {
          code: error.code,
          message: error.message,
          stack: error.stack
        });
        console.log('[Updater Debug] =====================================');
      }

      // 重置所有状态锁，允许用户重试
      isCheckingForUpdate = false;
      isDownloadingUpdate = false;
      isInstallingUpdate = false;

      // 创建详细的错误信息
      const detailedErrorResponse = createDetailedErrorResponse(error);

      // 发送详细错误事件到UI
      if (ctx.mainWindow && !ctx.mainWindow.isDestroyed()) {
        ctx.mainWindow.webContents.send(IPC_EVENTS.UPDATE_ERROR, {
          message: detailedErrorResponse.error,
          code: error.code || 'UNKNOWN_ERROR',
          timestamp: new Date().toISOString()
        });
      }
    });

    autoUpdater.on('download-progress', (progress) => {
      console.log('[Updater] Download progress:', progress);
      if (ctx.mainWindow && !ctx.mainWindow.isDestroyed()) {
        ctx.mainWindow.webContents.send(IPC_EVENTS.UPDATE_DOWNLOAD_PROGRESS, progress);
      }
    });

    autoUpdater.on('update-downloaded', (info) => {
      console.log('[Updater] Update downloaded:', info);
      console.log('[Updater] ===== UPDATE READY FOR INSTALLATION =====');
      console.log('[Updater] Downloaded version:', info.version);
      console.log('[Updater] Release date:', info.releaseDate);
      console.log('[Updater] Next step: User needs to click "Install and Restart" to complete the update');
      console.log('[Updater] The application will automatically restart after installation');
      console.log('[Updater] =============================================');
    
      // 下载完成，重置下载状态
      isDownloadingUpdate = false;
    
      if (ctx.mainWindow && !ctx.mainWindow.isDestroyed()) {
        // 发送更详细的信息给前端，包含安装提示
        ctx.mainWindow.webContents.send(IPC_EVENTS.UPDATE_DOWNLOADED, {
          ...info,
          message: 'Update downloaded successfully. Click "Install and Restart" to complete the installation.',
          needsRestart: true,
          canInstallNow: true,
          installAction: 'Click the install button to restart and apply the update'
        });
      }
    });

    // 检查更新 - 直接返回完整结果，避免全局状态
    ipcMain.handle(IPC_EVENTS.UPDATE_CHECK, async () => {
      // 检查是否已有更新检查在进行中
      if (isCheckingForUpdate) {
        console.log('[Updater] Update check already in progress, ignoring request');
        return createSuccessResponse({
          message: 'Update check already in progress',
          inProgress: true
        });
      }

      // 设置检查状态锁
      isCheckingForUpdate = true;

      try {
        // 读取用户偏好设置，使用错误边界处理和明确的备用方案
        let allowPrerelease = DEFAULT_CONFIG.allowPrerelease;
        try {
          allowPrerelease = await ctx.preferenceService.get(PREFERENCE_KEYS.ALLOW_PRERELEASE, DEFAULT_CONFIG.allowPrerelease);
          console.log('[Updater] Successfully read prerelease preference:', allowPrerelease);
        } catch (prefError) {
          console.warn('[Updater] PreferenceService unavailable, using safe default (stable releases only):', prefError);
          allowPrerelease = false; // 明确的安全默认值

          // 可选：通知用户偏好设置不可用
          if (ctx.mainWindow && !ctx.mainWindow.isDestroyed()) {
            ctx.mainWindow.webContents.send('preference-service-warning', {
              message: 'Settings temporarily unavailable, using default configuration',
              timestamp: new Date().toISOString()
            });
          }
        }

        console.log('[Updater] Checking for updates with settings:', { allowPrerelease });

        // 配置更新器
        autoUpdater.allowPrerelease = allowPrerelease;

        // 执行更新检查
        console.log('[Updater] Starting update check...');
      
        // 在实际调用 checkForUpdates 前检查配置
        console.log('[Updater Debug] ===== PRE-CHECK CONFIGURATION =====');
        console.log('[Updater Debug] autoUpdater.allowPrerelease:', autoUpdater.allowPrerelease);
        console.log('[Updater Debug] autoUpdater.autoDownload:', autoUpdater.autoDownload);
        console.log('[Updater Debug] ===============================================');
      
        const result = await autoUpdater.checkForUpdates();

        console.log('[DEBUG] ===== BACKEND UPDATE CHECK RESULT =====');
        console.log('[DEBUG] autoUpdater.checkForUpdates() returned:', result);
        console.log('[DEBUG] Result type:', typeof result);
        console.log('[DEBUG] Result is null:', result === null);
        console.log('[DEBUG] Result is undefined:', result === undefined);
        if (result) {
          console.log('[DEBUG] Result.updateInfo:', result.updateInfo);
          console.log('[DEBUG] Result.updateInfo type:', typeof result.updateInfo);
        }
        console.log('[DEBUG] ==========================================');

        // 构建完整的响应数据，包含所有必要信息
        const currentVersion = require('../../package.json').version;
        let responseData = {
          checkResult: result,
          currentVersion: currentVersion,
          hasUpdate: false,
          remoteVersion: null,
          remoteReleaseUrl: null,
          message: 'Update check completed'
        };

        if (result && result.updateInfo) {
          const updateInfo = result.updateInfo;
          responseData.remoteVersion = updateInfo.version;
          responseData.hasUpdate = updateInfo.version !== currentVersion;

          // 构建发布页面URL
          try {
            responseData.remoteReleaseUrl = buildReleaseUrl(updateInfo.version);
          } catch (urlError) {
            console.warn('[Updater] Failed to build release URL:', urlError);
          }

          if (responseData.hasUpdate) {
            responseData.message = `New version ${updateInfo.version} is available`;
          } else {
            responseData.message = `You are already using the latest version (${updateInfo.version})`;
          }

          console.log('[Updater] Successfully retrieved update info:', {
            remoteVersion: updateInfo.version,
            hasUpdate: responseData.hasUpdate,
            releaseUrl: responseData.remoteReleaseUrl
          });
        } else {
          // 没有获取到远程版本信息，这可能是配置或网络问题
          console.log('[Updater] No update info received - checking possible causes...');

          // 生产环境或配置了开发环境但仍然没有获取到信息
          console.warn('[Updater] No update info received - this may indicate a configuration or network issue');
          console.warn('[Updater] Possible causes:');
          console.warn('  - app-update.yml missing or misconfigured');
          console.warn('  - Network connectivity issues');
          console.warn('  - GitHub repository access issues');
          console.warn('  - Invalid repository configuration');

          responseData.message = 'Unable to check for updates - configuration or network issue';
          responseData.checkResult = null;
        }

        return createSuccessResponse(responseData);
      } catch (error) {
        console.error('[Updater] Check update failed:', error);
        const detailedResponse = createDetailedErrorResponse(error);
        console.error('[DEBUG] Detailed error response being sent:', detailedResponse);
        return detailedResponse;
      } finally {
        // 无论成功还是失败，都要释放锁
        isCheckingForUpdate = false;
        console.log('[Updater] Update check completed, lock released');
      }
    });

    // 统一检查所有版本（解决并发冲突问题）
    ipcMain.handle(IPC_EVENTS.UPDATE_CHECK_ALL_VERSIONS, async () => {
      console.log('[Updater] Starting unified version check for all versions');
    
      // 检查是否已有更新检查在进行中
      if (isCheckingForUpdate) {
        console.log('[Updater] Update check already in progress, ignoring request');
        return createSuccessResponse({
          message: 'Update check already in progress',
          inProgress: true
        });
      }

      // 设置检查状态锁
      isCheckingForUpdate = true;

      try {
        // 获取当前版本
        const currentVersion = require('../../package.json').version;
        const results = {
          currentVersion,
          stable: null,
          prerelease: null
        };

        // 辅助函数：处理单个版本检查结果
        const processResult = (result, versionType) => {
          if (!result || !result.updateInfo) {
            console.log(`[Updater] No ${versionType} update available`);
            return {
              hasUpdate: false,
              remoteVersion: null,
              remoteReleaseUrl: null,
              message: `No ${versionType} update available`,
              versionType,
              noVersionFound: true
            };
          }

          const updateInfo = result.updateInfo;
          const remoteVersion = updateInfo.version;

          // 预览版检查时，过滤掉正式版
          if (versionType === 'prerelease') {
            const isPrerelease = remoteVersion.includes('-');
            if (!isPrerelease) {
              return {
                hasUpdate: false,
                remoteVersion: null,
                remoteReleaseUrl: null,
                message: 'No newer prerelease available (latest release is stable)',
                versionType,
                noVersionFound: true,
                latestStableVersion: remoteVersion
              };
            }
          }

          // 简单但有效的版本比较：让前端处理复杂的语义化版本比较
          // 这里只需要确保返回远程版本信息，前端会进行准确的版本比较
          const hasUpdate = remoteVersion !== currentVersion;

          console.log(`[Updater] Version check for ${versionType}:`, {
            currentVersion,
            remoteVersion,
            hasUpdate: hasUpdate ? 'possible (will be verified by frontend)' : 'no'
          });
          let remoteReleaseUrl = null;

          // 构建发布页面URL
          try {
            remoteReleaseUrl = buildReleaseUrl(updateInfo.version);
          } catch (urlError) {
            console.warn(`[Updater] Failed to build ${versionType} release URL:`, urlError);
          }

          console.log(`[Updater] ${versionType} version check result:`, {
            remoteVersion,
            hasUpdate,
            releaseUrl: remoteReleaseUrl
          });

          return {
            hasUpdate,
            remoteVersion,
            remoteReleaseUrl,
            message: hasUpdate ?
              `New ${versionType} version ${remoteVersion} is available` :
              `You are already using the latest ${versionType} version`,
            versionType,
            releaseDate: updateInfo.releaseDate,
            releaseNotes: updateInfo.releaseNotes
          };
        };

        // 1. 检查正式版
        console.log('[Updater] Checking stable version...');
        autoUpdater.allowPrerelease = false;
      
        try {
          const stableResult = await autoUpdater.checkForUpdates();
          results.stable = processResult(stableResult, 'stable');
        } catch (error) {
          console.error('[Updater] Stable version check failed:', error);
          results.stable = {
            hasUpdate: false,
            remoteVersion: null,
            remoteReleaseUrl: null,
            message: `Stable version check failed: ${error.message}`,
            versionType: 'stable',
            error: error.message
          };
        }

        // 2. 延迟后检查预览版（避免状态冲突）
        console.log('[Updater] Waiting before checking prerelease version...');
        await new Promise(resolve => setTimeout(resolve, 1000));

        console.log('[Updater] Checking prerelease version...');
        autoUpdater.allowPrerelease = true;
      
        try {
          const prereleaseResult = await autoUpdater.checkForUpdates();
          results.prerelease = processResult(prereleaseResult, 'prerelease');
        } catch (error) {
          console.error('[Updater] Prerelease version check failed:', error);
          results.prerelease = {
            hasUpdate: false,
            remoteVersion: null,
            remoteReleaseUrl: null,
            message: `Prerelease version check failed: ${error.message}`,
            versionType: 'prerelease',
            error: error.message
          };
        }

        // 3. 恢复用户偏好设置
        try {
          const userPreference = await ctx.preferenceService.get(PREFERENCE_KEYS.ALLOW_PRERELEASE, DEFAULT_CONFIG.allowPrerelease);
          autoUpdater.allowPrerelease = userPreference;
          autoUpdater.allowDowngrade = false; // 总是恢复为 false
          console.log('[Updater] Restored user preference:', { allowPrerelease: userPreference, allowDowngrade: false });
        } catch (prefError) {
          console.warn('[Updater] Failed to restore user preference, using default:', prefError);
          autoUpdater.allowPrerelease = DEFAULT_CONFIG.allowPrerelease;
          autoUpdater.allowDowngrade = false; // 确保在错误情况下也恢复
        }

        console.log('[Updater] Unified version check completed:', {
          stable: results.stable?.hasUpdate ? results.stable.remoteVersion : 'no update',
          prerelease: results.prerelease?.hasUpdate ? results.prerelease.remoteVersion : 'no update'
        });

        return createSuccessResponse(results);
      } catch (error) {
        console.error('[Updater] Unified version check failed:', error);
        return createDetailedErrorResponse(error);
      } finally {
        // 无论成功还是失败，都要释放锁
        isCheckingForUpdate = false;
        console.log('[Updater] Unified version check completed, lock released');
      }
    });

    // 开始下载更新
    ipcMain.handle(IPC_EVENTS.UPDATE_START_DOWNLOAD, async () => {
      // 检查是否已有下载在进行中
      if (isDownloadingUpdate) {
        console.log('[Updater] Download already in progress, ignoring request');
        return createSuccessResponse({
          message: 'Download already in progress',
          inProgress: true
        });
      }

      // 设置下载状态锁
      isDownloadingUpdate = true;

      try {
        console.log('[Updater] Starting update download...');
        await autoUpdater.downloadUpdate();
        return createSuccessResponse(null);
      } catch (error) {
        console.error('[Updater] Download failed:', error);
        isDownloadingUpdate = false; // 失败时重置状态
        return createDetailedErrorResponse(error);
      }
    });

    // 安装更新
    ipcMain.handle(IPC_EVENTS.UPDATE_INSTALL, async () => {
      // 检查是否已有安装在进行中
      if (isInstallingUpdate) {
        console.log('[Updater] Install already in progress, ignoring request');
        return createSuccessResponse({
          message: 'Install already in progress',
          inProgress: true
        });
      }

      // 设置安装状态锁
      isInstallingUpdate = true;

      try {
        console.log('[Updater] ===== STARTING UPDATE INSTALLATION =====');
        console.log('[Updater] User clicked "Install and Restart"');
        console.log('[Updater] The application will now close and restart with the new version');
        console.log('[Updater] If the application does not restart automatically, please launch it manually');
        console.log('[Updater] ==========================================');
      
        // 设置更新安装退出标志，跳过数据保存逻辑
        ctx.isUpdaterQuitting = true;
        console.log('[Updater] Set updater quit flag to skip data save');
      
        // 注意：quitAndInstall会立即退出应用，所以不会执行到finally
        // 这个方法会：
        // 1. 关闭当前应用
        // 2. 安装新版本
        // 3. 启动新版本的应用
        autoUpdater.quitAndInstall();
      
        // 这行代码通常不会执行到，因为 quitAndInstall() 会立即退出应用
        return createSuccessResponse({
          message: 'Installation started, application will restart'
        });
      } catch (error) {
        console.error('[Updater] Install failed:', error);
        console.error('[Updater] ===== INSTALLATION ERROR =====');
        console.error('[Updater] Error details:', error.message);
        console.error('[Updater] This may indicate:');
        console.error('[Updater] 1. Update file was corrupted during download');
        console.error('[Updater] 2. Insufficient permissions to install');
        console.error('[Updater] 3. Antivirus software blocked the installation');
        console.error('[Updater] 4. The update file was not properly downloaded');
        console.error('[Updater] Please try downloading the update again');
        console.error('[Updater] ===============================');
      
        return createDetailedErrorResponse(error);
      } finally {
        // 确保锁总是被释放（虽然quitAndInstall成功时不会执行到这里）
        isInstallingUpdate = false;
      }
    });

    // 获取忽略版本状态
    ipcMain.handle(IPC_EVENTS.UPDATE_GET_IGNORED_VERSIONS, async () => {
      try {
        const ignoredVersions = await getIgnoredVersions();
        console.log('[Updater] Retrieved ignored versions:', ignoredVersions);
        return createSuccessResponse(ignoredVersions);
      } catch (error) {
        console.error('[Updater] Failed to get ignored versions:', error);
        return createDetailedErrorResponse(error);
      }
    });

    // 忽略版本
    ipcMain.handle(IPC_EVENTS.UPDATE_IGNORE_VERSION, async (event, version, versionType) => {
      try {
        // 验证版本号格式
        if (!validateVersion(version)) {
          throw new Error(`Invalid version format: ${version}`);
        }

        // 如果没有指定类型，根据版本号自动判断
        if (!versionType) {
          versionType = version.includes('-') ? 'prerelease' : 'stable';
        }

        console.log('[Updater] Ignoring version:', version, 'type:', versionType);

        // 获取当前忽略版本数据
        const ignoredVersions = await getIgnoredVersions();

        // 更新对应类型的忽略版本
        ignoredVersions[versionType] = version;

        // 保存更新后的数据
        await ctx.preferenceService.set(PREFERENCE_KEYS.IGNORED_VERSIONS, ignoredVersions);

        return createSuccessResponse(null);
      } catch (error) {
        console.error('[Updater] Failed to ignore version:', error);
        return createDetailedErrorResponse(error);
      }
    });

    // 取消忽略版本
    ipcMain.handle(IPC_EVENTS.UPDATE_UNIGNORE_VERSION, async (event, versionType) => {
      try {
        // 验证版本类型
        if (!['stable', 'prerelease'].includes(versionType)) {
          throw new Error(`Invalid version type: ${versionType}`);
        }

        console.log('[Updater] Unignoring version type:', versionType);

        // 获取当前忽略版本数据
        const ignoredVersions = await getIgnoredVersions();

        // 清除对应类型的忽略版本
        ignoredVersions[versionType] = null;

        // 保存更新后的数据
        await ctx.preferenceService.set(PREFERENCE_KEYS.IGNORED_VERSIONS, ignoredVersions);

        return createSuccessResponse(null);
      } catch (error) {
        console.error('[Updater] Failed to unignore version:', error);
        return createDetailedErrorResponse(error);
      }
    });

    // 下载特定版本（原子操作）
    ipcMain.handle(IPC_EVENTS.UPDATE_DOWNLOAD_SPECIFIC_VERSION, async (event, versionType) => {
      try {
        console.log('[Updater] Starting atomic download for version type:', versionType);

        // 验证版本类型
        if (!['stable', 'prerelease'].includes(versionType)) {
          throw new Error(`Invalid version type: ${versionType}`);
        }

        // 防止并发下载 - 立即设置状态锁
        if (isDownloadingUpdate) {
          console.log('[Updater] Download already in progress');
          return createErrorResponse('Download already in progress');
        }

        // 立即设置下载状态，防止竞态条件
        isDownloadingUpdate = true;

        // 1. 保存当前配置（包括偏好设置和autoUpdater实例配置）
        const originalPreference = await ctx.preferenceService.get(PREFERENCE_KEYS.ALLOW_PRERELEASE, false);
        const originalAutoUpdaterConfig = {
          allowPrerelease: autoUpdater.allowPrerelease,
          allowDowngrade: autoUpdater.allowDowngrade
        };
        console.log('[Updater] Original preference:', originalPreference);
        console.log('[Updater] Original autoUpdater config:', originalAutoUpdaterConfig);

        try {
          // 2. 设置目标通道（同时修改偏好设置和autoUpdater实例）
          const targetPreference = versionType === 'prerelease';
          await ctx.preferenceService.set(PREFERENCE_KEYS.ALLOW_PRERELEASE, targetPreference);

          // 直接配置autoUpdater实例，确保本次操作使用正确配置
          autoUpdater.allowPrerelease = targetPreference;
          autoUpdater.allowDowngrade = true; // 允许降级，支持从预览版切换到正式版

          console.log('[Updater] Set preference to:', targetPreference);
          console.log('[Updater] Set autoUpdater config:', {
            allowPrerelease: autoUpdater.allowPrerelease,
            allowDowngrade: autoUpdater.allowDowngrade
          });

          // 3. 检查更新
          console.log('[Updater] Checking for updates...');
          const checkResult = await autoUpdater.checkForUpdates();

          if (!checkResult || !checkResult.updateInfo) {
            console.log('[Updater] No update available for', versionType);
            isDownloadingUpdate = false; // 重置状态
            return createSuccessResponse({
              hasUpdate: false,
              message: `No ${versionType} update available`,
              versionType,
              version: null,
              reason: 'no-update'
            });
          }

          // 检查版本是否被忽略
          const isIgnored = await isVersionIgnored(checkResult.updateInfo.version);
          if (isIgnored) {
            console.log('[Updater] Version is ignored:', checkResult.updateInfo.version);
            isDownloadingUpdate = false; // 重置状态
            return createSuccessResponse({
              hasUpdate: false,
              message: `Version ${checkResult.updateInfo.version} is ignored`,
              versionType,
              version: checkResult.updateInfo.version,
              reason: 'ignored'
            });
          }

          // 4. 立即开始下载
          console.log('[Updater] Starting download for version:', checkResult.updateInfo.version);
          // 注意：isDownloadingUpdate 已在函数开始时设置

          // 由于 autoDownload = false，必须手动调用 downloadUpdate()
          // 注意：不要 await downloadUpdate()，因为它会等到下载完成
          // 我们只需要启动下载，然后立即返回，避免超时问题
          try {
            // 启动下载（不等待完成）
            autoUpdater.downloadUpdate().catch(downloadError => {
              console.error('[Updater] Download failed:', downloadError);
              isDownloadingUpdate = false;
              // 发送错误事件到前端
              if (ctx.mainWindow && !ctx.mainWindow.isDestroyed()) {
                ctx.mainWindow.webContents.send(IPC_EVENTS.UPDATE_ERROR, {
                  message: downloadError.message || 'Download failed',
                  error: downloadError,
                  timestamp: new Date().toISOString()
                });
              }
            });
            console.log('[Updater] Download started successfully');

            // 立即发送下载开始事件到前端，确保UI状态同步
            if (ctx.mainWindow && !ctx.mainWindow.isDestroyed()) {
              ctx.mainWindow.webContents.send(IPC_EVENTS.UPDATE_DOWNLOAD_STARTED, {
                versionType,
                version: checkResult.updateInfo.version,
                timestamp: new Date().toISOString()
              });
            }
          } catch (downloadError) {
            console.error('[Updater] Failed to start download:', downloadError);
            isDownloadingUpdate = false;
            throw downloadError;
          }

          return createSuccessResponse({
            hasUpdate: true,
            updateInfo: checkResult.updateInfo,
            versionType,
            message: `Started downloading ${versionType} version ${checkResult.updateInfo.version}`
          });

        } finally {
          // 5. 确保恢复原始配置（偏好设置和autoUpdater实例）
          try {
            // 恢复偏好设置
            await ctx.preferenceService.set(PREFERENCE_KEYS.ALLOW_PRERELEASE, originalPreference);
            console.log('[Updater] Restored preference to:', originalPreference);

            // 恢复autoUpdater实例配置
            autoUpdater.allowPrerelease = originalAutoUpdaterConfig.allowPrerelease;
            autoUpdater.allowDowngrade = originalAutoUpdaterConfig.allowDowngrade;
            console.log('[Updater] Restored autoUpdater config to:', originalAutoUpdaterConfig);
          } catch (restoreError) {
            console.error('[Updater] Failed to restore configuration:', restoreError);
          }
        }

      } catch (error) {
        console.error('[Updater] Atomic download failed:', error);
        // 确保下载状态被重置
        if (isDownloadingUpdate) {
          isDownloadingUpdate = false;
        }
        return createDetailedErrorResponse(error);
      }
    });

    console.log('[Main Process] Auto-update handlers ready.');
  }

  return { setupUpdateHandlers };
}

module.exports = {
  createUpdateHandlers,
};
