const DIALOG_COPY = {
  'zh-CN': {
    buttons: ['打开数据目录', '退出'],
    directoryLabel: '数据目录',
    openDirectoryFailedTitle: '无法打开数据目录',
    openDirectoryFailedMessage: '请手动打开以下数据目录排查：',
    wal: {
      title: '当前目录不支持桌面存储',
      message: '当前数据目录所在磁盘或文件系统不支持 SQLite WAL 模式，应用已暂停启动。',
      detail: '原数据文件未被改动。请将数据目录移至支持文件锁的本地磁盘目录后重试。',
    },
    storage: {
      title: '桌面存储初始化失败',
      message: '无法打开或迁移桌面数据存储，为保护现有数据，应用已暂停启动。',
      detail: '现有数据文件未被覆盖或删除。请打开数据目录检查文件权限或数据完整性，或查看应用日志后重试。',
    },
    services: {
      title: '桌面服务启动失败',
      message: '桌面数据存储已就绪，但初始化应用服务时发生错误，应用已取消启动。',
      detail: '已提交的业务数据均已安全保留。请查看应用日志或打开数据目录排查配置后重试。',
    },
  },
  'zh-TW': {
    buttons: ['開啟資料目錄', '結束'],
    directoryLabel: '資料目錄',
    openDirectoryFailedTitle: '無法開啟資料目錄',
    openDirectoryFailedMessage: '請手動開啟以下資料目錄排查：',
    wal: {
      title: '目前目錄不支援桌面儲存',
      message: '目前資料目錄所在磁碟或檔案系統不支援 SQLite WAL 模式，應用程式已暫停啟動。',
      detail: '原資料檔案未被改動。請將資料目錄移至支援檔案鎖定的本機磁碟目錄後重試。',
    },
    storage: {
      title: '桌面儲存初始化失敗',
      message: '無法開啟或遷移桌面資料儲存，為保護現有資料，應用程式已暫停啟動。',
      detail: '現有資料檔案未被覆寫或刪除。請開啟資料目錄檢查檔案權限或資料完整性，或查看應用程式日誌後重試。',
    },
    services: {
      title: '桌面服務啟動失敗',
      message: '桌面資料儲存已就緒，但初始化應用程式服務時發生錯誤，應用程式已取消啟動。',
      detail: '已提交的業務資料均已安全保留。請查看應用程式日誌或開啟資料目錄排查設定後重試。',
    },
  },
  'en-US': {
    buttons: ['Open Data Directory', 'Quit'],
    directoryLabel: 'Data directory',
    openDirectoryFailedTitle: 'Could not open data directory',
    openDirectoryFailedMessage: 'Open this data directory manually:',
    wal: {
      title: 'Desktop storage unsupported in this directory',
      message: 'The filesystem for your data directory does not support SQLite WAL mode, so startup was paused.',
      detail: 'Your data files were not modified. Move the data directory to a local disk volume that supports file locking and try again.',
    },
    storage: {
      title: 'Desktop storage initialization failed',
      message: 'The desktop data store could not be opened or migrated, so startup was paused to protect your data.',
      detail: 'Existing data files were not overwritten or deleted. Open the data directory to check file permissions and integrity, or inspect the logs, then try again.',
    },
    services: {
      title: 'Desktop service initialization failed',
      message: 'The desktop storage opened successfully, but initializing application services failed.',
      detail: 'Committed data remains intact. Check the application logs or open the data directory to inspect configuration files before restarting.',
    },
  },
};

function resolveLocale(locale) {
  return Object.prototype.hasOwnProperty.call(DIALOG_COPY, locale) ? locale : 'en-US';
}

function buildStorageStartupErrorDialog({
  error,
  locale = 'en-US',
  userDataPath = '',
  stage = 'storage',
  walUnsupportedReason = 'DESKTOP_STORAGE_WAL_UNSUPPORTED',
} = {}) {
  const copy = DIALOG_COPY[resolveLocale(locale)];
  const reason = error?.params?.reason;
  const category = stage === 'services'
    ? 'services'
    : reason === walUnsupportedReason
      ? 'wal'
      : 'storage';
  const entry = copy[category];
  const detailParts = [entry.detail];
  if (typeof userDataPath === 'string' && userDataPath.trim()) {
    detailParts.push(`${copy.directoryLabel}: ${userDataPath.trim()}`);
  }
  return {
    type: 'error',
    title: entry.title,
    message: entry.message,
    detail: detailParts.join('\n\n'),
    buttons: copy.buttons,
    defaultId: 0,
    cancelId: 1,
    openDirectoryButtonIndex: 0,
    openDirectoryFailedTitle: copy.openDirectoryFailedTitle,
    openDirectoryFailedMessage: copy.openDirectoryFailedMessage,
  };
}

async function showStorageStartupErrorDialog({
  dialog,
  shell,
  error,
  locale = 'en-US',
  userDataPath = '',
  stage = 'storage',
  walUnsupportedReason = 'DESKTOP_STORAGE_WAL_UNSUPPORTED',
} = {}) {
  const config = buildStorageStartupErrorDialog({
    error,
    locale,
    userDataPath,
    stage,
    walUnsupportedReason,
  });
  const result = await dialog.showMessageBox({
    type: config.type,
    title: config.title,
    message: config.message,
    detail: config.detail,
    buttons: config.buttons,
    defaultId: config.defaultId,
    cancelId: config.cancelId,
    noLink: true,
  });
  if (result?.response === config.openDirectoryButtonIndex && typeof userDataPath === 'string' && userDataPath.trim()) {
    let openFailure = '';
    try {
      const outcome = await shell.openPath(userDataPath);
      if (typeof outcome === 'string' && outcome.trim()) {
        openFailure = outcome.trim();
      }
    } catch (openError) {
      openFailure = openError?.message ? String(openError.message) : String(openError || 'Unknown error');
    }
    if (openFailure) {
      dialog.showErrorBox(
        config.openDirectoryFailedTitle,
        `${config.openDirectoryFailedMessage}\n${userDataPath.trim()}\n\n(${openFailure})`,
      );
    }
  }
}

module.exports = { buildStorageStartupErrorDialog, showStorageStartupErrorDialog };
