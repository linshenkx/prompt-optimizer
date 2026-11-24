import { describe, expect, it } from 'vitest'

import {
  createImplicitPromptSessionId,
  createPromptSessionRegistry,
  createPromptSessionSummaryFromLegacySnapshot,
  legacySessionSubModeKeyToPromptModeKey,
  promptModeKeyToLegacySessionSubModeKey,
  promptSessionFromLegacySnapshot,
  promptTestRunSetsFromLegacySessionSnapshot,
} from '../../../src/services/prompt-model'

describe('prompt-model session mapping', () => {
  it('maps legacy session keys to standard mode keys without renaming storage keys', () => {
    expect(legacySessionSubModeKeyToPromptModeKey('basic-system')).toBe('basic-system')
    expect(legacySessionSubModeKeyToPromptModeKey('basic-user')).toBe('basic-user')
    expect(legacySessionSubModeKeyToPromptModeKey('pro-multi')).toBe('pro-conversation')
    expect(legacySessionSubModeKeyToPromptModeKey('pro-variable')).toBe('pro-variable')
    expect(legacySessionSubModeKeyToPromptModeKey('image-multiimage')).toBe('image-multiimage')
    expect(promptModeKeyToLegacySessionSubModeKey('pro-conversation')).toBe('pro-multi')
    expect(createImplicitPromptSessionId('pro-multi')).toBe('implicit:pro-conversation')
  })

  it('projects a basic implicit session with text test runs', () => {
    const session = promptSessionFromLegacySnapshot({
      subModeKey: 'basic-system',
      prompt: 'Original system prompt',
      optimizedPrompt: 'Optimized system prompt',
      reasoning: 'reasoning text',
      chainId: 'chain-1',
      versionId: 'version-2',
      testContent: 'User test input',
      testVariants: [
        { id: 'a', version: 0, modelKey: 'model-a' },
        { id: 'b', version: 'workspace', modelKey: 'model-b' },
      ],
      testVariantResults: {
        a: { result: 'Original result', reasoning: 'original reasoning' },
        b: { result: 'Workspace result', reasoning: 'workspace reasoning' },
      },
      lastActiveAt: 1234,
      selectedOptimizeModelKey: 'opt-model',
      selectedTemplateId: 'template-a',
      isCompareMode: true,
    })

    expect(session).toMatchObject({
      schemaVersion: 'prompt-model/v1',
      id: 'implicit:basic-system',
      modeKey: 'basic-system',
      lifecycle: 'implicit',
      draft: {
        content: { kind: 'text', text: 'Optimized system prompt' },
      },
      optimization: {
        id: 'chain-1',
        modeKey: 'basic-system',
        root: {
          content: { kind: 'text', text: 'Original system prompt' },
        },
        records: [],
      },
      ui: {
        selectedOptimizeModelKey: 'opt-model',
        selectedTemplateId: 'template-a',
        isCompareMode: true,
      },
    })
    expect(session.testRuns).toHaveLength(1)
    expect(session.testRuns[0].runs).toHaveLength(2)
    expect(session.testRuns[0].runs[0]).toMatchObject({
      id: 'implicit:basic-system:test:a',
      revision: { kind: 'root', chainId: 'chain-1' },
      input: { text: 'User test input' },
      output: {
        text: 'Original result',
        metadata: { reasoning: 'original reasoning' },
      },
      modelKey: 'model-a',
    })
    expect(session.testRuns[0].runs[1]).toMatchObject({
      revision: { kind: 'workspace', sessionId: 'implicit:basic-system' },
      output: { text: 'Workspace result' },
      modelKey: 'model-b',
    })
  })

  it('carries asset binding and origin through session and summary projections', () => {
    const snapshot = {
      subModeKey: 'basic-system',
      prompt: 'Asset-backed prompt',
      assetBinding: {
        assetId: 'asset-1',
        versionId: 'version-2',
        status: 'linked' as const,
      },
      origin: {
        kind: 'favorite' as const,
        id: 'favorite-1',
        metadata: { title: 'Favorite prompt' },
      },
      testContent: 'Bound workspace input',
      testVariants: [{ id: 'a', version: 'workspace' as const, modelKey: 'model-a' }],
      testVariantResults: {
        a: { result: 'Bound workspace output' },
      },
      lastActiveAt: 1234,
    }

    const session = promptSessionFromLegacySnapshot(snapshot)
    const summary = createPromptSessionSummaryFromLegacySnapshot(snapshot)

    expect(session).toMatchObject({
      assetBinding: {
        assetId: 'asset-1',
        versionId: 'version-2',
        status: 'linked',
      },
      origin: {
        kind: 'favorite',
        id: 'favorite-1',
        metadata: { title: 'Favorite prompt' },
      },
    })
    expect(summary).toMatchObject({
      assetBinding: session.assetBinding,
      origin: session.origin,
    })
    expect(session.testRuns[0].runs[0]).toMatchObject({
      revision: { kind: 'workspace', sessionId: 'implicit:basic-system' },
      metadata: {
        sessionId: 'implicit:basic-system',
        modeKey: 'basic-system',
        chainId: 'implicit:basic-system:chain',
        assetBinding: {
          assetId: 'asset-1',
          versionId: 'version-2',
          status: 'linked',
        },
        origin: {
          kind: 'favorite',
          id: 'favorite-1',
          metadata: { title: 'Favorite prompt' },
        },
      },
    })
  })

  it('projects pro-multi as a pro-conversation session with selected message target', () => {
    const session = promptSessionFromLegacySnapshot({
      subModeKey: 'pro-multi',
      conversationMessagesSnapshot: [
        {
          id: 'msg-1',
          role: 'system',
          content: 'Current system message',
          originalContent: 'Original system message',
        },
        {
          id: 'msg-2',
          role: 'user',
          content: 'User message',
        },
      ],
      selectedMessageId: 'msg-1',
      messageChainMap: {
        'msg-1': 'message-chain-1',
      },
      optimizedPrompt: 'Optimized selected message',
      temporaryVariables: {
        audience: 'developers',
      },
      testVariants: [{ id: 'a', version: 'workspace', modelKey: 'model-a' }],
      testVariantResults: {
        a: { result: 'Conversation test result' },
      },
      lastActiveAt: 2000,
    })

    expect(session.modeKey).toBe('pro-conversation')
    expect(session.draft?.content).toEqual({
      kind: 'messages',
      messages: [
        {
          id: 'msg-1',
          role: 'system',
          content: 'Current system message',
          originalContent: 'Original system message',
        },
        {
          id: 'msg-2',
          role: 'user',
          content: 'User message',
        },
      ],
    })
    expect(session.optimization).toMatchObject({
      id: 'message-chain-1',
      root: {
        content: { kind: 'text', text: 'Original system message' },
      },
      target: {
        kind: 'message',
        id: 'msg-1',
        role: 'system',
      },
    })
    expect(session.testRuns[0].runs[0]).toMatchObject({
      input: {
        messages: session.draft?.content.kind === 'messages' ? session.draft.content.messages : [],
        parameters: { audience: 'developers' },
      },
      output: { text: 'Conversation test result' },
    })
  })

  it('projects image test results into prompt image refs', () => {
    const testRuns = promptTestRunSetsFromLegacySessionSnapshot({
      subModeKey: 'image-image2image',
      originalPrompt: 'Change the style',
      optimizedPrompt: 'Change the style carefully',
      inputImageId: 'input-asset',
      selectedImageModelKey: 'image-model',
      testVariants: [
        { id: 'a', version: 0 },
        { id: 'b', version: 'workspace', modelKey: 'variant-model' },
      ],
      testVariantResults: {
        a: {
          images: [{ _type: 'image-ref', id: 'output-asset' }],
          text: 'metadata text',
        },
        b: {
          images: [{ url: 'https://example.test/output.png' }],
        },
      },
      lastActiveAt: 3000,
    })

    expect(testRuns).toHaveLength(1)
    expect(testRuns[0].runs[0]).toMatchObject({
      revision: { kind: 'root', chainId: 'implicit:image-image2image:chain' },
      input: {
        images: [{ kind: 'asset', assetId: 'input-asset' }],
      },
      output: {
        text: 'metadata text',
        images: [{ kind: 'asset', assetId: 'output-asset' }],
      },
      modelKey: 'image-model',
    })
    expect(testRuns[0].runs[1]).toMatchObject({
      revision: { kind: 'workspace', sessionId: 'implicit:image-image2image' },
      output: {
        images: [{ kind: 'url', url: 'https://example.test/output.png' }],
      },
      modelKey: 'variant-model',
    })
  })

  it('projects runtime input image sources when asset ids are not available yet', () => {
    const testRuns = promptTestRunSetsFromLegacySessionSnapshot({
      subModeKey: 'image-multiimage',
      originalPrompt: 'Blend the references',
      inputImageIds: ['input-asset'],
      inputImages: [
        { _type: 'image-ref', id: 'input-asset' },
        { url: 'data:image/png;base64,runtime-input' },
      ],
      testVariants: [{ id: 'a', version: 'workspace', modelKey: 'image-model' }],
      testVariantResults: {
        a: {
          images: [{ _type: 'image-ref', id: 'output-asset' }],
        },
      },
      lastActiveAt: 4000,
    })

    expect(testRuns[0].runs[0]).toMatchObject({
      input: {
        images: [
          { kind: 'asset', assetId: 'input-asset' },
          { kind: 'url', url: 'data:image/png;base64,runtime-input' },
        ],
      },
      output: {
        images: [{ kind: 'asset', assetId: 'output-asset' }],
      },
    })
  })

  it('prefers runSnapshot over current controls, parses legacy requestPrompt, and marks cancelled runs as error', () => {
    const testRuns = promptTestRunSetsFromLegacySessionSnapshot({
      subModeKey: 'basic-system',
      prompt: 'Current original',
      optimizedPrompt: 'Current optimized',
      testContent: 'Current test input',
      testVariants: [
        { id: 'a', version: 'workspace', modelKey: 'new-model' },
        { id: 'b', version: 'workspace', modelKey: 'legacy-model' },
        { id: 'c', version: 'workspace', modelKey: 'cancelled-model' },
      ],
      testVariantResults: {
        a: {
          result: 'Snapshot output',
          reasoning: '',
          status: 'complete',
          runSnapshot: {
            prompt: 'Captured system prompt',
            modelKey: 'captured-model',
            version: 0,
            input: { text: 'Captured user input' },
          },
        },
        b: {
          result: 'Legacy output',
          reasoning: '',
          requestPrompt: '[system]\nLegacy system prompt\n\n[user]\nLegacy user input',
        },
        c: {
          result: 'Partial cancelled output',
          reasoning: '',
          status: 'cancelled',
        },
      },
      lastActiveAt: 5000,
    })

    expect(testRuns[0].runs).toHaveLength(3)
    expect(testRuns[0].runs[0]).toMatchObject({
      status: 'success',
      modelKey: 'captured-model',
      revision: { kind: 'root' },
      input: { text: 'Captured user input' },
      output: { text: 'Snapshot output' },
      metadata: { promptText: 'Captured system prompt' },
    })
    expect(testRuns[0].runs[1]).toMatchObject({
      status: 'success',
      modelKey: 'legacy-model',
      input: { text: 'Legacy user input' },
      output: { text: 'Legacy output' },
      metadata: { promptText: 'Legacy system prompt' },
    })
    expect(testRuns[0].runs[2]).toMatchObject({
      status: 'error',
      output: { text: 'Partial cancelled output' },
    })
  })

  it('retains each legacy basic-user request prompt for saving test results', () => {
    const [runSet] = promptTestRunSetsFromLegacySessionSnapshot({
      subModeKey: 'basic-user',
      prompt: 'Current prompt',
      testVariants: [{ id: 'b', version: 'workspace', modelKey: 'model' }],
      testVariantResults: {
        b: { result: 'Old output', reasoning: '', requestPrompt: 'Older tested prompt' },
      },
    })
    expect(runSet.runs[0].metadata?.promptText).toBe('Older tested prompt')
  })

  it('builds a registry for implicit sessions and tracks the active normalized mode', () => {
    const basic = createPromptSessionSummaryFromLegacySnapshot({
      subModeKey: 'basic-system',
      prompt: 'Basic prompt',
      lastActiveAt: 1000,
    })
    const pro = createPromptSessionSummaryFromLegacySnapshot({
      subModeKey: 'pro-multi',
      lastActiveAt: 2000,
    })

    const registry = createPromptSessionRegistry({
      sessions: [basic, pro],
      activeLegacySubModeKey: 'pro-multi',
      updatedAt: 3000,
    })

    expect(registry).toEqual({
      schemaVersion: 'prompt-model/v1',
      activeSessionId: 'implicit:pro-conversation',
      activeSessionIdByMode: {
        'basic-system': 'implicit:basic-system',
        'pro-conversation': 'implicit:pro-conversation',
      },
      sessions: [basic, pro],
      updatedAt: 3000,
      metadata: undefined,
    })
  })
})
