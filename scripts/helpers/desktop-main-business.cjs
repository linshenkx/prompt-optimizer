// Serialized into the hidden, synthetic renderer by the isolation bootstrap.
// Uses real preload APIs and main-process services; no model request or UI stub.
async function exerciseDesktopBusiness(phase) {
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

  const exported = await api.data.exportAllData();
  const parsed = JSON.parse(exported);
  check(parsed.data.models.some(item => item.id === modelId), 'app export includes saved model');
  check(parsed.data.history.some(item => item.id === historyId), 'app export includes saved history');
  check(parsed.data.workspaceSessions.sessions['pro-variable'].optimizedPrompt === draft.optimizedPrompt, 'app export includes current workspace');
  check(parsed.data.desktopRuns === undefined, 'app backup excludes MCP desktop runs');
  check(parsed.data.savedComparisons === undefined, 'app backup excludes MCP saved comparisons');
  await api.data.validateImportData(exported);
  await api.data.importAllData(exported);

  const legacyBetaBackup = JSON.stringify({
    version: 1,
    data: {
      savedComparisons: { version: 1, records: [], intents: [] },
      desktopRuns: { version: 1, runs: [] },
    },
  });
  await api.data.validateImportData(legacyBetaBackup);
  await api.data.importAllData(legacyBetaBackup);
  check(JSON.stringify(await api.preference.get(sessionKey, null)) === JSON.stringify(draft), 'legacy mcp backup import keeps workspace draft and A/B results');
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
  const checked = ['model edit', 'template', 'history', 'context', 'favorite/category/tag', 'workspace A/B draft', 'app export/import', 'legacy mcp backup sections ignored', 'favorite export/import', 'invalid import retains data', 'single deletion'];
  if (phase === 'restart') {
    const nextContent = '显式更新版本：{{text}}';
    const original = await api.favoriteManager.getFavorite(ids.favoriteId);
    const versions = original.metadata.promptAsset.versions;
    check(original.content !== nextContent, 'initial favorite content differs from next version');
    await api.favoriteManager.updateFavorite(ids.favoriteId, { content: nextContent });
    const adopted = await api.favoriteManager.getFavorite(ids.favoriteId);
    const adoptedAsset = adopted.metadata.promptAsset;
    check(adopted.content === nextContent && adoptedAsset.versions.length === versions.length + 1,
      'updating favorite adds a version');
    check(versions.every(version => adoptedAsset.versions.some(item =>
      item.id === version.id && JSON.stringify(item.content) === JSON.stringify(version.content))),
      'existing prompt versions survive update');
    checked.push('favorite version preservation');
  }
  return { ok: true, phase, checked, favoriteId: ids.favoriteId, completeProductUi: false };
}

module.exports = { exerciseDesktopBusiness };
