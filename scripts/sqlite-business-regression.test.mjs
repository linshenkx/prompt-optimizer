import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

// No dotenv, inherited model credentials, proxy settings or real profile is used.
// This file runs in its own node:test process. Removing variables here does not
// change the shell, application or other test processes.
for (const name of Object.keys(process.env)) {
  if (/^(VITE_|OPENAI_|ANTHROPIC_|GOOGLE_|GEMINI_|DEEPSEEK_|SILICONFLOW_|OLLAMA_|CUSTOM_|AZURE_|HTTP_PROXY|HTTPS_PROXY|ALL_PROXY|DOTENV_)/i.test(name)) {
    delete process.env[name];
  }
}
globalThis.__VITE_ENV__ = {};
globalThis.fetch = () => { throw new Error('Network is forbidden in storage business regression'); };

const core = await import('../packages/core/dist/index.js');
const nodeStorage = await import('../packages/core/dist/node.js');
const evidenceParent = fileURLToPath(new URL('../.codex-run/', import.meta.url));
const MODEL = 'storage-business-text';
const IMAGE_MODEL = 'storage-business-image';
const TEMPLATE = 'storage-business-template';
const MODES = ['basic-system', 'basic-user', 'pro-multi', 'pro-variable', 'image-text2image', 'image-image2image', 'image-multiimage', 'arena'];

async function services(storage) {
  const registry = core.createTextAdapterRegistry();
  const imageRegistry = core.createImageAdapterRegistry();
  const models = new core.ModelManager(storage, registry);
  await models.ensureInitialized();
  const imageModels = new core.ImageModelManager(storage, imageRegistry);
  await imageModels.ensureInitialized();
  const preferences = new core.PreferenceService(storage);
  const language = new core.TemplateLanguageService(preferences);
  await language.initialize();
  const templates = new core.TemplateManager(storage, language);
  const history = new core.HistoryManager(storage, models);
  const contexts = core.createContextRepo(storage);
  const favorites = new core.FavoriteManager(storage);
  await favorites.getFavorites();
  const data = new core.DataManager(models, templates, history, preferences, contexts, imageModels);
  return { registry, imageRegistry, models, imageModels, preferences, templates, history, contexts, favorites, data };
}

function session(mode, suffix) {
  if (mode === 'arena') return core.createArenaState();
  return {
    ...(mode === 'pro-multi'
      ? { conversationMessagesSnapshot: [{ id: 'message-1', role: 'user', content: `多消息原稿 ${suffix}` }], selectedMessageId: 'message-1' }
      : mode.startsWith('image-') ? { originalPrompt: `图片提示词 ${suffix}` } : { prompt: `原始稿 ${suffix}`, testContent: '测试输入\n保留换行' }),
    optimizedPrompt: `工作区草稿 ${suffix}\n保留末行`,
    selectedOptimizeModelKey: MODEL,
    selectedTestModelKey: MODEL,
    selectedImageModelKey: IMAGE_MODEL,
    temporaryVariables: { tone: '简明', text: `文本 ${suffix}` },
    layout: { mainSplitLeftPct: 43, testColumnCount: 2 },
    testVariants: [{ id: 'a', version: 0, modelKey: MODEL }, { id: 'b', version: 'workspace', modelKey: MODEL }],
    testVariantResults: mode.startsWith('image-')
      ? { a: { images: [{ _type: 'image-ref', id: 'synthetic-image-reference', mimeType: 'image/png' }], text: `图片说明 ${suffix}` }, b: null }
      : { a: { result: `A 结果 ${suffix}`, requestPrompt: '请求时原稿' }, b: { result: `B 结果 ${suffix}`, reasoning: '思考末行' } },
    isCompareMode: true,
  };
}

async function seed(app) {
  const textAdapter = app.registry.getAdapter('openai');
  await app.models.addModel(MODEL, {
    id: MODEL, name: '迁移前文本模型', enabled: true,
    providerMeta: textAdapter.getProvider(), modelMeta: textAdapter.buildDefaultModel('synthetic-text-model'),
    connectionConfig: { apiKey: 'synthetic-only-key', baseURL: 'https://fixture.invalid/v1' },
    paramOverrides: { temperature: 0.4 }, customParamOverrides: { fixture_text_parameter: 'synthetic-option' },
  });
  const imageAdapter = app.imageRegistry.getAdapter('openai');
  await app.imageModels.addConfig({
    id: IMAGE_MODEL, name: '迁移前图片模型', enabled: true,
    providerId: 'openai', modelId: 'gpt-image-1',
    provider: imageAdapter.getProvider(), model: imageAdapter.buildDefaultModel('gpt-image-1'),
    connectionConfig: { apiKey: 'synthetic-image-key', baseURL: 'https://fixture.invalid/v1' }, paramOverrides: {},
    customParamOverrides: { fixture_image_parameter: 'synthetic-option' },
  });
  await app.templates.saveTemplate({
    id: TEMPLATE, name: '迁移前模板', content: '请处理：{{originalPrompt}}', isBuiltin: false,
    metadata: { version: '1.0.0', lastModified: 1700000000000, templateType: 'optimize', author: 'Synthetic Author' },
  });
  await app.history.addRecord({
    id: 'storage-history-before', originalPrompt: '迁移前原稿', optimizedPrompt: '迁移前结果\n保留末行',
    type: 'optimize', chainId: 'storage-chain', version: 1, timestamp: 1700000000000, modelKey: MODEL, templateId: TEMPLATE,
  });
  const contextId = await app.contexts.create({ title: '迁移前上下文', mode: 'user' });
  await app.contexts.update(contextId, {
    variables: { tone: '简明', text: '上下文变量' },
    messages: [{ id: 'storage-context-message', role: 'user', content: '{{text}}' }],
  });
  await app.contexts.setCurrentId(contextId);
  const categoryId = await app.favorites.addCategory({ name: '迁移分类', sortOrder: 1 });
  const favoriteId = await app.favorites.addFavorite({
    title: '迁移前收藏', content: '请用{{tone}}语气总结：{{text}}', category: categoryId,
    tags: ['数据保全', '中文 👋'], functionMode: 'context', optimizationMode: 'user',
    metadata: { sourceHistoryId: 'storage-history-before', originalContent: '迁移前原稿', modelKey: MODEL },
  });
  await app.favorites.addTag('尚未使用的标签');
  await app.preferences.set('app:settings:ui:theme-id', 'dark');
  await app.preferences.set('global-settings/v1', { selectedThemeId: 'dark', builtinTemplateLanguage: 'zh-CN' });
  await app.preferences.set('variableManager.storage', {
    customVariables: { tone: '简明', text: '变量值\n末行' }, advancedModeEnabled: true,
  });
  for (const mode of MODES) await app.preferences.set(`session/v1/${mode}`, session(mode, '迁移前'));
  return { contextId, categoryId, favoriteId };
}

async function businessSnapshot(app) {
  const favorites = JSON.parse(await app.favorites.exportFavorites());
  delete favorites.exportDate;
  return { app: JSON.parse(await app.data.exportAllData()), favorites };
}

async function mutateAfterMigration(app, ids) {
  await app.models.updateModel(MODEL, { name: '升级后修改的模型', paramOverrides: { temperature: 0.7 } });
  await app.imageModels.updateConfig(IMAGE_MODEL, { name: '升级后修改的图片模型' });
  const template = await app.templates.getTemplate(TEMPLATE);
  await app.templates.saveTemplate({ ...template, name: '升级后模板', content: '升级后：{{originalPrompt}}' });
  await app.history.addRecord({
    id: 'storage-history-after', originalPrompt: '升级后原稿', optimizedPrompt: '升级后新增结果\n末行',
    type: 'iterate', chainId: 'storage-chain', version: 2, timestamp: 1700000001000, modelKey: MODEL, templateId: TEMPLATE,
  });
  await app.contexts.update(ids.contextId, { title: '升级后上下文', variables: { tone: '严谨', text: '升级后变量' } });
  await app.favorites.updateFavorite(ids.favoriteId, { title: '升级后修改的收藏', content: '升级后：{{text}}' });
  await app.favorites.addFavorite({ title: '升级后新增收藏', content: '保留这条新增内容', tags: ['新增'], functionMode: 'basic', optimizationMode: 'system' });
  await app.favorites.addTag('升级后新增独立标签');
  await app.preferences.set('app:settings:ui:theme-id', 'light');
  await app.preferences.set('global-settings/v1', { selectedThemeId: 'light', builtinTemplateLanguage: 'zh-CN' });
  for (const mode of MODES) if (mode !== 'arena') await app.preferences.set(`session/v1/${mode}`, session(mode, '升级后'));
}

async function rawSnapshot(provider) {
  return Object.fromEntries(await provider.getAllEntries());
}

test('JSON → SQLite preserves business data; post-upgrade changes survive reopen and current exports restore to JSON', { timeout: 45000 }, async t => {
  await mkdir(evidenceParent, { recursive: true });
  const root = await mkdtemp(join(evidenceParent, 'po-storage-business-r3-'));
  const legacyDirectory = join(root, 'source');
  const rollbackDirectory = join(root, 'raw-rollback');
  const importDirectory = join(root, 'business-import');
  await Promise.all([legacyDirectory, rollbackDirectory, importDirectory].map(dir => mkdir(dir)));
  const providers = [];
  t.after(async () => {
    for (const provider of providers) {
      await provider.flush();
      if (typeof provider.close === 'function') await provider.close();
    }
  });

  const file = new core.FileStorageProvider(legacyDirectory);
  providers.push(file);
  const before = await services(file);
  const ids = await seed(before);
  // Unknown keys, exact JSON strings and Unicode must survive format migration,
  // even when no current business export section knows about them.
  await file.setItem('future:opaque-key', 'opaque\n中文 👋 {"x":1}');
  const expectedBefore = await businessSnapshot(before);
  await file.flush();
  const legacyPath = join(legacyDirectory, nodeStorage.LEGACY_STORAGE_FILENAME);
  const legacyBytes = await readFile(legacyPath, 'utf8');
  const expectedRawBefore = JSON.parse(legacyBytes);

  const first = await nodeStorage.openDesktopStorage(legacyDirectory);
  providers.push(first.provider);
  assert.equal(first.migration.source, 'json');
  assert.deepEqual(await rawSnapshot(first.provider), expectedRawBefore);
  const migrated = await services(first.provider);
  assert.deepEqual(await businessSnapshot(migrated), expectedBefore);

  await mutateAfterMigration(migrated, ids);
  await first.provider.setItem('future:post-upgrade-key', '只有升级后的当前库才有的数据');
  const expectedAfter = await businessSnapshot(migrated);
  const expectedRawAfter = await rawSnapshot(first.provider);
  await first.provider.close();
  providers.splice(providers.indexOf(first.provider), 1);
  assert.equal(await readFile(legacyPath, 'utf8'), legacyBytes, 'The old JSON remains only the pre-upgrade snapshot');

  const reopened = await nodeStorage.openDesktopStorage(legacyDirectory);
  providers.push(reopened.provider);
  assert.deepEqual(await rawSnapshot(reopened.provider), expectedRawAfter);
  const afterRestart = await services(reopened.provider);
  assert.deepEqual(await businessSnapshot(afterRestart), expectedAfter);

  // The storage implementation supplies this in-memory export. It never writes
  // a file or creates a backup. This test writes only its own synthetic fixture.
  const currentLegacyJson = await nodeStorage.exportDesktopStorageAsLegacyJSON(legacyDirectory);
  assert.deepEqual(JSON.parse(currentLegacyJson), await rawSnapshot(reopened.provider));
  assert.equal(JSON.parse(currentLegacyJson)['future:post-upgrade-key'], '只有升级后的当前库才有的数据');
  await writeFile(join(rollbackDirectory, nodeStorage.LEGACY_STORAGE_FILENAME), currentLegacyJson, { flag: 'wx' });
  const rollback = new core.FileStorageProvider(rollbackDirectory);
  providers.push(rollback);
  for (const [key, value] of Object.entries(JSON.parse(currentLegacyJson))) {
    assert.equal(await rollback.getItem(key), value, `Legacy provider reopens recovered key ${key}`);
  }
  assert.deepEqual(await businessSnapshot(await services(rollback)), expectedAfter);

  // Exercise the existing product exports independently of the full KV route.
  const appExport = await afterRestart.data.exportAllData();
  const favoritesExport = await afterRestart.favorites.exportFavorites();
  const importedStorage = new core.FileStorageProvider(importDirectory);
  providers.push(importedStorage);
  const imported = await services(importedStorage);
  await imported.data.validateImportData(appExport);
  await imported.favorites.validateImportData(favoritesExport, { matchBy: 'id', mergeStrategy: 'overwrite' });
  await imported.data.importAllData(appExport);
  const result = await imported.favorites.importFavorites(favoritesExport, { matchBy: 'id', mergeStrategy: 'overwrite' });
  assert.deepEqual(result.errors, []);
  assert.equal(result.imported, 2);
  const importedSnapshot = await businessSnapshot(imported);
  const expectedImported = structuredClone(expectedAfter);
  // Existing import deliberately refreshes context/template modification times and
  // omits empty custom-parameter maps. Check these exact normalizations while
  // retaining strict equality for all other business fields.
  for (const template of importedSnapshot.app.data.userTemplates) {
    const previous = expectedImported.app.data.userTemplates.find(item => item.id === template.id);
    assert.ok(Number.isFinite(template.metadata.lastModified));
    assert.ok(template.metadata.lastModified >= previous.metadata.lastModified);
    previous.metadata.lastModified = template.metadata.lastModified;
  }
  for (const context of importedSnapshot.app.data.contexts.contexts) {
    const previous = expectedImported.app.data.contexts.contexts.find(item => item.id === context.id);
    assert.ok(Number.isFinite(Date.parse(context.updatedAt)));
    assert.ok(Date.parse(context.updatedAt) >= Date.parse(previous.updatedAt));
    previous.updatedAt = context.updatedAt;
  }
  for (const snapshot of [importedSnapshot, expectedImported]) {
    for (const model of [...snapshot.app.data.models, ...snapshot.app.data.imageModels]) {
      if (model.customParamOverrides && Object.keys(model.customParamOverrides).length === 0) delete model.customParamOverrides;
    }
  }
  assert.deepEqual(importedSnapshot, expectedImported);
  await importedStorage.flush();
  assert.equal(await importedStorage.getItem('future:post-upgrade-key'), null, 'Business exports intentionally differ from full raw KV recovery');

  // Removing one entity must retain unrelated content on the new provider.
  await afterRestart.favorites.deleteFavorite(ids.favoriteId);
  await afterRestart.history.deleteRecord('storage-history-before');
  await afterRestart.templates.deleteTemplate(TEMPLATE);
  assert.equal((await afterRestart.favorites.getFavorites()).length, 1);
  assert.deepEqual((await afterRestart.history.getRecords()).map(record => record.id), ['storage-history-after']);
  assert.equal((await afterRestart.models.getModel(MODEL)).name, '升级后修改的模型');
  assert.equal(await reopened.provider.getItem('future:post-upgrade-key'), '只有升级后的当前库才有的数据');
  assert.equal(await readFile(legacyPath, 'utf8'), legacyBytes);

  const summary = {
    ok: true, runtime: { node: process.versions.node, sqlite: process.versions.sqlite },
    migratedKeys: Object.keys(expectedRawBefore).length, workspaceModes: MODES.length,
    checked: ['exact KV migration', 'models', 'image model configs', 'templates', 'history', 'contexts', 'favorites/categories/tags', 'preferences/variables', 'workspace drafts/results', 'restart', 'current full-KV recovery to JSON', 'existing business export/import', 'targeted deletion'],
    scope: 'Real core services and File/SQLite providers with synthetic data; no complete product UI, image binaries, installer or real-user-data verification',
  };
  await writeFile(join(root, 'summary.json'), JSON.stringify(summary, null, 2));
  t.diagnostic(JSON.stringify({ ...summary, evidence: root }));
});
