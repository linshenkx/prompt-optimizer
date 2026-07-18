/**
 * Desktop IPC channel 轻量清单 + 协议元数据。
 * 契约测试与装配完整性检查使用；默认不在 runtime 强制校验（避免破坏兼容）。
 *
 * 维护约定：
 * 1. 新增 preload invoke channel 时同步更新本文件；
 * 2. 领域 module 拆分后，对应 channel 应能在 handlers 中找到；
 * 3. 流式事件名不在 invoke 清单内（由 stream 契约测试单独覆盖）；
 * 4. 需要运行时校验时调用 assertKnownInvokeChannel / getChannelMeta。
 */

const { IPC_EVENTS } = require('../constants');

/** 协议版本：破坏性 channel/信封变更时递增。 */
const IPC_PROTOCOL_VERSION = '1.1.0';

/** 统一响应信封形状（文档化，供测试与未来校验使用）。 */
const RESPONSE_ENVELOPE = Object.freeze({
  success: { type: 'boolean', required: true },
  data: { type: 'any', required: false },
  error: { type: 'string|object', required: false },
});

/** 文本模型管理 channel。 */
const MODEL_CHANNELS = Object.freeze([
  'model-getModels',
  'model-addModel',
  'model-updateModel',
  'model-deleteModel',
  'model-ensureInitialized',
  'model-isInitialized',
  'model-getAllModels',
  'model-getEnabledModels',
  'model-exportData',
  'model-importData',
  'model-getDataType',
  'model-validateData',
]);

/** 图像模型与图像生成 channel。 */
const IMAGE_CHANNELS = Object.freeze([
  'image-model-ensureInitialized',
  'image-model-isInitialized',
  'image-model-getAllConfigs',
  'image-model-getConfig',
  'image-model-addConfig',
  'image-model-updateConfig',
  'image-model-deleteConfig',
  'image-model-getEnabledConfigs',
  'image-model-exportData',
  'image-model-importData',
  'image-model-getDataType',
  'image-model-validateData',
  'image-generate',
  'image-generateText2Image',
  'image-generateImage2Image',
  'image-generateMultiImage',
  'image-validateRequest',
  'image-validateText2ImageRequest',
  'image-validateImage2ImageRequest',
  'image-validateMultiImageRequest',
  'image-testConnection',
  'image-getDynamicModels',
]);

/** 模板管理 channel。 */
const TEMPLATE_CHANNELS = Object.freeze([
  'template-getTemplates',
  'template-getTemplate',
  'template-createTemplate',
  'template-updateTemplate',
  'template-deleteTemplate',
  'template-listTemplatesByType',
  'template-exportTemplate',
  'template-importTemplate',
  'template-exportData',
  'template-importData',
  'template-getDataType',
  'template-validateData',
  'template-changeBuiltinTemplateLanguage',
  'template-getCurrentBuiltinTemplateLanguage',
  'template-getSupportedBuiltinTemplateLanguages',
  'template-getSupportedLanguages',
]);

/** 历史记录 channel。 */
const HISTORY_CHANNELS = Object.freeze([
  'history-getHistory',
  'history-addRecord',
  'history-deleteRecord',
  'history-clearHistory',
  'history-getIterationChain',
  'history-getAllChains',
  'history-getChain',
  'history-createNewChain',
  'history-addIteration',
  'history-deleteChain',
  'history-exportData',
  'history-importData',
  'history-getDataType',
  'history-validateData',
]);

/** 会话上下文 channel。 */
const CONTEXT_CHANNELS = Object.freeze([
  'context-list',
  'context-getCurrentId',
  'context-setCurrentId',
  'context-get',
  'context-create',
  'context-duplicate',
  'context-rename',
  'context-save',
  'context-update',
  'context-remove',
  'context-exportAll',
  'context-importAll',
  'context-exportData',
  'context-importData',
  'context-getDataType',
  'context-validateData',
]);

/** 收藏管理 channel。 */
const FAVORITE_CHANNELS = Object.freeze([
  'favorite-addFavorite',
  'favorite-getFavorites',
  'favorite-getFavorite',
  'favorite-updateFavorite',
  'favorite-setFavoritePromptAssetCurrentVersion',
  'favorite-deleteFavoritePromptAssetVersion',
  'favorite-deleteFavorite',
  'favorite-deleteFavorites',
  'favorite-incrementUseCount',
  'favorite-getCategories',
  'favorite-addCategory',
  'favorite-updateCategory',
  'favorite-deleteCategory',
  'favorite-getStats',
  'favorite-searchFavorites',
  'favorite-exportFavorites',
  'favorite-importFavorites',
  'favorite-getAllTags',
  'favorite-addTag',
  'favorite-renameTag',
  'favorite-mergeTags',
  'favorite-deleteTag',
  'favorite-reorderCategories',
  'favorite-getCategoryUsage',
  'favorite-ensureDefaultCategories',
]);

/** 数据管理 channel。 */
const DATA_CHANNELS = Object.freeze([
  'data-exportAllData',
  'data-importAllData',
  'data-getStorageInfo',
  'data-openStorageDirectory',
]);

/** 偏好设置 channel。 */
const PREFERENCE_CHANNELS = Object.freeze([
  'preference-get',
  'preference-set',
  'preference-delete',
  'preference-keys',
  'preference-clear',
  'preference-getAll',
  'preference-exportData',
  'preference-importData',
  'preference-getDataType',
  'preference-validateData',
]);

/** Prompt 同步与流式 channel。 */
const PROMPT_CHANNELS = Object.freeze([
  'prompt-optimizePrompt',
  'prompt-optimizeMessage',
  'prompt-iteratePrompt',
  'prompt-testPrompt',
  'prompt-getHistory',
  'prompt-getIterationChain',
  'prompt-optimizePromptStream',
  'prompt-optimizeMessageStream',
  'prompt-iteratePromptStream',
  'prompt-testPromptStream',
  'prompt-testCustomConversationStream',
]);

/** LLM 与流取消 channel。 */
const LLM_CHANNELS = Object.freeze([
  'llm-testConnection',
  'llm-sendMessage',
  'llm-sendMessageStructured',
  'llm-fetchModelList',
  'llm-sendMessageStream',
  'llm-sendMessageStreamWithTools',
  'stream-cancel',
]);

/** 系统横切 channel。 */
const SYSTEM_CHANNELS = Object.freeze([
  'config-getEnvironmentVariables',
  'shell-openExternal',
  'app-get-version',
  'app-set-locale',
  'logs-get-paths',
  'logs-open-directory',
]);

/** 自动更新 invoke channel（字符串值，非 IPC_EVENTS 键名）。 */
const UPDATE_CHANNELS = Object.freeze([
  IPC_EVENTS.UPDATE_CHECK,
  IPC_EVENTS.UPDATE_CHECK_ALL_VERSIONS,
  IPC_EVENTS.UPDATE_START_DOWNLOAD,
  IPC_EVENTS.UPDATE_INSTALL,
  IPC_EVENTS.UPDATE_IGNORE_VERSION,
  IPC_EVENTS.UPDATE_UNIGNORE_VERSION,
  IPC_EVENTS.UPDATE_GET_IGNORED_VERSIONS,
  IPC_EVENTS.UPDATE_DOWNLOAD_SPECIFIC_VERSION,
]);

/** 自动更新事件 channel（main → renderer）。 */
const UPDATE_EVENT_CHANNELS = Object.freeze([
  IPC_EVENTS.UPDATE_AVAILABLE_INFO,
  IPC_EVENTS.UPDATE_NOT_AVAILABLE,
  IPC_EVENTS.UPDATE_DOWNLOAD_PROGRESS,
  IPC_EVENTS.UPDATE_DOWNLOADED,
  IPC_EVENTS.UPDATE_ERROR,
  IPC_EVENTS.UPDATE_DOWNLOAD_STARTED,
]);

/** 领域 invoke channel 合集（不含 update 事件）。 */
const ALL_DOMAIN_CHANNELS = Object.freeze([
  ...LLM_CHANNELS,
  ...PROMPT_CHANNELS,
  ...MODEL_CHANNELS,
  ...IMAGE_CHANNELS,
  ...TEMPLATE_CHANNELS,
  ...HISTORY_CHANNELS,
  ...CONTEXT_CHANNELS,
  ...FAVORITE_CHANNELS,
  ...DATA_CHANNELS,
  ...PREFERENCE_CHANNELS,
  ...SYSTEM_CHANNELS,
  ...UPDATE_CHANNELS,
]);

/**
 * 轻量 channel 元数据：领域 + 是否流式 + 响应信封约定。
 * 不描述完整 JSON Schema，仅保证契约测试可断言关键字段。
 */
const CHANNEL_META = Object.freeze(
  Object.fromEntries(
    ALL_DOMAIN_CHANNELS.map((channel) => {
      const isStream = /Stream$/.test(channel) || channel === 'stream-cancel';
      let domain = 'misc';
      if (channel.startsWith('llm-') || channel === 'stream-cancel') domain = 'llm';
      else if (channel.startsWith('prompt-')) domain = 'prompt';
      else if (channel.startsWith('model-')) domain = 'model';
      else if (channel.startsWith('image-')) domain = 'image';
      else if (channel.startsWith('template-')) domain = 'template';
      else if (channel.startsWith('history-')) domain = 'history';
      else if (channel.startsWith('context-')) domain = 'context';
      else if (channel.startsWith('favorite-')) domain = 'favorite';
      else if (channel.startsWith('data-')) domain = 'data';
      else if (channel.startsWith('preference-')) domain = 'preference';
      else if (channel.startsWith('updater-') || channel.startsWith('update-')) domain = 'update';
      else if (
        channel.startsWith('config-')
        || channel.startsWith('shell-')
        || channel.startsWith('app-')
        || channel.startsWith('logs-')
      ) domain = 'system';

      return [channel, Object.freeze({
        channel,
        domain,
        kind: isStream ? 'stream' : 'invoke',
        envelope: RESPONSE_ENVELOPE,
      })];
    }),
  ),
);

/** 判断是否为已登记的 invoke channel。 */
function isKnownInvokeChannel(channel) {
  return Object.prototype.hasOwnProperty.call(CHANNEL_META, channel);
}

/**
 * 可选运行时校验：未知 channel 抛错；默认仅供测试/调试使用。
 * @param {string} channel
 */
function assertKnownInvokeChannel(channel) {
  if (!isKnownInvokeChannel(channel)) {
    const error = new Error(`Unknown IPC invoke channel: ${channel}`);
    error.code = 'IPC_UNKNOWN_CHANNEL';
    throw error;
  }
  return CHANNEL_META[channel];
}

/** 读取 channel 元数据；未知时返回 null。 */
function getChannelMeta(channel) {
  return CHANNEL_META[channel] || null;
}

module.exports = {
  IPC_PROTOCOL_VERSION,
  RESPONSE_ENVELOPE,
  MODEL_CHANNELS,
  IMAGE_CHANNELS,
  TEMPLATE_CHANNELS,
  HISTORY_CHANNELS,
  CONTEXT_CHANNELS,
  FAVORITE_CHANNELS,
  DATA_CHANNELS,
  PREFERENCE_CHANNELS,
  PROMPT_CHANNELS,
  LLM_CHANNELS,
  SYSTEM_CHANNELS,
  UPDATE_CHANNELS,
  UPDATE_EVENT_CHANNELS,
  ALL_DOMAIN_CHANNELS,
  CHANNEL_META,
  isKnownInvokeChannel,
  assertKnownInvokeChannel,
  getChannelMeta,
};
