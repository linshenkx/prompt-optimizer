// Serialized into the hidden, synthetic renderer by the isolation bootstrap.
// Uses real preload APIs and main-process services; no model request or UI stub.
async function exerciseDesktopBusiness(phase, comparisons) {
  const api = window.electronAPI;
  const check = (condition, label) => {
    if (!condition) throw new Error(`Business IPC regression: ${label}`);
  };
  const key = 'storage-main-r3-identities';
  const modelId = 'storage-ipc-model';
  const templateId = 'storage-ipc-template';
  const historyId = 'storage-ipc-history';
  const sessionKey = 'session/v1/pro-variable';
  const draft = {
    prompt: '桌面 IPC 原始稿', optimizedPrompt: '升级后工作稿\n保留最后一行',
    temporaryVariables: { tone: '简明', text: '合成文本' },
    selectedTestModelKey: modelId,
    testVariants: [{ id: 'a', version: 0, modelKey: modelId }, { id: 'b', version: 'workspace', modelKey: modelId }],
    testVariantResults: { a: { result: '合成 A 结果', requestPrompt: '发送时原稿' }, b: { result: '合成 B 结果' } },
  };
  let ids = await api.preference.get(key, null);
  if (phase === 'first') {
    check(ids === null, 'first start is a fresh synthetic fixture');
    const exemplar = (await api.model.getAllModels()).find(model => model.providerMeta?.id === 'openai');
    check(Boolean(exemplar), 'real model metadata is available');
    await api.model.addModel({
      ...exemplar, key: modelId, id: modelId, name: '合成 IPC 模型', enabled: true,
      connectionConfig: { apiKey: 'synthetic-ipc-only', baseURL: 'https://fixture.invalid/v1' },
      paramOverrides: { temperature: 0.4 },
    });
    await api.model.updateModel(modelId, { name: '升级后 IPC 模型', paramOverrides: { temperature: 0.7 } });
    await api.template.createTemplate({
      id: templateId, name: 'IPC 模板', content: 'IPC 模板：{{originalPrompt}}', isBuiltin: false,
      metadata: { version: '1.0.0', lastModified: 1700000000000, templateType: 'optimize' },
    });
    await api.history.addRecord({
      id: historyId, originalPrompt: 'IPC 原稿', optimizedPrompt: 'IPC 结果\n末行',
      type: 'optimize', chainId: 'storage-ipc-chain', version: 1, timestamp: 1700000000000,
      modelKey: modelId, templateId,
    });
    const contextId = await api.context.create({ title: 'IPC 上下文', mode: 'user' });
    await api.context.update(contextId, { variables: { tone: '简明' } });
    await api.context.setCurrentId(contextId);
    const categoryId = await api.favoriteManager.addCategory({ name: 'IPC 分类', sortOrder: 1 });
    const favoriteId = await api.favoriteManager.addFavorite({
      title: 'IPC 收藏', content: '请用{{tone}}语气总结：{{text}}',
      tags: ['合成数据'], category: categoryId, functionMode: 'context', optimizationMode: 'user',
    });
    await api.favoriteManager.updateFavorite(favoriteId, { title: '升级后 IPC 收藏', content: '升级后：{{text}}' });
    await api.favoriteManager.addTag('IPC 独立标签');
    await api.preference.set(sessionKey, draft);
    ids = { contextId, categoryId, favoriteId };
    await api.preference.set(key, ids);
  }
  check(Boolean(ids), 'identities survive restart');
  const model = (await api.model.getAllModels()).find(item => item.id === modelId);
  check(model?.name === '升级后 IPC 模型' && model.paramOverrides.temperature === 0.7, 'model edit persists');
  check((await api.template.getTemplate(templateId)).content === 'IPC 模板：{{originalPrompt}}', 'template persists');
  check((await api.history.getHistory()).some(item => item.id === historyId && item.optimizedPrompt === 'IPC 结果\n末行'), 'history persists');
  check((await api.context.get(ids.contextId)).variables.tone === '简明', 'context persists');
  check(await api.context.getCurrentId() === ids.contextId, 'current context persists');
  check((await api.favoriteManager.getFavorite(ids.favoriteId)).content === '升级后：{{text}}', 'favorite edit persists');
  check((await api.favoriteManager.getCategories()).some(item => item.id === ids.categoryId), 'category persists');
  check((await api.favoriteManager.getAllTags()).some(item => item.tag === 'IPC 独立标签'), 'independent tag persists');
  check(JSON.stringify(await api.preference.get(sessionKey, null)) === JSON.stringify(draft), 'workspace draft and A/B results persist');

  const listed = await api.savedComparisons.list({ favoriteId: ids.favoriteId });
  if (comparisons) {
    const { comparison, revision } = comparisons.persisted;
    check(listed.items.length === 1 && listed.items[0].id === comparison.id, 'comparison from prior launch appears in list');
    check(JSON.stringify(listed.items[0].statuses) === '["success","cancelled"]', 'comparison summary retains both statuses');
    const reloaded = await api.savedComparisons.get(comparison.id);
    check(JSON.stringify(reloaded.comparison) === JSON.stringify(comparison) && reloaded.revision === revision, 'comparison IPC retains request evidence and outputs');
    check((await api.savedComparisons.list({ favoriteId: 'another-favorite' })).items.length === 0, 'comparison list applies favorite filter');
  } else {
    check(listed.items.length === 0, 'first launch has no saved comparison');
  }

  const exported = await api.data.exportAllData();
  const parsed = JSON.parse(exported);
  check(parsed.data.models.some(item => item.id === modelId), 'app export includes saved model');
  check(parsed.data.history.some(item => item.id === historyId), 'app export includes saved history');
  check(parsed.data.workspaceSessions.sessions['pro-variable'].optimizedPrompt === draft.optimizedPrompt, 'app export includes current workspace');
  if (comparisons) {
    const saved = parsed.data.savedComparisons;
    check(saved?.version === 1 && saved.records.length === 1, 'app backup includes saved comparison section');
    check(JSON.stringify(saved.records[0].comparison) === JSON.stringify(comparisons.persisted.comparison), 'backup includes full saved snapshot');
  } else {
    check(parsed.data.savedComparisons === undefined, 'empty comparison storage does not add a backup section');
  }
  await api.data.validateImportData(exported);
  await api.data.importAllData(exported);

  if (comparisons) {
    // The backup came from a separate fixture database. This record is new to the live desktop store.
    const { restored, backup, persisted } = comparisons;
    const backupJson = JSON.stringify({ version: 1, data: { savedComparisons: backup } });
    await api.data.validateImportData(backupJson);
    await api.data.importAllData(backupJson);
    const reopened = await api.savedComparisons.get(restored.comparison.id);
    check(JSON.stringify(reopened.comparison) === JSON.stringify(restored.comparison) && reopened.revision === restored.revision, 'DataManager restores full comparison into active desktop profile');
    const stored = JSON.parse(await api.data.exportAllData()).data.savedComparisons;
    check(stored.records.length === 2 && stored.records.some(record => record.id === restored.comparison.id), 're-export includes restored comparison');
    const deleted = await api.savedComparisons.delete(restored.comparison.id, restored.revision);
    check(deleted.deleted && !deleted.alreadyDeleted, 'explicit removal affects the imported comparison');
    const remaining = (await api.savedComparisons.list()).items;
    check(remaining.length === 1 && remaining[0].id === persisted.comparison.id, 'deletion leaves unrelated comparison');
    check(JSON.stringify(await api.preference.get(sessionKey, null)) === JSON.stringify(draft), 'comparison reads, restore and delete keep workspace draft and A/B results');
  }
  const favoriteExport = await api.favoriteManager.exportFavorites();
  await api.favoriteManager.validateImportData(favoriteExport, { matchBy: 'id', mergeStrategy: 'overwrite' });
  const restored = await api.favoriteManager.importFavorites(favoriteExport, { matchBy: 'id', mergeStrategy: 'overwrite' });
  check(restored.errors.length === 0, 'favorite export/import succeeds');
  check((await api.favoriteManager.getFavorite(ids.favoriteId)).title === '升级后 IPC 收藏', 'favorite identity survives import');

  // Invalid imports must fail validation before overwriting existing sections.
  parsed.data.models.find(item => item.id === modelId).name = 'MUST-NOT-BE-IMPORTED';
  parsed.data.workspaceSessions.sessions['pro-variable'].optimizedPrompt = { invalid: true };
  let refused = false;
  try { await api.data.importAllData(JSON.stringify(parsed)); } catch { refused = true; }
  check(refused, 'invalid workspace import is refused');
  check((await api.model.getAllModels()).find(item => item.id === modelId).name === '升级后 IPC 模型', 'invalid import cannot partially overwrite models');
  check((await api.preference.get(sessionKey, null)).optimizedPrompt === draft.optimizedPrompt, 'invalid import retains working draft');

  // Exercise delete routes using disposable entities, retaining the fixture.
  const disposable = await api.favoriteManager.addFavorite({ title: 'IPC 待删除', content: '仅合成临时记录', tags: [], functionMode: 'basic', optimizationMode: 'system' });
  await api.favoriteManager.deleteFavorite(disposable);
  check((await api.favoriteManager.getFavorites()).length === 1, 'single deletion retains unrelated favorite');
  check((await api.model.getAllModels()).some(item => item.id === modelId), 'single deletion retains model');
  const checked = ['model edit', 'template', 'history', 'context', 'favorite/category/tag', 'workspace A/B draft', 'app export/import', 'favorite export/import', 'invalid import retains data', 'single deletion'];
  if (comparisons) checked.push('saved comparison IPC after restart', 'comparison export/import', 'comparison deletion and draft preservation');
  return { ok: true, phase, checked, favoriteId: ids.favoriteId, completeProductUi: false };
}

async function seedDesktopComparisons(repository, backupRepository, favoriteId) {
  const { randomUUID } = require('node:crypto');

  function fixture(title) {
    const startedAt = 1700000000000;
    const run = (id, status, temperature, output) => {
      const modelId = 'synthetic-model-' + id;
      const parameters = { temperature };
      const evidence = { api: 'chat-completions', modelId, parameters, omittedParameterNames: [] };
      return {
        id, runId: randomUUID(), model: { configKey: modelId, name: modelId, providerId: 'openai', modelId },
        effective: {
          parameterCoverage: 'declared', parameters, omittedParameterNames: [],
          requestEvidence: 'captured', preview: evidence, request: evidence,
        },
        status, output, reasoning: '', startedAt, completedAt: startedAt + 20,
      };
    };
    return {
      id: randomUUID(),
      executionSource: {
        kind: 'desktop', sourceId: 'fixture-profile', sourceEpoch: 'fixture-epoch',
        connectionGeneration: 'fixture-connection', label: 'Isolated profile',
      },
      source: { favoriteId, title, assetId: 'fixture-asset', versionId: 'fixture-version', expectedRevision: 'fixture-revision' },
      request: {
        rawPrompt: 'Upgrade: {{text}}', variables: { text: 'Synthetic input' },
        messages: [{ role: 'user', content: 'Upgrade: Synthetic input' }],
      },
      runs: [
        run('a', 'success', 0.2, 'Complete synthetic output'),
        run('b', 'cancelled', 0.7, 'Partial synthetic output'),
      ],
    };
  }

  const persisted = await repository.save(fixture('Saved comparison from the first launch'), 'desktop-ipc-saved');
  const restored = await backupRepository.save(fixture('Saved comparison from the isolated backup'), 'desktop-ipc-restored');
  return { persisted, restored, backup: await backupRepository.exportData() };
}

module.exports = { exerciseDesktopBusiness, seedDesktopComparisons };
