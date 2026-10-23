import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import type { PromptRecord, PromptRecordChain } from '@prompt-optimizer/core'
import type { MessageReactive } from 'naive-ui'

import { useAppHistoryRestore } from '../../../src/composables/app/useAppHistoryRestore'
import { setGlobalMessageApi } from '../../../src/composables/ui/useToast'

const createReactive = (): MessageReactive =>
  ({
    destroy: () => {},
  } as unknown as MessageReactive)

const createImageRecord = (type: PromptRecord['type']): PromptRecord => ({
  id: 'record-1',
  chainId: 'chain-1',
  originalPrompt: '把图1和图2融合成一个电影感画面',
  optimizedPrompt: '优化后的多图提示词',
  version: 1,
  type,
  timestamp: Date.now(),
  modelKey: 'gemini',
  templateId: 'multiimage-optimize',
  metadata: {
    functionMode: 'image',
    imageModelKey: 'imagen',
    compareMode: true,
  },
})

const createBasicRecord = (type: PromptRecord['type']): PromptRecord => ({
  id: 'record-basic-1',
  chainId: 'chain-basic-1',
  originalPrompt: 'Optimize this prompt',
  optimizedPrompt: 'Optimized prompt',
  version: 1,
  type,
  timestamp: Date.now(),
  modelKey: 'gemini',
  metadata: {
    optimizationMode: 'system',
  },
})

describe('useAppHistoryRestore', () => {
  it('restores multiimage history into image-multiimage mode', async () => {
    setGlobalMessageApi({
      success: vi.fn(() => createReactive()),
      error: vi.fn(() => createReactive()),
      warning: vi.fn(() => createReactive()),
      info: vi.fn(() => createReactive()),
    })

    const navigateToSubModeKey = vi.fn()
    const handleSelectHistory = vi.fn()
    const saveSessionForTargetKey = vi.fn()

    const record = createImageRecord('multiimageOptimize')
    const chain: PromptRecordChain = {
      chainId: 'chain-1',
      rootRecord: record,
      currentRecord: record,
      versions: [record],
    }

    const { handleHistoryReuse } = useAppHistoryRestore({
      services: ref(null),
      navigateToSubModeKey,
      handleContextModeChange: vi.fn(async () => {}),
      handleSelectHistory,
      proMultiMessageSession: {
        updateConversationMessages: vi.fn(),
        setMessageChainMap: vi.fn(),
        conversationMessagesSnapshot: [],
      } as any,
      systemWorkspaceRef: ref(null),
      userWorkspaceRef: ref(null),
      t: (key: string) => key,
      isLoadingExternalData: ref(false),
      saveSessionForTargetKey,
    })

    await handleHistoryReuse({
      record,
      chainId: chain.chainId,
      rootPrompt: chain.rootRecord.originalPrompt,
      chain,
    })

    expect(navigateToSubModeKey).toHaveBeenCalledWith('image-multiimage')
    expect(handleSelectHistory).not.toHaveBeenCalled()
    expect(saveSessionForTargetKey).toHaveBeenCalledWith('image-multiimage')
  })

  it('waits for workspace navigation before restoring basic history data', async () => {
    setGlobalMessageApi({
      success: vi.fn(() => createReactive()),
      error: vi.fn(() => createReactive()),
      warning: vi.fn(() => createReactive()),
      info: vi.fn(() => createReactive()),
    })

    const order: string[] = []
    const navigateToSubModeKey = vi.fn(async () => {
      order.push('navigation-started')
      await Promise.resolve()
      order.push('navigation-finished')
    })
    const handleSelectHistory = vi.fn(async () => {
      order.push('history-selected')
    })
    const restoreSourceBindingForTargetKey = vi.fn()
    const saveSessionForTargetKey = vi.fn(async () => {
      order.push('session-saved')
    })

    const record = createBasicRecord('optimize')
    record.metadata = {
      ...record.metadata,
      assetBinding: { assetId: 'asset-linked', versionId: 'version-linked', status: 'linked' },
      origin: { kind: 'favorite', id: 'favorite-linked' },
    }
    const chain: PromptRecordChain = {
      chainId: 'chain-basic-1',
      rootRecord: record,
      currentRecord: record,
      versions: [record],
    }

    const { handleHistoryReuse } = useAppHistoryRestore({
      services: ref(null),
      navigateToSubModeKey,
      handleContextModeChange: vi.fn(async () => {}),
      handleSelectHistory,
      proMultiMessageSession: {
        updateConversationMessages: vi.fn(),
        setMessageChainMap: vi.fn(),
        conversationMessagesSnapshot: [],
      } as any,
      systemWorkspaceRef: ref(null),
      userWorkspaceRef: ref(null),
      t: (key: string) => key,
      isLoadingExternalData: ref(false),
      restoreSourceBindingForTargetKey,
      saveSessionForTargetKey,
    })

    await handleHistoryReuse({
      record,
      chainId: chain.chainId,
      rootPrompt: chain.rootRecord.originalPrompt,
      chain,
    })

    expect(navigateToSubModeKey).toHaveBeenCalledWith('basic-system')
    expect(order).toEqual(['navigation-started', 'navigation-finished', 'history-selected', 'session-saved'])
    expect(restoreSourceBindingForTargetKey).toHaveBeenCalledWith('basic-system', {
      assetBinding: { assetId: 'asset-linked', versionId: 'version-linked', status: 'linked' },
      origin: { kind: 'favorite', id: 'favorite-linked' },
    })
    expect(saveSessionForTargetKey).toHaveBeenCalledWith('basic-system')
  })

  it('persists pro-user session after component-specific history restore', async () => {
    setGlobalMessageApi({
      success: vi.fn(() => createReactive()),
      error: vi.fn(() => createReactive()),
      warning: vi.fn(() => createReactive()),
      info: vi.fn(() => createReactive()),
    })

    const order: string[] = []
    const navigateToSubModeKey = vi.fn(async () => {
      order.push('navigation-finished')
    })
    const handleSelectHistory = vi.fn(async () => {
      order.push('history-selected')
    })
    const restoreFromHistory = vi.fn(async () => {
      order.push('user-restored')
    })
    const saveSessionForTargetKey = vi.fn(async () => {
      order.push('session-saved')
    })

    const record = createBasicRecord('contextUserOptimize')
    record.metadata = { optimizationMode: 'user' }
    const chain: PromptRecordChain = {
      chainId: 'chain-pro-user-1',
      rootRecord: record,
      currentRecord: record,
      versions: [record],
    }

    const { handleHistoryReuse } = useAppHistoryRestore({
      services: ref(null),
      navigateToSubModeKey,
      handleContextModeChange: vi.fn(async () => {}),
      handleSelectHistory,
      proMultiMessageSession: {
        updateConversationMessages: vi.fn(),
        setMessageChainMap: vi.fn(),
        conversationMessagesSnapshot: [],
      } as any,
      systemWorkspaceRef: ref(null),
      userWorkspaceRef: ref({ restoreFromHistory }),
      t: (key: string) => key,
      isLoadingExternalData: ref(false),
      saveSessionForTargetKey,
    })

    await handleHistoryReuse({
      record,
      chainId: chain.chainId,
      rootPrompt: chain.rootRecord.originalPrompt,
      chain,
    })

    expect(navigateToSubModeKey).toHaveBeenCalledWith('pro-variable')
    expect(restoreFromHistory).toHaveBeenCalledWith({ record, chain, rootPrompt: chain.rootRecord.originalPrompt })
    expect(saveSessionForTargetKey).toHaveBeenCalledWith('pro-variable')
    expect(order).toEqual(['navigation-finished', 'history-selected', 'user-restored', 'session-saved'])
  })

  it('persists pro-system session after message history restore', async () => {
    setGlobalMessageApi({
      success: vi.fn(() => createReactive()),
      error: vi.fn(() => createReactive()),
      warning: vi.fn(() => createReactive()),
      info: vi.fn(() => createReactive()),
    })

    const order: string[] = []
    const navigateToSubModeKey = vi.fn(async () => {
      order.push('navigation-finished')
    })
    const handleSelectHistory = vi.fn(async () => {
      order.push('history-selected')
    })
    const restoreFromHistory = vi.fn(async () => {
      order.push('system-restored')
    })
    const saveSessionForTargetKey = vi.fn(async () => {
      order.push('session-saved')
    })

    const record = createBasicRecord('conversationMessageOptimize')
    record.metadata = {
      optimizationMode: 'system',
      messageId: 'msg-1',
      conversationSnapshot: [
        {
          id: 'msg-1',
          role: 'system',
          content: 'optimized system message',
          originalContent: 'system message',
          chainId: 'chain-pro-system-1',
          appliedVersion: 1,
        },
      ],
    }
    const chain: PromptRecordChain = {
      chainId: 'chain-pro-system-1',
      rootRecord: record,
      currentRecord: record,
      versions: [record],
    }
    const proMultiMessageSession = {
      updateConversationMessages: vi.fn((messages) => {
        proMultiMessageSession.conversationMessagesSnapshot = messages
      }),
      setMessageChainMap: vi.fn(),
      conversationMessagesSnapshot: [] as any[],
    }

    const { handleHistoryReuse } = useAppHistoryRestore({
      services: ref({
        historyManager: {
          getChain: vi.fn(async () => chain),
        },
      } as any),
      navigateToSubModeKey,
      handleContextModeChange: vi.fn(async () => {}),
      handleSelectHistory,
      proMultiMessageSession: proMultiMessageSession as any,
      systemWorkspaceRef: ref({ restoreFromHistory }),
      userWorkspaceRef: ref(null),
      t: (key: string) => key,
      isLoadingExternalData: ref(false),
      saveSessionForTargetKey,
    })

    await handleHistoryReuse({
      record,
      chainId: chain.chainId,
      rootPrompt: chain.rootRecord.originalPrompt,
      chain,
    })

    expect(navigateToSubModeKey).toHaveBeenCalledWith('pro-multi')
    expect(restoreFromHistory).toHaveBeenCalled()
    expect(saveSessionForTargetKey).toHaveBeenCalledWith('pro-multi')
    expect(order).toEqual(['navigation-finished', 'history-selected', 'system-restored', 'session-saved'])
  })

  it('logs history restore failures with an English runtime message', async () => {
    const error = vi.fn(() => createReactive())
    setGlobalMessageApi({
      success: vi.fn(() => createReactive()),
      error,
      warning: vi.fn(() => createReactive()),
      info: vi.fn(() => createReactive()),
    })

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const navigateToSubModeKey = vi.fn()
    const handleSelectHistory = vi.fn(async () => {
      throw new Error('boom')
    })

    const record = createBasicRecord('optimize')
    const chain: PromptRecordChain = {
      chainId: 'chain-basic-1',
      rootRecord: record,
      currentRecord: record,
      versions: [record],
    }

    const { handleHistoryReuse } = useAppHistoryRestore({
      services: ref(null),
      navigateToSubModeKey,
      handleContextModeChange: vi.fn(async () => {}),
      handleSelectHistory,
      proMultiMessageSession: {
        updateConversationMessages: vi.fn(),
        setMessageChainMap: vi.fn(),
        conversationMessagesSnapshot: [],
      } as any,
      systemWorkspaceRef: ref(null),
      userWorkspaceRef: ref(null),
      t: (key: string, params?: Record<string, unknown>) =>
        key === 'toast.error.historyRestoreFailed'
          ? `history restore failed: ${String(params?.error ?? '')}`
          : key,
      isLoadingExternalData: ref(false),
    })

    await handleHistoryReuse({
      record,
      chainId: chain.chainId,
      rootPrompt: chain.rootRecord.originalPrompt,
      chain,
    })

    expect(consoleErrorSpy).toHaveBeenCalledWith('[App] Failed to restore history:', expect.any(Error))
    expect(error).toHaveBeenCalledWith(
      'history restore failed: boom',
      expect.objectContaining({
        closable: true,
        duration: 3000,
        keepAliveOnHover: true,
      }),
    )

    consoleErrorSpy.mockRestore()
  })
  it('leaves the workspace unchanged when history replacement is declined', async () => {
    const record = createBasicRecord('optimize')
    const chain = { chainId: record.chainId!, rootRecord: record, currentRecord: record, versions: [record] }
    const navigate = vi.fn()
    const select = vi.fn()
    const beforeApplyToWorkspace = vi.fn(async () => false)
    const loading = ref(false)
    const { handleHistoryReuse } = useAppHistoryRestore({
      services: ref(null), navigateToSubModeKey: navigate, beforeApplyToWorkspace,
      handleContextModeChange: vi.fn(), handleSelectHistory: select,
      proMultiMessageSession: { conversationMessagesSnapshot: [] } as any,
      systemWorkspaceRef: ref(null), userWorkspaceRef: ref(null), t: key => key,
      isLoadingExternalData: loading,
    })
    await handleHistoryReuse({ record, chain, chainId: chain.chainId, rootPrompt: record.originalPrompt })
    expect(beforeApplyToWorkspace).toHaveBeenCalledWith('basic-system')
    expect(navigate).not.toHaveBeenCalled()
    expect(select).not.toHaveBeenCalled()
    expect(loading.value).toBe(false)
  })

})
