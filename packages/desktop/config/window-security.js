const path = require('path');
const { fileURLToPath } = require('url');

/** 仅允许具备主机名的 HTTP/HTTPS 地址交给系统浏览器。 */
function isSafeExternalUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && Boolean(url.hostname);
  } catch {
    return false;
  }
}

/** 判断候选文件路径是否位于指定应用根目录内。 */
function isPathWithin(candidatePath, rootPath) {
  const candidate = path.resolve(candidatePath);
  const root = path.resolve(rootPath);
  return candidate === root || candidate.startsWith(`${root}${path.sep}`);
}

/** 校验主 frame 导航是否属于当前开发源或打包应用目录。 */
function isAllowedMainFrameNavigation(targetUrl, options) {
  try {
    const url = new URL(targetUrl);
    if (options.isDevelopment) {
      return url.origin === new URL(options.devServerUrl).origin;
    }

    return url.protocol === 'file:'
      && isPathWithin(fileURLToPath(url), options.packagedRoot);
  } catch {
    return false;
  }
}

/** 安装顶层导航、新窗口和 webview 的统一 Electron 安全门禁。 */
function installMainFrameNavigationGuard(webContents, options) {
  /** 将通过协议校验的外部地址交给系统浏览器，并隔离打开失败。 */
  const openExternal = (url) => {
    if (!isSafeExternalUrl(url)) {
      return;
    }

    void Promise.resolve(options.openExternal(url)).catch(() => {});
  };

  webContents.on('will-navigate', (event, targetUrl) => {
    if (isAllowedMainFrameNavigation(targetUrl, options)) {
      return;
    }

    event.preventDefault();
    openExternal(targetUrl);
  });

  webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: 'deny' };
  });

  webContents.on('will-attach-webview', (event) => {
    event.preventDefault();
  });
}

module.exports = {
  installMainFrameNavigationGuard,
  isAllowedMainFrameNavigation,
  isSafeExternalUrl,
};
