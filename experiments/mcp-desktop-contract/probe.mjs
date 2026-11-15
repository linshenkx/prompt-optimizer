// Protocol/adapter probe only. No database, application startup, or model calls.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';

const repository = new URL('../../', import.meta.url);
const require = createRequire(import.meta.url);
const compilerFlagIndex = process.argv.indexOf('--typescript');
const compilerPath = compilerFlagIndex >= 0 ? process.argv[compilerFlagIndex + 1]
  : require.resolve('typescript', { paths: [fileURLToPath(new URL('packages/core/', repository))] });
assert.ok(compilerPath, 'Supply an installed TypeScript module with --typescript');
const ts = require(compilerPath);
const facade = new URL('./probe-core-exports.mjs', import.meta.url);
const facadeConsumers = new Set([
  new URL('packages/ui/src/types/variable.ts', repository).href,
  new URL('packages/ui/src/utils/favorite-reproducibility.ts', repository).href,
]);

// Resolve and transpile repository TS imports using an already installed compiler.
// The core alias is limited to two known pure UI modules, never service assembly.
const hook = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@prompt-optimizer/core' && facadeConsumers.has(context.parentURL)) {
      return nextResolve(facade.href, context);
    }
    if (specifier.startsWith('.') && context.parentURL?.startsWith(repository.href)) {
      const candidate = new URL(`${specifier}.ts`, context.parentURL);
      if (existsSync(candidate)) return nextResolve(candidate.href, context);
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith(repository.href) && url.endsWith('.ts')) {
      return {
        format: 'module', shortCircuit: true,
        source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
          fileName: fileURLToPath(url),
          compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
        }).outputText,
      };
    }
    return nextLoad(url, context);
  },
});

try {
  const { promptAssetFromFavorite, refreshPromptAssetFromFavorite } = await import(
    '../../packages/core/src/services/prompt-model/favorite.ts'
  );
  const { promptExampleFromTestRun } = await import(
    '../../packages/core/src/services/prompt-model/example.ts'
  );
  const { resolveRuntimeTextModel, describeRuntimeModel } = await import(
    '../../packages/core/src/services/model/runtime-selection.ts'
  );
  const { buildPromptExecutionContext } = await import('../../packages/ui/src/utils/prompt-variables.ts');
  const { buildCompareEvaluationPayload } = await import(
    '../../packages/ui/src/composables/prompt/compareEvaluation.ts'
  );
  const { favoriteReproducibilityExampleFromPromptExample, parseFavoriteReproducibility } = await import(
    '../../packages/ui/src/utils/favorite-reproducibility.ts'
  );

  let checks = 0;
  const check = (name, fn) => {
    fn();
    checks++;
    process.stdout.write(`PASS ${name}\n`);
  };

  const favorite = {
    id: 'fixture-favorite', title: 'Fixture summary', content: '请用{{tone}}语气总结：{{text}}',
    tags: ['fixture'], functionMode: 'context', optimizationMode: 'user',
    createdAt: 1, updatedAt: 2, useCount: 0,
    metadata: { reproducibility: { variables: [{ name: 'tone', required: true }], examples: [] } },
  };
  const originalFavorite = JSON.stringify(favorite);
  const asset = promptAssetFromFavorite(favorite);
  const source = { favoriteId: favorite.id, assetId: asset.id, versionId: asset.currentVersionId };
  const selectExactVersion = (candidate, versionId) => {
    const version = candidate.versions.find(v => v.id === versionId);
    if (!version) throw new Error('ASSET_VERSION_NOT_FOUND');
    return structuredClone(version);
  };

  check('pure legacy asset projection and exact version selection', () => {
    assert.equal(asset.contract.modeKey, 'pro-variable');
    assert.equal(selectExactVersion(asset, source.versionId).content.text, favorite.content);
    assert.throws(() => selectExactVersion(asset, 'previous'), /ASSET_VERSION_NOT_FOUND/);
    assert.equal(JSON.stringify(favorite), originalFavorite);
  });

  const variables = { tone: '简洁', text: '<item> & {{literal}}' };
  const context = buildPromptExecutionContext(favorite.content, variables);
  const messages = [{ role: 'user', content: context.renderedContent }];
  check('existing variable preparation preserves one-pass literal values', () => {
    assert.deepEqual(context.missingVariables, []);
    assert.deepEqual(context.forbiddenTemplateSyntax, []);
    assert.equal(messages[0].content, '请用简洁语气总结：<item> & {{literal}}');
    assert.deepEqual(buildPromptExecutionContext(favorite.content, { tone: '简洁' }).missingVariables, ['text']);
    assert.deepEqual(buildPromptExecutionContext('{{{text}}}', variables).forbiddenTemplateSyntax, ['triple_braces']);
    assert.equal(buildPromptExecutionContext('{{count}}', { count: '0' }).renderedContent, '0');
  });

  const model = {
    id: 'fixture-model-a', name: 'Fixture A', enabled: true,
    providerId: 'fixture-provider', modelId: 'fixture-text-a',
    providerMeta: { id: 'fixture-provider', name: 'Fixture provider', requiresApiKey: true },
    modelMeta: {
      id: 'fixture-text-a', name: 'Fixture text A', providerId: 'fixture-provider',
      capabilities: { supportsTools: false },
      parameterDefinitions: [
        { name: 'temperature', type: 'number', defaultValue: 0.5 },
        { name: 'max_tokens', type: 'integer', defaultValue: 256 },
      ],
    },
    connectionConfig: {
      apiKey: 'SYNTHETIC_KEY_SENTINEL',
      baseURL: 'https://fixture.invalid/api?access=synthetic',
      headers: { authorization: 'SYNTHETIC_HEADER_SENTINEL' },
      arbitraryConnectionField: 'SYNTHETIC_PRIVATE_SENTINEL',
    },
    paramOverrides: { temperature: 0.2, arbitrarySetting: 'SYNTHETIC_CUSTOM_SENTINEL' },
  };
  const registry = {
    getAdapter(providerId) {
      assert.equal(providerId, 'fixture-provider');
      return {
        getProvider() { throw new Error('Unexpected provider lookup'); },
        getModels() { throw new Error('Unexpected model lookup'); },
        buildDefaultModel() { throw new Error('Unexpected model creation'); },
      };
    },
  };
  // A same-identity config uses its existing metadata; no provider SDK is loaded.
  const frozenConfig = resolveRuntimeTextModel(structuredClone(model), {}, registry);
  const effective = describeRuntimeModel(frozenConfig);
  const approvedParameters = new Set(['temperature', 'max_tokens']);
  // Draft outward boundary, deliberately stricter than describeRuntimeModel.
  const publicEffective = {
    parameters: Object.fromEntries(Object.entries(effective.parameters).filter(([key]) => approvedParameters.has(key))),
    parameterCoverage: 'declared',
    omittedParameterNames: Object.keys(effective.parameters).filter(key => !approvedParameters.has(key)),
    requestEvidence: 'pending', // This probe performs no SDK or network request.
    network: 'node',
  };
  const preview = structuredClone({ source, messages, variables, effective: publicEffective });
  check('runtime settings freeze independently of mutable input', () => {
    model.paramOverrides.temperature = 0.9;
    model.connectionConfig.apiKey = 'CHANGED_SYNTHETIC_SENTINEL';
    variables.text = 'changed after preview';
    assert.equal(frozenConfig.paramOverrides.temperature, 0.2);
    assert.equal(frozenConfig.connectionConfig.apiKey, 'SYNTHETIC_KEY_SENTINEL');
    assert.equal(preview.variables.text, '<item> & {{literal}}');
    assert.equal(preview.messages[0].content, messages[0].content);
    assert.equal(publicEffective.parameters.max_tokens, 256);
  });
  check('public projection omits credentials and unapproved custom values', () => {
    assert.deepEqual(publicEffective.omittedParameterNames, ['arbitrarySetting']);
    assert.equal(JSON.stringify(preview).includes('SYNTHETIC_'), false);
    assert.equal(JSON.stringify(preview).includes('connectionConfig'), false);
    assert.equal(effective.connection.baseURL, 'https://fixture.invalid/api');
    // Existing sanitizer retains safe-named custom values: do not export it raw.
    assert.equal(effective.parameters.arbitrarySetting, 'SYNTHETIC_CUSTOM_SENTINEL');
  });

  const run = {
    id: 'fixture-run-a',
    revision: { kind: 'asset-version', assetId: asset.id, versionId: source.versionId },
    input: { text: favorite.content, messages: preview.messages, parameters: preview.variables },
    output: { text: 'Fixture result A' }, status: 'success', modelKey: model.id,
    modelName: model.name, createdAt: 3, durationMs: 10,
    metadata: { publicExecution: { effective: publicEffective, source } },
  };
  const example = promptExampleFromTestRun(run, { basedOnVersionId: source.versionId });
  const updatedFavorite = structuredClone(favorite);
  updatedFavorite.metadata.promptAsset = { ...asset, examples: [example] };
  check('existing run-to-example and UI projections retain version and output', () => {
    assert.equal(example.basedOnVersionId, source.versionId);
    const visible = parseFavoriteReproducibility(updatedFavorite).examples[0];
    assert.equal(visible.outputText, 'Fixture result A');
    assert.equal(visible.messages[0].content, preview.messages[0].content);
    assert.equal(visible.basedOnVersionId, source.versionId);
    assert.equal(visible.metadata.runMetadata.publicExecution.effective.parameters.temperature, 0.2);
    assert.equal(promptExampleFromTestRun({ ...run, status: 'error' }, { basedOnVersionId: source.versionId }), null);
  });
  check('legacy reproducibility refresh can replace canonical-only example append', () => {
    const refreshed = refreshPromptAssetFromFavorite(updatedFavorite);
    assert.equal(refreshed.examples.length, 0);
    // A dual projection in the same future atomic transform survives refresh.
    updatedFavorite.metadata.reproducibility.examples = [favoriteReproducibilityExampleFromPromptExample(example)];
    const synchronized = refreshPromptAssetFromFavorite(updatedFavorite);
    assert.equal(synchronized.examples[0].basedOnVersionId, source.versionId);
    assert.equal(synchronized.examples[0].output.text, 'Fixture result A');
  });

  const compareInput = {
    target: { workspacePrompt: favorite.content },
    testCases: [{ id: 'same-input', input: { kind: 'variables', label: 'Variables', content: JSON.stringify(preview.variables) } }],
    snapshots: ['a', 'b'].map(id => ({
      id, label: id.toUpperCase(), testCaseId: 'same-input', promptRef: { kind: 'custom' },
      promptText: favorite.content, output: `Fixture result ${id}`, modelKey: `fixture-model-${id}`,
    })),
  };
  check('current UI compare helper rejects custom-only asset sources', () => {
    assert.equal(buildCompareEvaluationPayload(compareInput), null);
    // Control input proves the helper is otherwise ready; this is not a policy workaround.
    const control = structuredClone(compareInput);
    control.snapshots[0].promptRef.kind = 'workspace';
    const existingPayload = buildCompareEvaluationPayload(control);
    assert.equal(existingPayload.compareHints.hasCrossModelComparison, true);
    assert.equal(existingPayload.snapshots.length, 2);
  });

  process.stdout.write(`Verified ${checks} isolated protocol/adapter checks; no real storage or model execution.\n`);
} finally {
  hook.deregister();
}
