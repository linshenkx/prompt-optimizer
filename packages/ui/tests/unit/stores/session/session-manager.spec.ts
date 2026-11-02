import { describe, it, expect, vi } from 'vitest'
import type { PromptRecordChain } from '@prompt-optimizer/core'

import { createTestPinia, createPreferenceServiceStub } from '../../../utils/pinia-test-helpers'
import { useSessionManager } from '../../../../src/stores/session/useSessionManager'
import { useBasicSystemSession } from '../../../../src/stores/session/useBasicSystemSession'
import { useProMultiMessageSession } from '../../../../src/stores/session/useProMultiMessageSession'
import { useImageImage2ImageSession } from '../../../../src/stores/session/useImageImage2ImageSession'
import { useImageMultiImageSession } from '../../../../src/stores/session/useImageMultiImageSession'

const createHistoryChain = (): PromptRecordChain => {
  const rootRecord = {
    id: 'record-1',
    originalPrompt: 'Original system prompt',
    optimizedPrompt: 'Optimized system prompt',
    type: 'optimize' as const,
    chainId: 'basic-chain',
    version: 1,
    timestamp: 1000,
    modelKey: 'model-a',
    templateId: 'template-a',
  }
  const currentRecord = {
    ...rootRecord,
    id: 'record-2',
    originalPrompt: 'Optimized system prompt',
    optimizedPrompt: 'Optimized system prompt v2',
    type: 'iterate' as const,
    version: 2,
    previousId: 'record-1',
    timestamp: 2000,
  }

  return {
    chainId: 'basic-chain',
    rootRecord,
    currentRecord,
    versions: [rootRecord, currentRecord],
  }
}

describe('SessionManager', () => {
  it('cleans only the oversized session key when restore fails with session snapshot overflow', async () => {
    const deleteMock = vi.fn(async () => {})

    const { pinia, services } = createTestPinia({
      preferenceService: createPreferenceServiceStub({
        get: vi.fn(async () => {
          throw {
            code: 'error.storage.read',
            params: {
              reason: 'session_snapshot_too_large',
              key: 'session/v1/image-multiimage',
            },
          }
        }),
        delete: deleteMock,
      }),
      imageStorageService: {
        getImage: vi.fn(async () => null),
      } as any,
    })

    const manager = useSessionManager(pinia)

    await manager.restoreSubModeSession('image-multiimage')

    expect(deleteMock).toHaveBeenCalledTimes(1)
    expect(deleteMock).toHaveBeenCalledWith('session/v1/image-multiimage')
    expect(services.preferenceService.get).toHaveBeenCalledWith(
      'session/v1/image-multiimage',
      null,
    )
  })

  it('cleans the damaged session key when restore fails because a referenced image asset is missing', async () => {
    const deleteMock = vi.fn(async () => {})

    const { pinia, services } = createTestPinia({
      preferenceService: createPreferenceServiceStub({
        get: vi.fn(async () => {
          throw {
            code: 'error.storage.read',
            params: {
              reason: 'session_referenced_image_missing',
              key: 'session/v1/image-multiimage',
              assetId: 'missing-asset',
            },
          }
        }),
        delete: deleteMock,
      }),
      imageStorageService: {
        getImage: vi.fn(async () => null),
      } as any,
    })

    const manager = useSessionManager(pinia)

    await manager.restoreSubModeSession('image-multiimage')

    expect(deleteMock).toHaveBeenCalledTimes(1)
    expect(deleteMock).toHaveBeenCalledWith('session/v1/image-multiimage')
    expect(services.preferenceService.get).toHaveBeenCalledWith(
      'session/v1/image-multiimage',
      null,
    )
  })

  it('repairs a Basic/System snapshot whose optional test image asset is missing', async () => {
    const deleteMock = vi.fn(async () => {})
    const setMock = vi.fn(async () => {})
    const getMock = vi.fn(async <T,>(key: string, defaultValue: T) => {
      if (key === 'session/v1/basic-system') {
        return {
          prompt: 'preserved system prompt',
          optimizedPrompt: 'preserved optimized prompt',
          reasoning: 'preserved reasoning',
          chainId: 'preserved-chain',
          versionId: 'preserved-version',
          testContent: 'preserved test content',
          testImageAssetId: 'missing-basic-test-image',
          testImageMimeType: 'image/png',
          selectedOptimizeModelKey: 'opt-model',
          selectedTestModelKey: 'test-model',
          selectedTemplateId: 'template',
          selectedIterateTemplateId: 'iterate-template',
          isCompareMode: true,
        } as T
      }
      return defaultValue
    })
    const { pinia, services } = createTestPinia({
      preferenceService: createPreferenceServiceStub({
        get: getMock,
        set: setMock,
        delete: deleteMock,
      }),
      imageStorageService: {
        getImage: vi.fn(async () => null),
        listAllMetadata: vi.fn(async () => []),
        deleteImages: vi.fn(async () => {}),
      } as any,
    })
    const manager = useSessionManager(pinia)

    await manager.restoreSubModeSession('basic-system')

    expect(services.imageStorageService?.getImage).toHaveBeenCalledWith(
      'missing-basic-test-image',
    )
    expect(deleteMock).not.toHaveBeenCalled()

    const restored = useBasicSystemSession(pinia)
    expect(restored.prompt).toBe('preserved system prompt')
    expect(restored.optimizedPrompt).toBe('preserved optimized prompt')
    expect(restored.reasoning).toBe('preserved reasoning')
    expect(restored.chainId).toBe('preserved-chain')
    expect(restored.versionId).toBe('preserved-version')
    expect(restored.testContent).toBe('preserved test content')
    expect(restored.testImageB64).toBeNull()
    expect(restored.testImageMimeType).toBe('')
    expect(restored.testImageAssetId).toBeNull()

    expect(setMock).toHaveBeenCalledWith(
      'session/v1/basic-system',
      expect.objectContaining({
        prompt: 'preserved system prompt',
        optimizedPrompt: 'preserved optimized prompt',
        testImageAssetId: null,
        testImageMimeType: '',
      }),
    )
  })

  it('exposes normalized prompt session views without changing existing stores', () => {
    const { pinia } = createTestPinia()
    const manager = useSessionManager(pinia)
    manager.injectSubModeReaders({
      getFunctionMode: () => 'pro',
      getBasicSubMode: () => 'system',
      getProSubMode: () => 'multi',
      getImageSubMode: () => 'multiimage',
    })

    const basicSystem = useBasicSystemSession(pinia)
    basicSystem.prompt = 'Original system prompt'
    basicSystem.optimizedPrompt = 'Optimized system prompt'
    basicSystem.chainId = 'basic-chain'
    basicSystem.versionId = 'basic-version'
    basicSystem.assetBinding = {
      assetId: 'asset-basic',
      versionId: 'version-basic',
      status: 'linked',
    }
    basicSystem.origin = {
      kind: 'favorite',
      id: 'favorite-basic',
      metadata: { title: 'Basic favorite' },
    }
    basicSystem.testContent = 'User test input'
    basicSystem.testImageB64 = 'must-not-be-projected'
    basicSystem.testImageMimeType = 'image/png'
    basicSystem.testImageAssetId = 'input-basic-asset'
    basicSystem.testVariants = [
      { id: 'a', version: 0, modelKey: 'model-a' },
      { id: 'b', version: 'workspace', modelKey: 'model-b' },
      { id: 'c', version: 'workspace', modelKey: '' },
      { id: 'd', version: 'workspace', modelKey: '' },
    ]
    basicSystem.testVariantResults = {
      a: { result: 'Original result', reasoning: 'Original reasoning' },
      b: { result: 'Workspace result', reasoning: '' },
      c: { result: '', reasoning: '' },
      d: { result: '', reasoning: '' },
    }
    basicSystem.lastActiveAt = 1000

    const proMulti = useProMultiMessageSession(pinia)
    proMulti.conversationMessagesSnapshot = [
      {
        id: 'msg-1',
        role: 'system',
        content: 'Current message',
        originalContent: 'Original message',
      },
    ]
    proMulti.selectedMessageId = 'msg-1'
    proMulti.messageChainMap = { 'msg-1': 'message-chain' }
    proMulti.temporaryVariables = { audience: 'builders' }
    proMulti.testVariants = [
      { id: 'a', version: 'workspace', modelKey: 'model-pro' },
      { id: 'b', version: 'workspace', modelKey: '' },
      { id: 'c', version: 'workspace', modelKey: '' },
      { id: 'd', version: 'workspace', modelKey: '' },
    ]
    proMulti.testVariantResults = {
      a: { result: 'Conversation result', reasoning: '' },
      b: { result: '', reasoning: '' },
      c: { result: '', reasoning: '' },
      d: { result: '', reasoning: '' },
    }
    proMulti.lastActiveAt = 2000

    const multiImage = useImageMultiImageSession(pinia)
    multiImage.originalPrompt = 'Image prompt'
    multiImage.inputImages = [
      {
        id: 'runtime-1',
        assetId: 'input-asset-1',
        b64: 'abc',
        mimeType: 'image/png',
      },
      {
        id: 'runtime-2',
        assetId: null,
        b64: 'def',
        mimeType: 'image/jpeg',
      },
    ]
    multiImage.testVariants = [
      { id: 'a', version: 0, modelKey: 'image-model' },
      { id: 'b', version: 'workspace', modelKey: '' },
      { id: 'c', version: 'workspace', modelKey: '' },
      { id: 'd', version: 'workspace', modelKey: '' },
    ]
    multiImage.testVariantResults = {
      a: {
        images: [{ _type: 'image-ref', id: 'output-asset-1' }],
      },
      b: null,
      c: null,
      d: null,
    }
    multiImage.lastActiveAt = 3000

    const basicSession = manager.getPromptSession('basic-system')
    expect(basicSession).toMatchObject({
      id: 'implicit:basic-system',
      modeKey: 'basic-system',
      draft: {
        content: { kind: 'text', text: 'Optimized system prompt' },
      },
      optimization: {
        id: 'basic-chain',
        root: {
          content: { kind: 'text', text: 'Original system prompt' },
        },
      },
      assetBinding: {
        assetId: 'asset-basic',
        versionId: 'version-basic',
        status: 'linked',
      },
      origin: {
        kind: 'favorite',
        id: 'favorite-basic',
        metadata: { title: 'Basic favorite' },
      },
    })
    expect(basicSession.testRuns[0].runs).toHaveLength(2)
    expect(basicSession.testRuns[0].runs[0]).toMatchObject({
      revision: { kind: 'root', chainId: 'basic-chain' },
      input: {
        text: 'User test input',
        images: [{ kind: 'asset', assetId: 'input-basic-asset' }],
      },
      output: {
        text: 'Original result',
        metadata: { reasoning: 'Original reasoning' },
      },
    })

    const activeSession = manager.getPromptSession()
    expect(activeSession).toMatchObject({
      id: 'implicit:pro-conversation',
      modeKey: 'pro-conversation',
      optimization: {
        id: 'message-chain',
        target: {
          kind: 'message',
          id: 'msg-1',
          role: 'system',
        },
      },
    })
    expect(activeSession.testRuns[0].runs[0]).toMatchObject({
      input: {
        parameters: { audience: 'builders' },
      },
      output: { text: 'Conversation result' },
    })

    const imageSession = manager.getPromptSession('image-multiimage')
    expect(imageSession.testRuns[0].runs[0]).toMatchObject({
      input: {
        images: [
          { kind: 'asset', assetId: 'input-asset-1' },
          { kind: 'url', url: 'data:image/jpeg;base64,def' },
        ],
      },
      output: {
        images: [{ kind: 'asset', assetId: 'output-asset-1' }],
      },
    })

    const registry = manager.getPromptSessionRegistry()
    expect(registry).toMatchObject({
      activeSessionId: 'implicit:pro-conversation',
      activeSessionIdByMode: {
        'basic-system': 'implicit:basic-system',
        'pro-conversation': 'implicit:pro-conversation',
        'image-multiimage': 'implicit:image-multiimage',
      },
      sessions: expect.arrayContaining([
        expect.objectContaining({
          id: 'implicit:basic-system',
          assetBinding: {
            assetId: 'asset-basic',
            versionId: 'version-basic',
            status: 'linked',
          },
          origin: {
            kind: 'favorite',
            id: 'favorite-basic',
            metadata: { title: 'Basic favorite' },
          },
        }),
      ]),
    })
    expect(registry.updatedAt).toBeGreaterThanOrEqual(3000)
    expect(manager.getAllPromptSessions()).toHaveLength(8)
  })

  it('hydrates history chains without changing the synchronous session projection', async () => {
    const historyManager = {
      getChain: vi.fn(async () => createHistoryChain()),
    }
    const { pinia } = createTestPinia({
      historyManager: historyManager as any,
    })
    const manager = useSessionManager(pinia)
    const basicSystem = useBasicSystemSession(pinia)

    basicSystem.prompt = 'Original system prompt'
    basicSystem.optimizedPrompt = 'Optimized system prompt'
    basicSystem.chainId = 'basic-chain'
    basicSystem.testContent = 'User test input'
    basicSystem.testVariants = [
      { id: 'a', version: 2, modelKey: 'model-a' },
      { id: 'b', version: 'workspace', modelKey: 'model-b' },
      { id: 'c', version: 'previous', modelKey: 'model-a' },
      { id: 'd', version: 'workspace', modelKey: '' },
    ]
    basicSystem.testVariantResults = {
      a: { result: 'History result', reasoning: '' },
      b: { result: 'Workspace result', reasoning: '' },
      c: { result: 'Previous result', reasoning: '' },
      d: { result: '', reasoning: '' },
    }

    const syncSession = manager.getPromptSession('basic-system')
    const hydratedSession = await manager.getHydratedPromptSession('basic-system')

    expect(historyManager.getChain).toHaveBeenCalledWith('basic-chain')
    expect(syncSession.optimization.records).toEqual([])
    expect(syncSession.testRuns[0].runs[0].revision).toMatchObject({
      kind: 'record',
      recordId: 'legacy-version:2',
      version: 2,
    })
    expect(hydratedSession.optimization.records.map((record) => record.id)).toEqual([
      'record-1',
      'record-2',
    ])
    expect(hydratedSession.optimization.currentRecordId).toBe('record-2')
    expect(hydratedSession.testRuns[0].runs[0].revision).toEqual({
      kind: 'record',
      chainId: 'basic-chain',
      recordId: 'record-2',
      version: 2,
    })
    expect(hydratedSession.testRuns[0].runs[1].revision).toEqual({
      kind: 'workspace',
      sessionId: 'implicit:basic-system',
    })
    expect(hydratedSession.testRuns[0].runs[2].revision).toEqual({
      kind: 'record',
      chainId: 'basic-chain',
      recordId: 'record-1',
      version: 1,
    })
    expect(manager.getPromptSession('basic-system').testRuns[0].runs[0].revision).toMatchObject({
      kind: 'record',
      recordId: 'legacy-version:2',
    })
  })

  it('returns the synchronous projection when no history manager is available', async () => {
    const { pinia } = createTestPinia()
    const manager = useSessionManager(pinia)
    const basicSystem = useBasicSystemSession(pinia)

    basicSystem.prompt = 'Original system prompt'
    basicSystem.optimizedPrompt = 'Optimized system prompt'
    basicSystem.chainId = 'basic-chain'
    basicSystem.testContent = 'User test input'
    basicSystem.testVariants = [
      { id: 'a', version: 2, modelKey: 'model-a' },
      { id: 'b', version: 'workspace', modelKey: '' },
      { id: 'c', version: 'workspace', modelKey: '' },
      { id: 'd', version: 'workspace', modelKey: '' },
    ]
    basicSystem.testVariantResults = {
      a: { result: 'History result', reasoning: '' },
      b: { result: '', reasoning: '' },
      c: { result: '', reasoning: '' },
      d: { result: '', reasoning: '' },
    }

    const hydratedSession = await manager.getHydratedPromptSession('basic-system')

    expect(hydratedSession.optimization.records).toEqual([])
    expect(hydratedSession.testRuns[0].runs[0].revision).toEqual({
      kind: 'record',
      chainId: 'basic-chain',
      recordId: 'legacy-version:2',
      version: 2,
    })
  })

  it('returns the synchronous projection when history hydration fails', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const historyManager = {
      getChain: vi.fn(async () => {
        throw new Error('history unavailable')
      }),
    }
    const { pinia } = createTestPinia({
      historyManager: historyManager as any,
    })
    const manager = useSessionManager(pinia)
    const basicSystem = useBasicSystemSession(pinia)

    basicSystem.prompt = 'Original system prompt'
    basicSystem.optimizedPrompt = 'Optimized system prompt'
    basicSystem.chainId = 'basic-chain'
    basicSystem.testContent = 'User test input'
    basicSystem.testVariants = [
      { id: 'a', version: 2, modelKey: 'model-a' },
      { id: 'b', version: 'workspace', modelKey: '' },
      { id: 'c', version: 'workspace', modelKey: '' },
      { id: 'd', version: 'workspace', modelKey: '' },
    ]
    basicSystem.testVariantResults = {
      a: { result: 'History result', reasoning: '' },
      b: { result: '', reasoning: '' },
      c: { result: '', reasoning: '' },
      d: { result: '', reasoning: '' },
    }

    try {
      const hydratedSession = await manager.getHydratedPromptSession('basic-system')

      expect(historyManager.getChain).toHaveBeenCalledWith('basic-chain')
      expect(hydratedSession.optimization.records).toEqual([])
      expect(hydratedSession.testRuns[0].runs[0].revision).toEqual({
        kind: 'record',
        chainId: 'basic-chain',
        recordId: 'legacy-version:2',
        version: 2,
      })
    } finally {
      consoleWarnSpy.mockRestore()
    }
  })

  it('clears asset bindings when session content is cleared', () => {
    const { pinia } = createTestPinia()

    const basicSystem = useBasicSystemSession(pinia)
    basicSystem.assetBinding = { assetId: 'asset-basic', versionId: 'v1', status: 'linked' }
    basicSystem.origin = { kind: 'favorite', id: 'favorite-basic' }
    basicSystem.clearContent({ persist: false })
    expect(basicSystem.assetBinding).toBeUndefined()
    expect(basicSystem.origin).toBeUndefined()

    const proMulti = useProMultiMessageSession(pinia)
    proMulti.assetBinding = { assetId: 'asset-pro', versionId: 'v2', status: 'linked' }
    proMulti.origin = { kind: 'favorite', id: 'favorite-pro' }
    proMulti.clearContent({ persist: false })
    expect(proMulti.assetBinding).toBeUndefined()
    expect(proMulti.origin).toBeUndefined()

    const imageImage = useImageImage2ImageSession(pinia)
    imageImage.assetBinding = { assetId: 'asset-image', versionId: 'v3', status: 'linked' }
    imageImage.origin = { kind: 'favorite', id: 'favorite-image' }
    imageImage.clearContent({ persist: false })
    expect(imageImage.assetBinding).toBeUndefined()
    expect(imageImage.origin).toBeUndefined()
  })

  it('preserves unsaved image2image input image data in normalized test runs', () => {
    const { pinia } = createTestPinia()
    const manager = useSessionManager(pinia)
    const imageImage = useImageImage2ImageSession(pinia)

    imageImage.originalPrompt = 'Restyle the image'
    imageImage.inputImageB64 = 'raw-input'
    imageImage.inputImageMime = 'image/webp'
    imageImage.testVariants = [
      { id: 'a', version: 'workspace', modelKey: 'image-model' },
      { id: 'b', version: 'workspace', modelKey: '' },
      { id: 'c', version: 'workspace', modelKey: '' },
      { id: 'd', version: 'workspace', modelKey: '' },
    ]
    imageImage.testVariantResults = {
      a: {
        images: [{ _type: 'image-ref', id: 'output-asset' }],
      },
      b: null,
      c: null,
      d: null,
    }

    const session = manager.getPromptSession('image-image2image')
    expect(session.testRuns[0].runs[0]).toMatchObject({
      input: {
        images: [{ kind: 'url', url: 'data:image/webp;base64,raw-input' }],
      },
      output: {
        images: [{ kind: 'asset', assetId: 'output-asset' }],
      },
    })
  })

  it('does not project unsaved Basic/System base64 when no persisted asset id exists', () => {
    const { pinia } = createTestPinia()
    const manager = useSessionManager(pinia)
    const basicSystem = useBasicSystemSession(pinia)

    basicSystem.prompt = 'System prompt'
    basicSystem.testContent = 'Question'
    basicSystem.testImageB64 = 'UNSAVED_BASIC_IMAGE'
    basicSystem.testImageMimeType = 'image/jpeg'
    basicSystem.testImageAssetId = null
    basicSystem.testVariants = [
      { id: 'a', version: 0, modelKey: 'model-a' },
      { id: 'b', version: 'workspace', modelKey: '' },
      { id: 'c', version: 'workspace', modelKey: '' },
      { id: 'd', version: 'workspace', modelKey: '' },
    ]
    basicSystem.testVariantResults = {
      a: { result: 'Answer', reasoning: '' },
      b: { result: '', reasoning: '' },
      c: { result: '', reasoning: '' },
      d: { result: '', reasoning: '' },
    }

    const session = manager.getPromptSession('basic-system')

    expect(session.testRuns[0].runs[0].input).toEqual({ text: 'Question' })
    expect(JSON.stringify(session)).not.toContain('UNSAVED_BASIC_IMAGE')
    expect(JSON.stringify(session)).not.toContain('data:image/')
  })
})
