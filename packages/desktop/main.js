/*
 * Prompt Optimizer - AI提示词优化工具
 * Copyright (C) 2025 linshenkx
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, version 3 of the License.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

// 在所有其他模块之前初始化日志系统
const ConsoleLogger = require('./config/console-logger');
const consoleLogger = new ConsoleLogger();

// 立即设置全局错误处理器，确保任何异常都能被记录
consoleLogger.setupGlobalErrorHandlers();

const { app, BrowserWindow, ipcMain, shell, session, Menu, nativeImage } = require('electron');
const { autoUpdater } = require('electron-updater');
const {
  buildReleaseUrl,
  validateVersion,
  getRepositoryInfo,
  IPC_EVENTS,
  PREFERENCE_KEYS,
  DEFAULT_CONFIG
} = require('./config/update-config');
const { createGlobalDispatcherFromProxyDecision } = require('./config/proxy-dispatcher');
const {
  buildAppMenuTemplate,
  getPageZoomShortcutAction,
} = require('./config/app-menu');
const {
  DEFAULT_PAGE_ZOOM_LEVEL,
  VISUAL_ZOOM_LIMITS,
  applyPageZoomAction,
  getPageZoomActionFromDirection,
} = require('./config/page-zoom');
const { getPublicRuntimeConfig } = require('./config/runtime-security');
const { installMainFrameNavigationGuard, isSafeExternalUrl } = require('./config/window-security');
const {
  createIpcError,
  registerSecureIpcHandler,
} = require('./config/ipc-security');
const { createStreamRegistry } = require('./config/stream-registry');
const { createOwnedStreamRunner } = require('./config/ipc/owned-stream-runner');
const { registerLlmIpcHandlers } = require('./config/ipc/llm-handlers');
const { registerPromptStreamIpcHandlers } = require('./config/ipc/prompt-stream-handlers');
const { registerModelIpcHandlers } = require('./config/ipc/model-handlers');
const { registerImageIpcHandlers } = require('./config/ipc/image-handlers');
const { registerTemplateIpcHandlers } = require('./config/ipc/template-handlers');
const { registerHistoryIpcHandlers } = require('./config/ipc/history-handlers');
const { registerFavoriteIpcHandlers } = require('./config/ipc/favorite-handlers');
const { registerContextIpcHandlers } = require('./config/ipc/context-handlers');
const { registerDataIpcHandlers } = require('./config/ipc/data-handlers');
const { registerPromptSyncIpcHandlers } = require('./config/ipc/prompt-sync-handlers');
const { registerPreferenceIpcHandlers } = require('./config/ipc/preference-handlers');
const { registerSystemIpcHandlers } = require('./config/ipc/system-handlers');
const { createUpdateHandlers } = require('./config/ipc/update-handlers');
const { setupRemoteStorageHandlers } = require('./remote-storage');
const path = require('path');

const streamRegistry = createStreamRegistry();

function getIpcSenderOptions() {
  return {
    isDevelopment: process.env.NODE_ENV === 'development',
    packagedRoot: path.join(__dirname, 'web-dist'),
    devServerUrl: 'http://localhost:18181',
  };
}

// 确定正确的配置文件路径
// 在生产环境中，优先从exe所在目录查找.env.local文件
let envLocalPath;
if (app.isPackaged) {
  // 生产环境：exe所在目录
  envLocalPath = path.join(process.resourcesPath, '..', '.env.local');
} else {
  // 开发环境：项目根目录
  envLocalPath = path.resolve(__dirname, '../../.env.local');
}

const envPath = path.join(__dirname, '.env');

// 加载环境变量
require('dotenv').config({ path: envLocalPath });
require('dotenv').config({ path: envPath });

const {
  PreferenceService,
  createModelManager,
  createTemplateManager,
  createHistoryManager,
  createLLMService,
  createPromptService,
  createImageUnderstandingService,
  createImageModelManager,
  createImageAdapterRegistry,
  createImageService,
  createTemplateLanguageService,
  createDataManager,
  createContextRepo,
  FavoriteManager,
  FileStorageProvider,
  runStorageStartupSafetyCheck,
  writeStartupRepairReport,
  // 导入共享的环境变量扫描常量
  CUSTOM_API_PATTERN,
  SUFFIX_PATTERN,
  MAX_SUFFIX_LENGTH,
} = require('@prompt-optimizer/core');

/**
 * 安全序列化函数，用于清理Vue响应式对象
 * 确保所有通过IPC传递的对象都是纯净的JavaScript对象
 *
 * 这个函数解决的是IPC序列化问题，与存储层的数据一致性问题是不同的：
 * - IPC问题：Vue响应式对象无法被Electron序列化传递
 * - 存储问题：FileStorageProvider的数据一致性和恢复机制
 */
function safeSerialize(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // 对于基本类型，直接返回
  if (typeof obj !== 'object') {
    return obj;
  }

  try {
    return JSON.parse(JSON.stringify(obj));
  } catch (error) {
    console.error('[IPC Serialization] Failed to serialize object:', error);
    throw new Error(`Failed to serialize object for IPC: ${error.message}`);
  }
}

async function convertImageInputWithElectronNativeImage(input) {
  try {
    if (!input || typeof input.b64 !== 'string' || !input.b64.trim()) {
      return null;
    }

    const mimeType = typeof input.mimeType === 'string' && input.mimeType.trim()
      ? input.mimeType.trim()
      : 'application/octet-stream';
    const source = input.b64.startsWith('data:')
      ? input.b64
      : `data:${mimeType};base64,${input.b64}`;
    const image = nativeImage.createFromDataURL(source);
    if (image.isEmpty()) {
      return null;
    }

    const pngBuffer = image.toPNG();
    if (!pngBuffer || pngBuffer.length === 0) {
      return null;
    }

    return {
      b64: pngBuffer.toString('base64'),
      mimeType: 'image/png'
    };
  } catch {
    return null;
  }
}

let mainWindow;
let modelManager, templateManager, historyManager, llmService, promptService, templateLanguageService, preferenceService, dataManager, contextRepo, favoriteManager;
let imageModelManager, imageService, imageUnderstandingService;
let imageAdapterRegistry; // 全局引用以供 IPC 处理器使用
let storageProvider; // 全局存储提供器引用，用于退出时保存数据

// UI 当前语言（由渲染进程 i18n 选择决定）。
// 说明：Electron 默认不会为输入框提供浏览器那种右键编辑菜单，
// 我们在主进程中自行弹出菜单，并用该 locale 来决定菜单文案。
let uiLocale = null;

const SUPPORTED_UI_LOCALES = new Set(['zh-CN', 'zh-TW', 'en-US']);

function normalizeUiLocale(locale) {
  if (typeof locale !== 'string' || !locale) return null;
  if (SUPPORTED_UI_LOCALES.has(locale)) return locale;

  const lower = locale.toLowerCase();
  if (lower.startsWith('zh')) {
    // Covers: zh-TW / zh-HK / zh-Hant, etc.
    if (lower.includes('tw') || lower.includes('hk') || lower.includes('hant')) return 'zh-TW';
    return 'zh-CN';
  }
  if (lower.startsWith('en')) return 'en-US';
  return null;
}

function getCurrentUiLocale() {
  const fromUi = normalizeUiLocale(uiLocale);
  if (fromUi) return fromUi;

  try {
    const fromSystem = typeof app.getLocale === 'function' ? app.getLocale() : null;
    return normalizeUiLocale(fromSystem) || 'en-US';
  } catch (_e) {
    return 'en-US';
  }
}

const CONTEXT_MENU_LABELS = {
  'zh-CN': {
    undo: '撤销',
    redo: '重做',
    cut: '剪切',
    copy: '复制',
    paste: '粘贴',
    selectAll: '全选',
  },
  'zh-TW': {
    undo: '復原',
    redo: '重做',
    cut: '剪下',
    copy: '複製',
    paste: '貼上',
    selectAll: '全選',
  },
  'en-US': {
    undo: 'Undo',
    redo: 'Redo',
    cut: 'Cut',
    copy: 'Copy',
    paste: 'Paste',
    selectAll: 'Select All',
  },
};

function getContextMenuLabels(locale) {
  const normalized = normalizeUiLocale(locale) || 'en-US';
  return CONTEXT_MENU_LABELS[normalized] || CONTEXT_MENU_LABELS['en-US'];
}
let isQuitting = false; // 防止重复保存数据的标志
let isUpdaterQuitting = false; // 标识是否为更新安装退出，跳过数据保存
let forceQuitTimer = null; // 强制退出定时器
const MAX_SAVE_TIME = 5000; // 最大保存时间：5秒
let emergencyExitTimer = null; // 应急退出定时器
const EMERGENCY_EXIT_TIME = 10000; // 应急退出时间：10秒

// 应急退出机制：无论如何都要在10秒内退出
function setupEmergencyExit() {
  if (emergencyExitTimer) {
    clearTimeout(emergencyExitTimer);
  }

  emergencyExitTimer = setTimeout(() => {
    console.error('[DESKTOP] EMERGENCY EXIT: Force terminating process after 10 seconds');
    process.exit(1); // 强制终止进程
  }, EMERGENCY_EXIT_TIME);
}

// === System Proxy → Undici Global Dispatcher (A1 方案) ===
// 说明：在主进程中尽量早地设置 undici 全局代理分发器，使 Node/SDK 请求复用系统代理。
// 安全：任意步骤失败将优雅跳过，绝不影响启动流程。
async function setupGlobalProxyDispatcherFromSystem() {
  // 动态加载 undici，兼容不同 Node/Electron 版本
  let undici;
  try {
    try {
      undici = require('undici');
    } catch (_) {
      undici = require('node:undici');
    }
  } catch (e) {
    console.log('[Proxy] undici 不可用，跳过全局代理设置');
    return; // 无 undici 时直接跳过，不影响启动
  }

  const { setGlobalDispatcher, ProxyAgent, Agent } = undici || {};
  if (!setGlobalDispatcher || !ProxyAgent) {
    console.log('[Proxy] undici 不支持 setGlobalDispatcher/ProxyAgent，跳过');
    return;
  }

  // 解析 Electron 系统代理（包含 PAC/WPAD）
  // 选择常见外网目标进行解析；解析失败则回退为直连。
  let proxyDecision = 'DIRECT';
  let rawResolve = 'DIRECT';
  try {
    // 确保 session 可用（需在 app ready 之后调用）
    const targetUrl = 'https://www.example.com';
    const result = await session.defaultSession.resolveProxy(targetUrl);
    // result 形如："PROXY host:port; SOCKS5 host:port; DIRECT"
    rawResolve = result || 'DIRECT';
    proxyDecision = rawResolve.split(';')[0].trim();
  } catch (e) {
    console.log('[Proxy] 解析系统代理失败，使用直连:', e && e.message);
    proxyDecision = 'DIRECT';
  }

  // 将代理决策映射为 undici 的代理 URL
  // 支持：PROXY/HTTPS/SOCKS/SOCKS5/DIRECT
  let mappedProxyUrl = 'DIRECT';
  try {
    const { dispatcher, mappedProxyUrl: resolvedProxyUrl } = createGlobalDispatcherFromProxyDecision({
      Agent,
      ProxyAgent,
      proxyDecision
    });
    mappedProxyUrl = resolvedProxyUrl;
    setGlobalDispatcher(dispatcher);
    // 基础日志（始终输出）
    console.log('[Proxy] 系统代理解析结果(raw):', rawResolve);
    console.log('[Proxy] 选用决策(decision):', proxyDecision);
    console.log('[Proxy] undici 全局代理:', mappedProxyUrl);
    if (mappedProxyUrl !== 'DIRECT') {
      console.log('[Proxy] localhost / 局域网 / 私网地址将绕过代理直连');
    }

    // 诊断信息（仅在环境变量开启时输出）
    const debug = process.env.DEBUG_PROXY === '1' || process.env.PROXY_DEBUG === '1';
    if (debug) {
      console.log('[Proxy][DEBUG] 环境变量: HTTPS_PROXY=', process.env.HTTPS_PROXY || '');
      console.log('[Proxy][DEBUG] 环境变量: HTTP_PROXY =', process.env.HTTP_PROXY || '');
      console.log('[Proxy][DEBUG] 环境变量: NO_PROXY   =', process.env.NO_PROXY || '');
      console.log('[Proxy][DEBUG] Node/Electron 版本:', {
        node: process.versions.node,
        electron: process.versions.electron,
        chrome: process.versions.chrome
      });
    }
  } catch (e) {
    console.log('[Proxy] 设置全局代理分发器失败，使用直连:', e && e.message);
    try {
      const { Agent } = undici;
      if (Agent) setGlobalDispatcher(new Agent());
    } catch (_) { /* no-op */ }
  }
}

async function initializePreferenceService(storageProvider) {
  console.log('[DESKTOP] Initializing PreferenceService with the provided storage provider...');
  preferenceService = new PreferenceService(storageProvider);
  console.log('[DESKTOP] PreferenceService initialized.');
}

function setupPreferenceHandlers() {
  // 将偏好设置 IPC 委托给独立后端 module。
  registerPreferenceIpcHandlers({
    ipcMain,
    preferenceService,
    safeSerialize,
    createSuccessResponse,
    createErrorResponse,
  });
}

// 构建注入到渲染进程的公共运行时配置脚本（双份键：带前缀与不带前缀）。
function buildRuntimeConfigScriptFromEnv() {
  try {
    const publicConfig = getPublicRuntimeConfig(process.env);

    return `// Injected by Electron main process\n`
      + `window.runtime_config = Object.assign({}, (window.runtime_config || {}), ${JSON.stringify(publicConfig)});\n`
      + `console.log('[Main Process] runtime_config injected with ${Object.keys(publicConfig).length / 2} public VITE_* vars (dual keys)');\n`;
  } catch (e) {
    return `console.warn('[Main Process] Failed to build runtime_config:', ${JSON.stringify(String(e))});`;
  }
}

function createWindow() {
  // Create the browser window.
  // 根据平台选择合适的图标文件
  let iconPath;
  if (process.platform === 'win32') {
    iconPath = path.join(__dirname, 'icons', 'app-icon.ico');
  } else if (process.platform === 'darwin') {
    iconPath = path.join(__dirname, 'icons', 'app-icon.icns');
  } else {
    // Linux 和其他平台，优先使用高分辨率 PNG
    const linuxIcons = [
      path.join(__dirname, 'icons', '512x512.png'),
      path.join(__dirname, 'icons', '256x256.png'),
      path.join(__dirname, 'icons', 'app-icon.png')
    ];
    iconPath = linuxIcons.find(icon => require('fs').existsSync(icon)) || linuxIcons[2];
  }

  // 检查图标文件是否存在
  if (require('fs').existsSync(iconPath)) {
    console.log('[Main Process] Using icon:', iconPath);
  } else {
    console.warn('[Main Process] Icon file not found:', iconPath);
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: iconPath, // 设置窗口图标
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  installMainFrameNavigationGuard(mainWindow.webContents, {
    isDevelopment: process.env.NODE_ENV === 'development',
    packagedRoot: path.join(__dirname, 'web-dist'),
    devServerUrl: 'http://localhost:18181',
    openExternal: (url) => shell.openExternal(url),
  });

  const handlePageZoomAction = (action, targetWebContents = mainWindow?.webContents) => {
    applyPageZoomAction(targetWebContents, action);
  };

  Menu.setApplicationMenu(
    Menu.buildFromTemplate(
      buildAppMenuTemplate({
        isMac: process.platform === 'darwin',
        onPageZoomAction: handlePageZoomAction,
      })
    )
  );
  mainWindow.webContents.setZoomLevel(DEFAULT_PAGE_ZOOM_LEVEL);
  void mainWindow.webContents
    .setVisualZoomLevelLimits(VISUAL_ZOOM_LIMITS.minimum, VISUAL_ZOOM_LIMITS.maximum)
    .catch((error) => {
      console.warn('[Main Process] Failed to keep visual zoom locked:', error);
    });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    const action = getPageZoomShortcutAction(input);
    if (!action) return;

    event.preventDefault();
    handlePageZoomAction(action);
  });

  // Keep pinch zoom disabled so keyboard/menu reset stays authoritative.
  // Wheel-based page zoom still arrives through Electron's zoom-changed event.
  mainWindow.webContents.on('zoom-changed', (_event, zoomDirection) => {
    const action = getPageZoomActionFromDirection(zoomDirection);
    if (!action) return;
    handlePageZoomAction(action);
  });

  // Enable native-like context menu for text inputs (cut/copy/paste/selectAll).
  // Electron doesn't provide this by default, which makes right-click paste
  // unavailable on Windows.
  mainWindow.webContents.on('context-menu', (_event, params) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    const isEditable = Boolean(params.isEditable);
    const selectionText = typeof params.selectionText === 'string' ? params.selectionText : '';
    const hasSelection = selectionText.trim().length > 0;

    const labels = getContextMenuLabels(getCurrentUiLocale());

    // Avoid showing an empty menu on right-click.
    if (!isEditable && !hasSelection) return;

    const editFlags = params.editFlags || {};

    const template = isEditable
      ? [
          { label: labels.undo, role: 'undo', enabled: Boolean(editFlags.canUndo) },
          { label: labels.redo, role: 'redo', enabled: Boolean(editFlags.canRedo) },
          { type: 'separator' },
          { label: labels.cut, role: 'cut', enabled: Boolean(editFlags.canCut) },
          { label: labels.copy, role: 'copy', enabled: Boolean(editFlags.canCopy) },
          { label: labels.paste, role: 'paste', enabled: Boolean(editFlags.canPaste) },
          { type: 'separator' },
          { label: labels.selectAll, role: 'selectAll', enabled: Boolean(editFlags.canSelectAll) },
        ]
      : [
          { label: labels.copy, role: 'copy', enabled: hasSelection },
          { type: 'separator' },
          { label: labels.selectAll, role: 'selectAll' },
        ];

    const menu = Menu.buildFromTemplate(template);
    menu.popup({ window: mainWindow, x: params.x, y: params.y });
  });

  // In development, we can point to the vite dev server
  if (process.env.NODE_ENV === 'development') {
    console.log('[Main Process] Running in development mode, loading from Vite dev server');
    mainWindow.loadURL('http://localhost:18181');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built file from the web package
    const webDistPath = path.join(__dirname, 'web-dist/index.html');
    console.log('[Main Process] Loading web app from:', webDistPath);
    if (require('fs').existsSync(webDistPath)) {
      mainWindow.loadFile(webDistPath);
    } else {
      console.error('[Main Process] Web dist not found at:', webDistPath);
      console.error('[Main Process] Please run: pnpm run build:web and ensure it is copied to the desktop package.');
    }
  }

  // 窗口关闭前保存数据
  mainWindow.on('close', async (event) => {
    // 如果是更新安装退出，直接关闭窗口，不保存数据
    if (isUpdaterQuitting) {
      console.log('[DESKTOP] Updater quit detected, skipping data save');
      return;
    }

    if (!isQuitting && storageProvider && typeof storageProvider.flush === 'function') {
      event.preventDefault(); // 阻止立即关闭
      isQuitting = true; // 设置退出标志

      // 启动应急退出机制
      setupEmergencyExit();

      // 设置强制退出定时器，确保程序不会卡住
      forceQuitTimer = setTimeout(() => {
        console.warn('[DESKTOP] Force closing window due to timeout');
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.destroy();
        }
      }, MAX_SAVE_TIME);

      try {
        console.log('[DESKTOP] Saving data before window close...');
        await Promise.race([
          storageProvider.flush(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Save timeout')), MAX_SAVE_TIME - 1000)
          )
        ]);
        console.log('[DESKTOP] Data saved successfully');
      } catch (error) {
        console.error('[DESKTOP] Failed to save data before close:', error);
      } finally {
        if (forceQuitTimer) {
          clearTimeout(forceQuitTimer);
          forceQuitTimer = null;
        }
        if (emergencyExitTimer) {
          clearTimeout(emergencyExitTimer);
          emergencyExitTimer = null;
        }
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.destroy();
        }
      }
    }
  });

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object
    mainWindow = null;
  });
}

async function initializeServices() {
  try {
    console.log('[Main Process] Initializing core services...');
    
    // 设置环境变量，确保主进程能访问API密钥
    // 这些环境变量应该在启动桌面应用之前设置
    console.log('[Main Process] Checking environment variables...');

    // 静态环境变量
    const staticEnvVars = [
      'VITE_OPENAI_API_KEY',
      'VITE_GEMINI_API_KEY',
      'VITE_ANTHROPIC_API_KEY',
      'VITE_DEEPSEEK_API_KEY',
      'VITE_SILICONFLOW_API_KEY',
      'VITE_ZHIPU_API_KEY',
      'VITE_DASHSCOPE_API_KEY',
      'VITE_OPENROUTER_API_KEY',
      'VITE_MODELSCOPE_API_KEY',
      'VITE_CUSTOM_API_KEY',
      'VITE_CUSTOM_API_BASE_URL',
      'VITE_CUSTOM_API_MODEL',
      'VITE_CUSTOM_API_PARAMS',
      'VITE_CUSTOM_API_HEADERS'
    ];

    // 扫描动态自定义模型环境变量
    // 使用统一的正则表达式模式和验证规则

    const dynamicEnvVars = Object.keys(process.env).filter(key => {
      const match = key.match(CUSTOM_API_PATTERN);
      if (!match) return false;

      const [, , suffix] = match;
      return suffix && suffix.length <= MAX_SUFFIX_LENGTH && SUFFIX_PATTERN.test(suffix);
    });

    const allEnvVars = [...staticEnvVars, ...dynamicEnvVars];

    let hasApiKeys = false;
    allEnvVars.forEach(envVar => {
      const value = process.env[envVar];
      if (value) {
        console.log(`[Main Process] Found ${envVar}: [CONFIGURED]`);
        hasApiKeys = true;
      } else {
        console.log(`[Main Process] Missing ${envVar}`);
      }
    });

    if (dynamicEnvVars.length > 0) {
      console.log(`[Main Process] Found ${dynamicEnvVars.length} dynamic custom model environment variables`);
    }
    
    if (!hasApiKeys) {
      console.warn('[Main Process] No API keys found in environment variables.');
      console.warn('[Main Process] Please set environment variables before starting the desktop app.');
      console.warn('[Main Process] Examples:');
      console.warn('[Main Process]   VITE_OPENAI_API_KEY=your_key_here npm start');
      console.warn('[Main Process]   VITE_CUSTOM_API_KEY_qwen3=your_qwen_key npm start');
      console.warn('[Main Process]   VITE_CUSTOM_API_KEY_claude=your_claude_key npm start');
    }
    
    console.log('[DESKTOP] Creating file storage provider for desktop environment');

    // 使用标准用户数据目录，支持自动更新
    const userDataPath = app.getPath('userData');
    console.log('[DESKTOP] Using standard user data directory for auto-update compatibility:', userDataPath);
    storageProvider = new FileStorageProvider(userDataPath);
    const startupRepairReport = await runStorageStartupSafetyCheck(storageProvider);
    await writeStartupRepairReport(storageProvider, startupRepairReport);
    
    await initializePreferenceService(storageProvider);
    
    console.log('[DESKTOP] Creating model manager...');
    modelManager = createModelManager(storageProvider);
    
    console.log('[DESKTOP] Creating template language service...');
    templateLanguageService = createTemplateLanguageService(preferenceService);

    console.log('[DESKTOP] Initializing template language service...');
    await templateLanguageService.initialize();

    console.log('[DESKTOP] Creating template manager...');
    templateManager = createTemplateManager(storageProvider, templateLanguageService);
    
    console.log('[DESKTOP] Creating history manager...');
    historyManager = createHistoryManager(storageProvider, modelManager);
    
    console.log('[DESKTOP] Initializing model manager...');
    await modelManager.ensureInitialized();
    // 图像模型管理器
    console.log('[DESKTOP] Creating image model manager...');
    imageAdapterRegistry = createImageAdapterRegistry();
    imageModelManager = createImageModelManager(storageProvider, imageAdapterRegistry);
    await imageModelManager.ensureInitialized();
    
    // 在创建任何网络相关服务前，先根据系统代理设置 undici 全局分发器
    await setupGlobalProxyDispatcherFromSystem();

    console.log('[DESKTOP] Creating LLM service...');
    llmService = createLLMService(modelManager);

    imageUnderstandingService = createImageUnderstandingService({
      imageInputConverter: convertImageInputWithElectronNativeImage,
    });

    console.log('[DESKTOP] Creating Prompt service...');
    promptService = createPromptService(
      modelManager,
      llmService,
      templateManager,
      historyManager,
      imageUnderstandingService,
    );
    console.log('[DESKTOP] Creating Image service...');
    imageService = createImageService(imageModelManager, imageAdapterRegistry, {
      imageInputConverter: convertImageInputWithElectronNativeImage,
    });
    
    console.log('[DESKTOP] Creating Context repository...');
    contextRepo = createContextRepo(storageProvider);

    console.log('[DESKTOP] Creating Data manager...');
    dataManager = createDataManager(modelManager, templateManager, historyManager, preferenceService, contextRepo, imageModelManager);

    console.log('[DESKTOP] Creating Favorite manager...');
    favoriteManager = new FavoriteManager(storageProvider);
    
    console.log('[Main Process] Core services initialized successfully.');
    
    return true;
  } catch (error) {
    console.error('[Main Process] Failed to initialize core services:', error);
    console.error('[Main Process] Error details:', error.stack);
    return false;
  }
}

// --- IPC Response Helpers ---
function createSuccessResponse(data) {
  return { success: true, data };
}

function createErrorResponse(error) {
  console.error('[Main Process IPC Error]', error);
  // Always return a structured error payload so renderer can translate via `code + params`.
  // This is safe even for legacy callers because preload normalizes both string/object.
  return { success: false, error: normalizeIpcError(error) };
}

// Structured error payload for renderer-side i18n (code + params).
function normalizeIpcError(error) {
  const message = error instanceof Error ? error.message : String(error);

  const payload = { message };

  if (error && typeof error === 'object') {
    if (typeof error.code === 'string') {
      payload.code = error.code;
    }

    if (error.params && typeof error.params === 'object') {
      try {
        payload.params = safeSerialize(error.params);
      } catch (_) {
        // Best-effort only; omit params if serialization fails.
      }
    }
  }

  return payload;
}

function createStructuredErrorResponse(error) {
  // Backward-compat: keep the helper name used by newer handlers.
  return createErrorResponse(error)
}

// 创建详细的错误响应，确保100%信息保真
function createDetailedErrorResponse(error) {
  const timestamp = new Date().toISOString();
  let detailedMessage = `[${timestamp}] Error Details:\n\n`;

  // 详细序列化错误信息
  if (error instanceof Error) {
    detailedMessage += `Message: ${error.message}\n`;

    if (error.name && error.name !== 'Error') {
      detailedMessage += `Type: ${error.name}\n`;
    }

    if (error.code) {
      detailedMessage += `Code: ${error.code}\n`;
    }

    if (error.statusCode) {
      detailedMessage += `HTTP Status: ${error.statusCode}\n`;
    }

    if (error.url) {
      detailedMessage += `URL: ${error.url}\n`;
    }

    if (error.stack) {
      detailedMessage += `\nStack Trace:\n${error.stack}\n`;
    }

    // 捕获其他可能的属性
    const otherProps = {};
    for (const key in error) {
      if (!['message', 'name', 'code', 'statusCode', 'url', 'stack'].includes(key)) {
        try {
          otherProps[key] = error[key];
        } catch (e) {
          otherProps[key] = `[Cannot serialize: ${e.message}]`;
        }
      }
    }

    if (Object.keys(otherProps).length > 0) {
      detailedMessage += `\nAdditional Properties:\n${JSON.stringify(otherProps, null, 2)}\n`;
    }
  } else {
    // 非 Error 对象的处理
    detailedMessage += `Value: ${String(error)}\n`;
    detailedMessage += `Type: ${typeof error}\n`;
  }

  // 兜底：完整的 JSON 序列化
  try {
    const jsonError = JSON.stringify(error, Object.getOwnPropertyNames(error), 2);
    if (jsonError && jsonError !== '{}' && jsonError !== 'null') {
      detailedMessage += `\nComplete Object Dump:\n${jsonError}`;
    }
  } catch (jsonError) {
    detailedMessage += `\nJSON Serialization Failed: ${jsonError.message}`;
  }

  // 同时在控制台输出详细信息
  console.error('[Detailed Error Info]', detailedMessage);

  return { success: false, error: detailedMessage };
}

// --- High-Level IPC Service Handlers ---
// 自动更新 handlers 依赖 main 可变状态，通过 getter/setter 注入。
const { setupUpdateHandlers } = createUpdateHandlers({
  get preferenceService() { return preferenceService; },
  get mainWindow() { return mainWindow; },
  get isUpdaterQuitting() { return isUpdaterQuitting; },
  set isUpdaterQuitting(value) { isUpdaterQuitting = value; },
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
  getRepositoryInfo,
});

function setupIPC() {
  console.log('[Main Process] Setting up high-level service IPC handlers...');
  setupPreferenceHandlers();
  setupRemoteStorageHandlers(ipcMain, {
    createSuccessResponse,
    createErrorResponse,
  });
  
  /** 注册需要可信 sender、参数校验和统一响应信封的 IPC handler。 */
  const registerSensitiveIpc = (channel, handler, validateArgs) => {
    registerSecureIpcHandler(ipcMain, channel, handler, {
      senderOptions: getIpcSenderOptions(),
      validateArgs,
      createSuccess: createSuccessResponse,
      createError: createErrorResponse,
    });
  };

  // 集中执行 sender 绑定流任务，确保结束、异常和取消都会清理注册表。
  const runOwnedStream = createOwnedStreamRunner({ streamRegistry });

  // 将 LLM 与取消通道注册委托给独立后端 module，main.js 只负责依赖装配。
  registerLlmIpcHandlers({
    registerSensitiveIpc,
    llmService,
    streamRegistry,
    runOwnedStream,
  });

  // 将 Prompt 流式通道注册委托给独立后端 module，保持现有 renderer interface 不变。
  registerPromptStreamIpcHandlers({
    registerSensitiveIpc,
    promptService,
    runOwnedStream,
  });

  // 将 Prompt 同步接口委托给独立后端 module；流式接口由 prompt-stream-handlers 负责。
  registerPromptSyncIpcHandlers({
    ipcMain,
    promptService,
    historyManager,
    createSuccessResponse,
    createErrorResponse,
  });

  // multimodal evaluation：图像理解走主进程，避免 renderer 直连供应商。
  ipcMain.handle('image-understanding-understand', async (_event, request) => {
    try {
      const result = await imageUnderstandingService.understand(safeSerialize(request));
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });


  // 在页面加载前拦截 /config.js 并注入运行时环境变量（双份键）
  try {
    const ses = (mainWindow && mainWindow.webContents && mainWindow.webContents.session) || session.defaultSession;
    if (ses && ses.webRequest && typeof ses.webRequest.onBeforeRequest === 'function') {
      const filter = { urls: ['*://*/*', 'file://*/*'] };
      ses.webRequest.onBeforeRequest(filter, (details, callback) => {
        if (/\/config\.js(\?.*)?$/i.test(details.url)) {
          const script = buildRuntimeConfigScriptFromEnv();
          const dataUrl = 'data:application/javascript;charset=utf-8,' + encodeURIComponent(script);
          return callback({ redirectURL: dataUrl });
        }
        return callback({});
      });
      console.log('[Main Process] Runtime config (config.js) interceptor registered');
    }
  } catch (e) {
    console.warn('[Main Process] Unable to register runtime config interceptor:', e);
  }

  // 将文本模型管理 IPC 委托给独立后端 module。
  registerModelIpcHandlers({
    ipcMain,
    modelManager,
    safeSerialize,
    createSuccessResponse,
    createErrorResponse,
  });

  // 将图像模型配置与图像生成 IPC 委托给独立后端 module。
  registerImageIpcHandlers({
    ipcMain,
    imageModelManager,
    imageService,
    imageAdapterRegistry,
    safeSerialize,
    createSuccessResponse,
    createErrorResponse,
    createStructuredErrorResponse,
  });

  // 将模板管理 IPC 委托给独立后端 module。
  registerTemplateIpcHandlers({
    ipcMain,
    templateManager,
    safeSerialize,
    createSuccessResponse,
    createErrorResponse,
  });

  // 将历史记录 IPC 委托给独立后端 module。
  registerHistoryIpcHandlers({
    ipcMain,
    historyManager,
    safeSerialize,
    createSuccessResponse,
    createErrorResponse,
  });

  // 将会话上下文 IPC 委托给独立后端 module。
  registerContextIpcHandlers({
    ipcMain,
    contextRepo,
    safeSerialize,
    createSuccessResponse,
    createErrorResponse,
  });

  // 将收藏管理 IPC 委托给独立后端 module。
  registerFavoriteIpcHandlers({
    ipcMain,
    favoriteManager,
    safeSerialize,
    createSuccessResponse,
  });

  // 将数据导入导出与本地存储信息 IPC 委托给独立后端 module。
  registerDataIpcHandlers({
    ipcMain,
    dataManager,
    app,
    shell,
    createSuccessResponse,
    createErrorResponse,
  });

  // 将运行时配置、外链、应用信息与日志 IPC 委托给独立后端 module。
  registerSystemIpcHandlers({
    ipcMain,
    shell,
    consoleLogger,
    registerSensitiveIpc,
    getPublicRuntimeConfig,
    isSafeExternalUrl,
    createIpcError,
    createSuccessResponse,
    createErrorResponse,
    setUiLocale: (locale) => {
      uiLocale = locale;
    },
    normalizeUiLocale,
  });

  // 自动更新相关处理器
  setupUpdateHandlers();

  console.log('[Main Process] High-level service IPC handlers ready.');
}

// This method is called when Electron has finished initialization.
app.whenReady().then(async () => {
  const servicesInitialized = await initializeServices();
  if (servicesInitialized) {
    // 必须先设置IPC监听器，再创建窗口
    // 以防止窗口中的代码在监听器准备好之前就发送IPC消息
    setupIPC();
    createWindow();
  } else {
    console.error('[Main Process] Failed to start application due to service initialization failure.');
    // Optionally, show a dialog to the user
    // dialog.showErrorBox('Application Error', 'Could not initialize critical services.');
    app.quit();
  }

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 进程信号处理器 - 最后的保障
process.on('SIGINT', () => {
  console.log('[DESKTOP] Received SIGINT, forcing exit...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('[DESKTOP] Received SIGTERM, forcing exit...');
  process.exit(0);
});

// 全局异常处理已在 console-logger 中设置

// 应用退出前保存数据
app.on('before-quit', async (event) => {
  // 如果是更新安装退出，直接退出，不保存数据
  if (isUpdaterQuitting) {
    console.log('[DESKTOP] Updater quit detected, allowing immediate quit');
    return;
  }

  if (!isQuitting && storageProvider && typeof storageProvider.flush === 'function') {
    event.preventDefault(); // 阻止立即退出
    isQuitting = true; // 设置退出标志

    // 启动应急退出机制
    setupEmergencyExit();

    // 设置强制退出定时器，确保应用不会卡住
    const forceAppQuitTimer = setTimeout(() => {
      console.warn('[DESKTOP] Force quitting app due to timeout');
      process.exit(0); // 强制退出进程
    }, MAX_SAVE_TIME);

    try {
      console.log('[DESKTOP] Saving data before quit...');
      await Promise.race([
        storageProvider.flush(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Save timeout')), MAX_SAVE_TIME - 1000)
        )
      ]);
      console.log('[DESKTOP] Data saved successfully');
    } catch (error) {
      console.error('[DESKTOP] Failed to save data before quit:', error);
    } finally {
      clearTimeout(forceAppQuitTimer);
      if (emergencyExitTimer) {
        clearTimeout(emergencyExitTimer);
        emergencyExitTimer = null;
      }
      // 使用setImmediate确保在下一个事件循环中退出
      setImmediate(() => {
        isQuitting = false; // 重置标志以允许正常退出
        app.quit(); // 手动退出
      });
    }
  }
});

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

