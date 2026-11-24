import { describe, expect, it } from 'vitest'

import {
  promptExampleFromTestRun,
  type PromptTestRun,
} from '../../../src/services/prompt-model'

const createRun = (overrides: Partial<PromptTestRun> = {}): PromptTestRun => ({
  id: 'run-1',
  revision: { kind: 'workspace', sessionId: 'implicit:basic-system' },
  input: { text: 'Input text' },
  output: { text: 'Output text' },
  status: 'success',
  modelKey: 'model-a',
  modelName: 'Model A',
  createdAt: 1234,
  durationMs: 456,
  ...overrides,
})

describe('promptExampleFromTestRun', () => {
  it('converts a text test run into a prompt example', () => {
    const example = promptExampleFromTestRun(createRun(), {
      basedOnVersionId: 'version-1',
    })

    expect(example).toMatchObject({
      id: 'test-run:run-1',
      basedOnVersionId: 'version-1',
      input: { text: 'Input text' },
      output: { text: 'Output text' },
      createdAt: 1234,
      source: { kind: 'workspace', id: 'implicit:basic-system' },
      metadata: {
        testRunId: 'run-1',
        revision: { kind: 'workspace', sessionId: 'implicit:basic-system' },
        modelKey: 'model-a',
        modelName: 'Model A',
        durationMs: 456,
      },
    })
  })

  it('preserves conversation messages and parameters', () => {
    const example = promptExampleFromTestRun(createRun({
      revision: { kind: 'record', chainId: 'chain-1', recordId: 'record-1', version: 2 },
      input: {
        messages: [
          { id: 'msg-1', role: 'system', content: 'You are concise.' },
          { id: 'msg-2', role: 'user', content: 'Summarize {{topic}}.' },
        ],
        parameters: { topic: 'release notes' },
      },
      output: { text: 'A concise summary.' },
    }), {
      basedOnVersionId: 'version-1',
      title: 'Conversation example',
    })

    expect(example).toMatchObject({
      title: 'Conversation example',
      input: {
        messages: [
          { id: 'msg-1', role: 'system', content: 'You are concise.' },
          { id: 'msg-2', role: 'user', content: 'Summarize {{topic}}.' },
        ],
        parameters: { topic: 'release notes' },
      },
      output: { text: 'A concise summary.' },
      source: { kind: 'workspace', id: 'chain-1' },
    })
  })

  it('preserves input and output image refs', () => {
    const example = promptExampleFromTestRun(createRun({
      input: {
        text: 'Generate {{scene}}',
        parameters: { scene: 'city' },
        images: [{ kind: 'asset', assetId: 'input-asset' }],
      },
      output: {
        images: [{ kind: 'url', url: 'https://example.test/output.png' }],
      },
    }), {
      basedOnVersionId: 'version-1',
    })

    expect(example).toMatchObject({
      input: {
        text: 'Generate {{scene}}',
        parameters: { scene: 'city' },
        images: [{ kind: 'asset', assetId: 'input-asset' }],
      },
      output: {
        images: [{ kind: 'url', url: 'https://example.test/output.png' }],
      },
    })
  })

  it('keeps asset-bound workspace runs as workspace sources with binding metadata', () => {
    const example = promptExampleFromTestRun(createRun({
      revision: { kind: 'workspace', sessionId: 'implicit:basic-system' },
      metadata: {
        sessionId: 'implicit:basic-system',
        modeKey: 'basic-system',
        chainId: 'chain-1',
        versionId: 'session-version-1',
        assetBinding: {
          assetId: 'asset-1',
          versionId: 'asset-version-1',
          status: 'linked',
        },
        origin: {
          kind: 'favorite',
          id: 'favorite-1',
          metadata: { title: 'Favorite prompt' },
        },
      },
    }), {
      basedOnVersionId: 'asset-version-1',
    })

    expect(example).toMatchObject({
      basedOnVersionId: 'asset-version-1',
      source: {
        kind: 'workspace',
        id: 'implicit:basic-system',
        metadata: {
          sessionId: 'implicit:basic-system',
          modeKey: 'basic-system',
          chainId: 'chain-1',
          versionId: 'session-version-1',
          assetBinding: {
            assetId: 'asset-1',
            versionId: 'asset-version-1',
            status: 'linked',
          },
          origin: {
            kind: 'favorite',
            id: 'favorite-1',
            metadata: { title: 'Favorite prompt' },
          },
        },
      },
      metadata: {
        runMetadata: {
          assetBinding: {
            assetId: 'asset-1',
            versionId: 'asset-version-1',
            status: 'linked',
          },
        },
      },
    })
  })

  it('converts successful runs with empty separate input (e.g. basic-user or plain text2image)', () => {
    const example = promptExampleFromTestRun(createRun({
      input: {},
      output: { text: 'Direct user prompt output' },
    }), {
      basedOnVersionId: 'version-1',
    })

    expect(example).toMatchObject({
      input: {},
      output: { text: 'Direct user prompt output' },
    })
  })

  it('does not create examples for failed or empty-output runs', () => {
    expect(promptExampleFromTestRun(createRun({
      status: 'error',
      error: 'boom',
    }), {
      basedOnVersionId: 'version-1',
    })).toBeNull()

    expect(promptExampleFromTestRun(createRun({
      output: undefined,
    }), {
      basedOnVersionId: 'version-1',
    })).toBeNull()
  })
})
