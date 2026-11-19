import { DesktopRunRepositoryError } from '@prompt-optimizer/core';
import { AssetReadError } from '@prompt-optimizer/core/asset-reader';

export interface BusinessOperation {
  domain: string;
  operation: string;
  access: 'read' | 'write';
  arguments: string[];
  minimum: number;
}

const definitions: Record<string, Record<string, [string, ...string[]]>> = {
  favorites: {
    getFavorites: ['read', 'options?'], getFavorite: ['read', 'id'], searchFavorites: ['read', 'keyword', 'options?'],
    getCategories: ['read'], getStats: ['read'], getAllTags: ['read'], getCategoryUsage: ['read', 'categoryId'],
    exportFavorites: ['read', 'ids?'],
    validateImportData: ['read', 'data', 'options?'],
    addFavorite: ['write', 'favorite'], updateFavorite: ['write', 'id', 'updates'],
    setFavoritePromptAssetCurrentVersion: ['write', 'id', 'versionId'],
    deleteFavoritePromptAssetVersion: ['write', 'id', 'versionId'], deleteFavorite: ['write', 'id'],
    deleteFavorites: ['write', 'ids'], incrementUseCount: ['write', 'id'],
    addCategory: ['write', 'category'], updateCategory: ['write', 'id', 'updates'], deleteCategory: ['write', 'id'],
    reorderCategories: ['write', 'categoryIds'], addTag: ['write', 'tag'], renameTag: ['write', 'oldTag', 'newTag'],
    mergeTags: ['write', 'sourceTags', 'targetTag'], deleteTag: ['write', 'tag'],
    importFavorites: ['write', 'data', 'options?'],
  },
  templates: {
    listTemplates: ['read'], getTemplate: ['read', 'id'], listTemplatesByType: ['read', 'type'],
    exportTemplate: ['read', 'id'], getCurrentBuiltinTemplateLanguage: ['read'], getSupportedBuiltinTemplateLanguages: ['read'],
    saveTemplate: ['write', 'template'], deleteTemplate: ['write', 'id'], importTemplate: ['write', 'jsonString'],
    changeBuiltinTemplateLanguage: ['write', 'language'],
  },
  models: {
    getAllModels: ['read'], getEnabledModels: ['read'], getModel: ['read', 'key'],
    addModel: ['write', 'key', 'config'], updateModel: ['write', 'key', 'config'], deleteModel: ['write', 'key'],
    enableModel: ['write', 'key'], disableModel: ['write', 'key'],
  },
  imageModels: {
    getAllConfigs: ['read'], getEnabledConfigs: ['read'], getConfig: ['read', 'id'],
    addConfig: ['write', 'config'], updateConfig: ['write', 'id', 'updates'], deleteConfig: ['write', 'id'],
  },
  contexts: {
    list: ['read'], get: ['read', 'id'], getCurrentId: ['read'], exportAll: ['read'],
    create: ['write', 'meta?'], duplicate: ['write', 'id', 'options?'], rename: ['write', 'id', 'title'],
    save: ['write', 'context'], update: ['write', 'id', 'patch'], remove: ['write', 'id'],
    setCurrentId: ['write', 'id'], importAll: ['write', 'bundle', 'mode'],
  },
  history: {
    getRecords: ['read'], getRecord: ['read', 'id'], getAllChains: ['read'], getChain: ['read', 'chainId'],
    getIterationChain: ['read', 'recordId'], addRecord: ['write', 'record'], createNewChain: ['write', 'params'],
    addIteration: ['write', 'params'], deleteRecord: ['write', 'id'], deleteChain: ['write', 'chainId'], clearHistory: ['write'],
  },
  settings: {
    get: ['read', 'key', 'defaultValue'], getAll: ['read'], keys: ['read'], exportData: ['read'],
    set: ['write', 'key', 'value'], delete: ['write', 'key'], importData: ['write', 'data'],
  },
  variables: {
    list: ['read'], get: ['read', 'name'], set: ['write', 'name', 'value'], delete: ['write', 'name'],
  },
  workspaces: {
    exportData: ['read'], validateData: ['read', 'data'], importData: ['write', 'data'],
  },
  providers: {
    getAllProviders: ['read'], getProvider: ['read', 'id'], getStaticModels: ['read', 'providerId'],
  },
  imageProviders: {
    getAllProviders: ['read'], getProvider: ['read', 'id'], getStaticModels: ['read', 'providerId'],
  },
  data: {
    exportAllData: ['read'], validateImportData: ['read', 'dataString'], importAllData: ['write', 'dataString'],
  },
};

export const businessOperations: BusinessOperation[] = Object.entries(definitions).flatMap(([domain, operations]) =>
  Object.entries(operations).map(([operation, [access, ...parameters]]) => ({
    domain, operation, access: access as 'read' | 'write', arguments: parameters,
    minimum: parameters.filter(parameter => !parameter.endsWith('?')).length,
  })));

export class DesktopBusinessError extends Error {
  constructor(readonly code: string) { super(`Desktop business request failed (${code}).`); }
}

export function assertJson(value: unknown, depth = 0, budget = { remaining: 100_000 }): void {
  if (depth > 48 || --budget.remaining < 0) throw new DesktopBusinessError('INVALID_INPUT');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (Array.isArray(value)) { for (const item of value) assertJson(item, depth + 1, budget); return; }
  if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw new DesktopBusinessError('INVALID_INPUT');
  }
  for (const [key, item] of Object.entries(value)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new DesktopBusinessError('INVALID_INPUT');
    assertJson(item, depth + 1, budget);
  }
}

export function publicBusinessError(error: unknown): { code: string; message: string } {
  const code = error instanceof DesktopBusinessError || error instanceof DesktopRunRepositoryError || error instanceof AssetReadError ? error.code : 'BUSINESS_OPERATION_FAILED';
  return { code, message: `Desktop business request failed (${code}).` };
}
