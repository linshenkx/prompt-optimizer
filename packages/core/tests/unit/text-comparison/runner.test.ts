import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AssetReadStorage } from '../../../src/services/asset-reader/types'
import { TextAdapterRegistry } from '../../../src/services/llm/adapters/registry'
import type { Message, StreamHandlers } from '../../../src/services/llm/types'
import type { TextModelConfig } from '../../../src/services/model/types'
import { createTextComparisonService } from '../../../src/services/text-comparison/runner'
import type { PrepareTextComparison, TextComparisonPromptSelection } from '../../../src/services/text-comparison/types'

const secret = 'SYNTHETIC_COMPARISON_KEY'
const privateParameter = 'private-example-in-saved-config'

interface RequestCall {
  messages: Message[]
  config: TextModelConfig
  callbacks: StreamHandlers
  resolve(): void
  reject(error: Error): void
}

const services: ReturnType<typeof createTextComparisonService>[] = []

function fixture(prompt = 'Summarize {{subject}} as {{style}}. {{currentPrompt}}') {
  const registry = new TextAdapterRegistry()
  const adapter = registry.getAdapter('openai-compatible')
  const meta = adapter.buildDefaultModel('test-model')
  const models = {
    first: {
      id: 'stored-id-not-config-key-a', name: 'Model A', enabled: true,
      providerMeta: adapter.getProvider(), modelMeta: meta,
      connectionConfig: { apiKey: secret, baseURL: 'https://fixture.invalid/v1?auth=' + secret },
      paramOverrides: { temperature: 0.2, vendor_note: privateParameter },
    },
    second: {
      id: 'stored-id-not-config-key-b', name: 'Model B', enabled: true,
      providerMeta: adapter.getProvider(), modelMeta: meta,
      connectionConfig: { apiKey: secret, baseURL: 'https://fixture.invalid/v1?auth=' + secret },
      paramOverrides: { temperature: 0.8 },
    },
  }
  const favorites = [{
    id: 'fav', title: 'Fixture prompt', content: prompt, tags: [], createdAt: 1, updatedAt: 2, useCount: 0,
    functionMode: 'context', optimizationMode: 'user',
    metadata: { reproducibility: { variables: [{ name: 'subject', required: true, defaultValue: 'Hint only' }] } },
  }]
  const customVariables = { style: 'saved style', unused: 'unused value' }
  const data = new Map<string, string>()
  const modelRequests: RequestCall[] = []
  const beforeSend = vi.fn()
  function persistFixtures() {
    data.set('models', JSON.stringify(models))
    data.set('favorites', JSON.stringify(favorites))
    data.set('pref:variableManager.storage', JSON.stringify({ customVariables, advancedModeEnabled: true }))
  }
  persistFixtures()
  const storage = { getItem: vi.fn(async (key: string) => data.get(key) ?? null) } satisfies AssetReadStorage

  vi.spyOn(adapter, 'sendMessageStream').mockImplementation((messages, config, callbacks) => {
    const evidence = adapter.describeStreamRequest!(config)!
    beforeSend(config, evidence)
    callbacks.onRequest!(evidence)
    return new Promise<void>((resolve, reject) => {
      modelRequests.push({ messages, config, callbacks, resolve, reject })
    })
  })

  const service = createTextComparisonService({
    storage, registry,
    executionSource: {
      kind: 'desktop', sourceId: 'fixture-source', sourceEpoch: 'fixture-epoch',
      connectionGeneration: 'fixture-generation', label: 'Fixture source',
    },
  })
  services.push(service)

  async function selection(variables: Record<string, string> = { subject: 'literal {{style}}' }): Promise<PrepareTextComparison> {
    const { items: [asset] } = await service.reader.listAssets()
    const { items: [a, b] } = await service.listModels()
    return {
      source: {
        favoriteId: asset.favoriteId, assetId: asset.assetId, versionId: asset.currentVersionId, expectedRevision: asset.revision,
      },
      candidates: [
        { id: 'a', configKey: a.configKey, expectedRevision: a.revision },
        { id: 'b', configKey: b.configKey, expectedRevision: b.revision },
      ],
      variables,
    }
  }

  return { service, registry, models, favorites, customVariables, data, storage, beforeSend, modelRequests, selection, persistFixtures }
}

function withCandidatePrompt(selection: PrepareTextComparison, candidatePrompt: TextComparisonPromptSelection): PrepareTextComparison {
  const model = selection.candidates[0]
  return { ...selection, candidatePrompt, candidates: [model, { ...model, id: 'b' }] }
}

async function terminalResult(service: ReturnType<typeof createTextComparisonService>, preparedId: string) {
  await vi.waitFor(() => expect(service.get(preparedId).runs.every(run => run.completedAt !== undefined)).toBe(true))
  return service.completed(preparedId)
}

afterEach(() => {
  for (const service of services.splice(0)) service.dispose()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('source-bound text comparisons', () => {
  it('renders the selected version once, previews both saved configs, and freezes the exact request', async () => {
    const f = fixture()
    const models = await f.service.listModels()
    expect(models.items.map(item => [item.configKey, item.executable])).toEqual([['first', true], ['second', true]])
    const supplied = { subject: 'literal {{style}}', style: 'request style', unused: 'another unused value' }
    const selection = await f.selection(supplied)
    const before = Array.from(f.data)
    const preview = await f.service.prepare(selection)
    expect(f.modelRequests).toHaveLength(0)
    expect(Array.from(f.data)).toEqual(before)
    expect(preview.request.variables).toEqual({
      subject: 'literal {{style}}', style: 'request style', currentPrompt: preview.request.rawPrompt,
    })
    const expected = 'Summarize literal {{style}} as request style. ' + preview.request.rawPrompt
    expect(preview.request.messages).toEqual([{ role: 'user', content: expected }])
    expect(preview.runs.map(run => run.effective.preview?.parameters.temperature)).toEqual([0.2, 0.8])
    expect(preview.runs.map(run => run.effective.requestEvidence)).toEqual(['pending', 'pending'])
    expect(JSON.stringify(preview)).not.toMatch(/fixture\.invalid|SYNTHETIC_COMPARISON_KEY|private-example-in-saved-config/)
    expect(() => f.service.completed(preview.preparedId)).toThrow(expect.objectContaining({ code: 'COMPARISON_NOT_COMPLETE' }))

    // Neither caller-owned DTO changes nor changes after execute can replace a frozen message.
    supplied.subject = 'mutated input'
    preview.request.messages[0].content = 'mutated preview'
    const start = () => f.service.execute(preview.preparedId, preview.previewRevision)
    const snapshots = await Promise.all([start(), start()])
    expect(snapshots[0].runs.map(run => run.status)).toEqual(['running', 'running'])
    expect(f.modelRequests).toHaveLength(2)
    f.models.first.paramOverrides.temperature = 1.6
    f.persistFixtures()
    expect(f.modelRequests.map(call => call.messages)).toEqual([
      [{ role: 'user', content: expected }], [{ role: 'user', content: expected }],
    ])
    expect(f.modelRequests.map(call => call.config.paramOverrides?.temperature)).toEqual([0.2, 0.8])
    expect(f.modelRequests[0].config.connectionConfig.apiKey).toBe(secret)
    f.modelRequests[0].callbacks.onToken('answer A')
    f.modelRequests[0].callbacks.onReasoningToken?.('reason A')
    await f.modelRequests[1].callbacks.onComplete({ content: 'answer B' })
    f.modelRequests.forEach(call => call.resolve())
    const saved = await terminalResult(f.service, preview.preparedId)
    expect(saved).toMatchObject({ id: preview.comparisonId, request: { messages: [{ role: 'user', content: expected }] } })
    expect(saved.runs.map(run => [run.status, run.output, run.reasoning, run.effective.request?.parameters.temperature]))
      .toEqual([['success', 'answer A', 'reason A', 0.2], ['success', 'answer B', '', 0.8]])
    expect(JSON.stringify(saved)).not.toMatch(/fixture\.invalid|SYNTHETIC_COMPARISON_KEY|private-example-in-saved-config/)
    expect((await start()).runs.map(run => run.status)).toEqual(['success', 'success'])
    expect(f.modelRequests).toHaveLength(2)
  })

  it('uses the same model snapshot and separate frozen inputs for a favorite and a draft', async () => {
    const f = fixture('Summarize {{subject}}')
    const draft = { kind: 'draft' as const, text: 'Review {{subject}} with {{style}}' }
    const before = Array.from(f.data)
    const preview = await f.service.prepare(withCandidatePrompt(await f.selection(), draft))
    const originalInput = [{ role: 'user', content: 'Summarize literal {{style}}' }]
    const draftInput = [{ role: 'user', content: 'Review literal {{style}} with saved style' }]
    expect(preview.request.messages).toEqual(originalInput)
    expect(preview.candidatePrompt).toMatchObject({ kind: 'draft', request: { rawPrompt: draft.text, messages: draftInput } })
    expect(preview.runs[0].effective.preview).toEqual(preview.runs[1].effective.preview)
    expect(f.modelRequests).toHaveLength(0)

    draft.text = 'Changed by the caller after preview'
    if (preview.candidatePrompt) preview.candidatePrompt.request.messages[0].content = 'Modified response'
    await f.service.execute(preview.preparedId, preview.previewRevision)
    expect(f.modelRequests.map(call => call.messages)).toEqual([originalInput, draftInput])
    expect(f.modelRequests[0].config).toEqual(f.modelRequests[1].config)
    expect(f.modelRequests[0].config).not.toBe(f.modelRequests[1].config)
    f.modelRequests.forEach((call, index) => {
      call.callbacks.onToken('Answer ' + index)
      call.resolve()
    })
    const completed = await terminalResult(f.service, preview.preparedId)
    expect(completed.candidatePrompt?.request.messages).toEqual(draftInput)
    expect(completed.runs.map(run => [run.status, run.output])).toEqual([['success', 'Answer 0'], ['success', 'Answer 1']])
    expect(Array.from(f.data)).toEqual(before)
  })

  it('validates the draft and prevents starting when a variable used only by the candidate changes', async () => {
    const f = fixture('Summarize {{subject}}')
    const selection = await f.selection()
    const draft = { kind: 'draft' as const, text: 'Summarize {{subject}} with {{style}}' }
    await expect(f.service.prepare({ ...selection, candidatePrompt: draft })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    await expect(f.service.prepare(withCandidatePrompt(selection, { ...draft, text: 'Require {{missing}}' })))
      .rejects.toMatchObject({ code: 'MISSING_VARIABLES', missingVariables: ['missing'] })
    const preview = await f.service.prepare(withCandidatePrompt(selection, draft))
    f.customVariables.style = 'changed only for the candidate'
    f.persistFixtures()
    await expect(f.service.execute(preview.preparedId, preview.previewRevision)).rejects.toMatchObject({ code: 'STALE_PREPARATION' })
    expect(f.modelRequests).toHaveLength(0)
  })

  it('uses global variables as fallback and rejects missing, reserved, and unsafe placeholders before execution', async () => {
    const f = fixture('  Summarize {{subject}} as {{style}}  ')
    await expect(f.service.prepare(await f.selection({ subject: '  ' }))).rejects.toMatchObject({
      code: 'MISSING_VARIABLES', missingVariables: ['subject'],
    })
    await expect(f.service.prepare(await f.selection({ currentPrompt: 'replacement' }))).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    await expect(f.service.prepare(await f.selection(JSON.parse('{"__proto__":"unsafe"}')))).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    const preview = await f.service.prepare(await f.selection({ subject: '0' }))
    expect(preview.request.messages[0].content).toBe('Summarize 0 as saved style')
    expect(f.modelRequests).toHaveLength(0)

    const forbidden = fixture('{{{subject}}}')
    await expect(forbidden.service.prepare(await forbidden.selection())).rejects.toMatchObject({ code: 'FORBIDDEN_TEMPLATE_SYNTAX' })
    const inherited = fixture('{{toString}}')
    await expect(inherited.service.prepare(await inherited.selection())).rejects.toMatchObject({
      code: 'MISSING_VARIABLES', missingVariables: ['toString'],
    })
  })

  it('rejects expansive templates without allocating the unbounded rendered output', async () => {
    const f = fixture('{{currentPrompt}}'.repeat(500))
    await expect(f.service.prepare(await f.selection())).rejects.toMatchObject({ code: 'TEXT_LIMIT' })
    expect(f.modelRequests).toHaveLength(0)
  })

  it.each([
    ['model', (f: ReturnType<typeof fixture>) => { f.models.second.enabled = false }],
    ['favorite', (f: ReturnType<typeof fixture>) => { f.favorites[0].content = 'Revised {{subject}}' }],
    ['global variable', (f: ReturnType<typeof fixture>) => { f.customVariables.style = 'revised style' }],
  ])('rejects stale preparation after a %s changes before launch', async (_kind, edit) => {
    const f = fixture()
    const preview = await f.service.prepare(await f.selection())
    edit(f)
    f.persistFixtures()
    await expect(f.service.execute(preview.preparedId, preview.previewRevision)).rejects.toMatchObject({ code: 'STALE_PREPARATION' })
    expect(f.modelRequests).toHaveLength(0)
  })

  it('rejects an unsigned or disabled candidate before starting either request', async () => {
    const f = fixture()
    const selection = await f.selection()
    selection.candidates[1].expectedRevision = selection.candidates[0].expectedRevision
    await expect(f.service.prepare(selection)).rejects.toMatchObject({ code: 'REVISION_CONFLICT' })
    f.models.second.enabled = false
    f.persistFixtures()
    expect((await f.service.listModels()).items[1]).toMatchObject({
      executable: false, unavailableReason: 'MODEL_DISABLED',
    })
    await expect(f.service.prepare(await f.selection())).rejects.toMatchObject({ code: 'MODEL_DISABLED' })
    expect(f.modelRequests).toHaveLength(0)
  })

  it('cancels a selected run, leaves its partial output intact, ignores late callbacks, and lets its peer finish', async () => {
    const f = fixture()
    const preview = await f.service.prepare(await f.selection())
    await f.service.execute(preview.preparedId, preview.previewRevision)
    const [a, b] = f.modelRequests
    a.callbacks.onToken('before cancellation')
    const cancelled = f.service.cancel(preview.preparedId, preview.runs[0].runId)
    expect(cancelled.runs.map(run => run.status)).toEqual(['cancelled', 'running'])
    expect(a.callbacks.signal?.aborted).toBe(true)
    expect(b.callbacks.signal?.aborted).toBe(false)
    a.callbacks.onToken(' late output')
    a.callbacks.onError(new Error(secret))
    a.resolve()
    b.callbacks.onToken('completed peer')
    b.resolve()
    const result = await terminalResult(f.service, preview.preparedId)
    expect(result.runs.map(run => [run.status, run.output])).toEqual([
      ['cancelled', 'before cancellation'], ['success', 'completed peer'],
    ])
    expect(JSON.stringify(result)).not.toContain(secret)
  })

  it('blocks a changed SDK request before sending it and does not expose provider exceptions', async () => {
    const f = fixture()
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    f.beforeSend.mockImplementation((config, evidence) => {
      if (config.id === f.models.first.id) evidence.parameters.temperature = 1.2
    })
    const preview = await f.service.prepare(await f.selection())
    await f.service.execute(preview.preparedId, preview.previewRevision)
    expect(f.modelRequests).toHaveLength(1)
    f.modelRequests[0].reject(new Error(secret))
    const result = await terminalResult(f.service, preview.preparedId)
    expect(result.runs.map(run => [run.status, run.errorCode, run.effective.requestEvidence])).toEqual([
      ['error', 'REQUEST_CHANGED', 'pending'], ['error', 'MODEL_REQUEST_FAILED', 'captured'],
    ])
    expect(JSON.stringify(result)).not.toContain(secret)
    expect(logged).not.toHaveBeenCalled()
  })

  it('enforces output limits with partial output and aborts running requests when the service closes', async () => {
    const f = fixture()
    const preview = await f.service.prepare(await f.selection())
    await f.service.execute(preview.preparedId, preview.previewRevision)
    const [a, b] = f.modelRequests
    a.callbacks.onToken('x'.repeat(90_000))
    expect(f.service.get(preview.preparedId).runs[0]).toMatchObject({ status: 'error', errorCode: 'OUTPUT_LIMIT' })
    expect(f.service.get(preview.preparedId).runs[0].output).toHaveLength(80_000)
    expect(a.callbacks.signal?.aborted).toBe(true)
    f.service.dispose()
    expect(b.callbacks.signal?.aborted).toBe(true)
    expect(() => f.service.get(preview.preparedId)).toThrow(expect.objectContaining({ code: 'COMPARISON_SERVICE_CLOSED' }))
    f.modelRequests.forEach(call => call.resolve())
  })
})