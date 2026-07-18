import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import type { MessageReactive } from 'naive-ui'
import {
  PROMPT_MODEL_SCHEMA_VERSION,
  createPromptContract,
  type FavoritePrompt,
  type PromptAsset,
  type PromptRecord,
} from '@prompt-optimizer/core'

import { useAppFavorite, type SaveFavoriteData } from '../../../src/composables/app/useAppFavorite'
import { setGlobalMessageApi } from '../../../src/composables/ui/useToast'
import { parseFavoriteReproducibilityFromMetadata } from '../../../src/utils/favorite-reproducibility'

const createReactive = (): MessageReactive =>
  ({
    destroy: () => {},
  } as unknown as MessageReactive)

const createPromptAsset = (overrides: Partial<PromptAsset> = {}): PromptAsset => ({
  schemaVersion: PROMPT_MODEL_SCHEMA_VERSION,
  id: 'asset-1',
  title: 'Asset prompt',
  tags: [],
  contract: createPromptContract('basic-system'),
  currentVersionId: 'version-1',
  versions: [
    {
      id: 'version-1',
      version: 1,
      content: { kind: 'text', text: 'Asset prompt content' },
      createdAt: 1,
    },
  ],
  examples: [],
  createdAt: 1,
  updatedAt: 2,
  ...overrides,
})

describe('useAppFavorite', () => {
  it('prefills reproducibility variables from basic prompt placeholders when saving', () => {
    const { handleSaveFavorite, saveFavoriteData } = useAppFavorite({
      navigateToSubModeKey: vi.fn(async () => {}),
      handleContextModeChange: vi.fn(async () => {}),
      optimizerPrompt: ref(''),
      t: (key: string) => key,
      isLoadingExternalData: ref(false),
      getCurrentFunctionMode: () => 'basic',
      getCurrentOptimizationMode: () => 'system',
    })

    handleSaveFavorite({
      content: 'Optimize {{topic}} for {{audience}}',
      originalContent: 'Draft {{sourceOnly}}',
    })

    const data = saveFavoriteData.value as SaveFavoriteData
    expect(data.prefill?.functionMode).toBe('basic')
    expect(data.prefill?.optimizationMode).toBe('system')
    const reproducibility = parseFavoriteReproducibilityFromMetadata(data.prefill?.metadata)
    expect(reproducibility.variables.map((variable) => variable.name)).toEqual(['topic', 'audience'])
    expect(reproducibility.examples).toEqual([])
  })

  it('uses the current session source asset as the save target candidate', () => {
    const { handleSaveFavorite, saveFavoriteData } = useAppFavorite({
      navigateToSubModeKey: vi.fn(async () => {}),
      handleContextModeChange: vi.fn(async () => {}),
      optimizerPrompt: ref(''),
      t: (key: string) => key,
      isLoadingExternalData: ref(false),
      getCurrentFunctionMode: () => 'basic',
      getCurrentOptimizationMode: () => 'system',
      basicSystemSession: {
        updateAssetBinding: vi.fn(),
        assetBinding: { assetId: 'asset-linked', versionId: 'version-linked', status: 'linked' },
        origin: { kind: 'favorite', id: 'favorite-linked' },
      },
    })

    handleSaveFavorite({ content: 'Optimize {{topic}}' })

    expect(saveFavoriteData.value?.candidateSource).toEqual({
      favoriteId: 'favorite-linked',
      assetId: 'asset-linked',
      versionId: 'version-linked',
    })
  })

  it('binds the current session to the favorite saved from the workspace', async () => {
    const updateAssetBinding = vi.fn()
    const favorite: FavoritePrompt = {
      id: 'favorite-created',
      title: 'Created favorite',
      content: 'Created prompt',
      createdAt: 1,
      updatedAt: 2,
      tags: [],
      useCount: 0,
      functionMode: 'basic',
      optimizationMode: 'system',
      metadata: {
        promptAsset: createPromptAsset({
          id: 'asset-created',
          currentVersionId: 'version-created',
        }),
      },
    }

    const { handleSaveFavoriteComplete } = useAppFavorite({
      navigateToSubModeKey: vi.fn(async () => {}),
      handleContextModeChange: vi.fn(async () => {}),
      optimizerPrompt: ref(''),
      t: (key: string) => key,
      isLoadingExternalData: ref(false),
      getCurrentFunctionMode: () => 'basic',
      getCurrentOptimizationMode: () => 'system',
      getFavoriteManager: () => ({
        getFavorites: vi.fn(async () => [favorite]),
      } as any),
      basicSystemSession: {
        updateAssetBinding,
      },
    })

    await handleSaveFavoriteComplete('favorite-created')

    expect(updateAssetBinding).toHaveBeenCalledWith(
      {
        assetId: 'asset-created',
        versionId: 'version-created',
        status: 'linked',
      },
      {
        kind: 'favorite',
        id: 'favorite-created',
        metadata: expect.objectContaining({
          title: 'Created favorite',
          assetId: 'asset-created',
          versionId: 'version-created',
        }),
      },
    )
  })

  it('uses explicit reproducibility draft for save-as-example without workspace-current', () => {
    const { handleSaveFavorite, saveFavoriteData } = useAppFavorite({
      navigateToSubModeKey: vi.fn(async () => {}),
      handleContextModeChange: vi.fn(async () => {}),
      optimizerPrompt: ref(''),
      t: (key: string) => key,
      isLoadingExternalData: ref(false),
      getCurrentFunctionMode: () => 'basic',
      getCurrentOptimizationMode: () => 'system',
    })

    handleSaveFavorite({
      content: 'Optimize {{topic}}',
      prefill: {
        reproducibilityDraft: {
          variables: [
            {
              name: 'topic',
              required: false,
              options: [],
              source: 'test-run',
            },
          ],
          examples: [
            {
              id: 'test-run:run-1',
              text: 'Optimize release notes',
              parameters: { topic: 'release' },
              outputText: 'Optimized release notes.',
              images: [],
              imageAssetIds: [],
              inputImages: [],
              inputImageAssetIds: [],
              metadata: { testRunId: 'run-1' },
            },
          ],
        },
      },
    })

    const data = saveFavoriteData.value as SaveFavoriteData
    const reproducibility = parseFavoriteReproducibilityFromMetadata(data.prefill?.metadata)
    expect(reproducibility.variables).toEqual([
      expect.objectContaining({ name: 'topic', source: 'test-run' }),
    ])
    expect(reproducibility.examples).toHaveLength(1)
    expect(reproducibility.examples[0]).toMatchObject({
      id: 'ex-001',
      text: 'Optimize release notes',
      parameters: { topic: 'release' },
      outputText: 'Optimized release notes.',
      metadata: { testRunId: 'run-1' },
    })
    expect(data.prefill?.reproducibilityDraft?.examples[0]?.id).toBe('ex-001')
    expect(data.prefill?.reproducibilityDraft?.examples[0]?.parameters).toEqual({ topic: 'release' })
    expect(reproducibility.examples.map((example) => example.id)).not.toContain('workspace-current')
  })

  it('prefills pro-variable definitions without temporary values when saving', () => {
    const { handleSaveFavorite, saveFavoriteData } = useAppFavorite({
      navigateToSubModeKey: vi.fn(async () => {}),
      handleContextModeChange: vi.fn(async () => {}),
      optimizerPrompt: ref(''),
      t: (key: string) => key,
      isLoadingExternalData: ref(false),
      getCurrentFunctionMode: () => 'pro',
      getCurrentOptimizationMode: () => 'user',
      proVariableSession: {
        getTemporaryVariable: vi.fn(),
        setTemporaryVariable: vi.fn(),
        clearTemporaryVariables: vi.fn(),
        temporaryVariables: { topic: '收藏主题', invalid: 12 } as unknown as Record<string, string>,
      },
    })

    handleSaveFavorite({ content: 'Write about {{topic}}' })

    const data = saveFavoriteData.value as SaveFavoriteData
    expect(data.prefill?.functionMode).toBe('context')
    expect(data.prefill?.optimizationMode).toBe('user')
    const reproducibility = parseFavoriteReproducibilityFromMetadata(data.prefill?.metadata)
    expect(reproducibility.variables).toEqual([
      expect.objectContaining({ name: 'topic', source: 'workspace' }),
    ])
    expect(reproducibility.variables[0]?.defaultValue).toBeUndefined()
    const rawReproducibility = data.prefill?.metadata?.reproducibility as { variables?: Array<Record<string, unknown>> } | undefined
    expect(rawReproducibility?.variables?.[0]).not.toHaveProperty('defaultValue')
    expect(reproducibility.examples).toEqual([])
  })

  it('preserves temporary variable named value as a variable definition when saving favorites', () => {
    const { handleSaveFavorite, saveFavoriteData } = useAppFavorite({
      navigateToSubModeKey: vi.fn(async () => {}),
      handleContextModeChange: vi.fn(async () => {}),
      optimizerPrompt: ref(''),
      t: (key: string) => key,
      isLoadingExternalData: ref(false),
      getCurrentFunctionMode: () => 'pro',
      getCurrentOptimizationMode: () => 'user',
      proVariableSession: {
        getTemporaryVariable: vi.fn(),
        setTemporaryVariable: vi.fn(),
        clearTemporaryVariables: vi.fn(),
        temporaryVariables: { value: '保留 value 变量', topic: '主题' },
      },
    })

    handleSaveFavorite({ content: 'Use {{value}} for {{topic}}' })

    const data = saveFavoriteData.value as SaveFavoriteData
    const reproducibility = parseFavoriteReproducibilityFromMetadata(data.prefill?.metadata)
    expect(reproducibility.variables.map((variable) => variable.name)).toEqual(['value', 'topic'])
    expect(reproducibility.variables).toEqual([
      expect.objectContaining({ name: 'value', source: 'workspace' }),
      expect.objectContaining({ name: 'topic', source: 'workspace' }),
    ])
    expect(reproducibility.variables[0]?.defaultValue).toBeUndefined()
    expect(reproducibility.variables[1]?.defaultValue).toBeUndefined()
    const rawReproducibility = data.prefill?.metadata?.reproducibility as { variables?: Array<Record<string, unknown>> } | undefined
    expect(rawReproducibility?.variables?.[0]).not.toHaveProperty('defaultValue')
    expect(rawReproducibility?.variables?.[1]).not.toHaveProperty('defaultValue')
    expect(reproducibility.examples).toEqual([])
  })

  it('does not prefill image input asset references when saving workspace favorites', () => {
    const { handleSaveFavorite, saveFavoriteData } = useAppFavorite({
      navigateToSubModeKey: vi.fn(async () => {}),
      handleContextModeChange: vi.fn(async () => {}),
      optimizerPrompt: ref(''),
      t: (key: string) => key,
      isLoadingExternalData: ref(false),
      getCurrentFunctionMode: () => 'image',
      getCurrentOptimizationMode: () => 'user',
      getCurrentImageSubMode: () => 'multiimage',
      imageMultiImageSession: {
        getTemporaryVariable: vi.fn(),
        setTemporaryVariable: vi.fn(),
        clearTemporaryVariables: vi.fn(),
        replaceInputImages: vi.fn(),
        temporaryVariables: { scene: '夜晚花园' },
      },
    })

    handleSaveFavorite({ content: 'Generate {{scene}}' })

    const data = saveFavoriteData.value as SaveFavoriteData
    expect(data.prefill?.functionMode).toBe('image')
    expect(data.prefill?.imageSubMode).toBe('multiimage')
    const reproducibility = parseFavoriteReproducibilityFromMetadata(data.prefill?.metadata)
    expect(reproducibility.variables).toEqual([
      expect.objectContaining({ name: 'scene', source: 'workspace' }),
    ])
    expect(reproducibility.variables[0]?.defaultValue).toBeUndefined()
    const rawReproducibility = data.prefill?.metadata?.reproducibility as { variables?: Array<Record<string, unknown>> } | undefined
    expect(rawReproducibility?.variables?.[0]).not.toHaveProperty('defaultValue')
    expect(reproducibility.examples).toEqual([])
  })

  it('preserves caller-provided Garden reproducibility metadata when saving', () => {
    const gardenSnapshot = {
      variables: [{ name: 'gardenVar', defaultValue: 'garden default' }],
      assets: {
        examples: [
          {
            id: 'garden-example',
            text: 'Garden example',
            parameters: { gardenVar: 'from garden' },
          },
        ],
      },
    }
    const { handleSaveFavorite, saveFavoriteData } = useAppFavorite({
      navigateToSubModeKey: vi.fn(async () => {}),
      handleContextModeChange: vi.fn(async () => {}),
      optimizerPrompt: ref(''),
      t: (key: string) => key,
      isLoadingExternalData: ref(false),
      getCurrentFunctionMode: () => 'basic',
      getCurrentOptimizationMode: () => 'system',
    })

    handleSaveFavorite({
      content: 'Workspace {{topic}}',
      prefill: {
        metadata: {
          gardenSnapshot,
        },
      },
    })

    const data = saveFavoriteData.value as SaveFavoriteData
    expect(data.prefill?.metadata?.gardenSnapshot).toEqual(gardenSnapshot)
    const reproducibility = parseFavoriteReproducibilityFromMetadata(data.prefill?.metadata)
    expect(reproducibility.variables.map((variable) => variable.name)).toEqual(['gardenVar'])
    expect(reproducibility.examples.map((example) => example.id)).toEqual(['garden-example'])
  })

  it('stores explicit example drafts beside Garden metadata without mutating the snapshot', () => {
    const gardenSnapshot = {
      variables: [{ name: 'gardenVar', defaultValue: 'garden default' }],
      assets: {
        examples: [
          {
            id: 'garden-example',
            text: 'Garden example',
            parameters: { gardenVar: 'from garden' },
          },
        ],
      },
    }
    const { handleSaveFavorite, saveFavoriteData } = useAppFavorite({
      navigateToSubModeKey: vi.fn(async () => {}),
      handleContextModeChange: vi.fn(async () => {}),
      optimizerPrompt: ref(''),
      t: (key: string) => key,
      isLoadingExternalData: ref(false),
      getCurrentFunctionMode: () => 'basic',
      getCurrentOptimizationMode: () => 'system',
    })

    handleSaveFavorite({
      content: 'Workspace {{topic}}',
      prefill: {
        metadata: {
          gardenSnapshot,
        },
        reproducibilityDraft: {
          variables: [
            {
              name: 'topic',
              required: false,
              options: [],
              source: 'test-run',
            },
          ],
          examples: [
            {
              id: 'test-run:run-1',
              text: 'Workspace example',
              parameters: { topic: 'release' },
              outputText: 'Result',
              images: [],
              imageAssetIds: [],
              inputImages: [],
              inputImageAssetIds: [],
            },
          ],
        },
      },
    })

    const data = saveFavoriteData.value as SaveFavoriteData
    expect(data.prefill?.metadata?.gardenSnapshot).toEqual(gardenSnapshot)
    const rawReproducibility = data.prefill?.metadata?.reproducibility as {
      variables?: Array<Record<string, unknown>>
      examples?: Array<Record<string, unknown>>
    } | undefined
    expect(rawReproducibility?.variables?.[0]).toMatchObject({ name: 'topic', source: 'test-run' })
    expect(rawReproducibility?.examples?.[0]).toMatchObject({
      id: 'ex-001',
      text: 'Workspace example',
      outputText: 'Result',
    })
    expect(gardenSnapshot.assets.examples[0]?.id).toBe('garden-example')
  })

  it('waits for workspace navigation before resolving a normal favorite load', async () => {
    const success = vi.fn(() => createReactive())
    setGlobalMessageApi({
      success,
      error: vi.fn(() => createReactive()),
      warning: vi.fn(() => createReactive()),
      info: vi.fn(() => createReactive()),
    })

    const optimizerPrompt = ref('')
    const order: string[] = []
    const navigateToSubModeKey = vi.fn(async () => {
      order.push('navigation-started')
      await Promise.resolve()
      order.push('navigation-finished')
    })

    const { handleUseFavorite } = useAppFavorite({
      navigateToSubModeKey,
      handleContextModeChange: vi.fn(async () => {}),
      optimizerPrompt,
      t: (key: string) => key,
      isLoadingExternalData: ref(false),
    })

    const used = await handleUseFavorite({
      content: 'favorite prompt',
      functionMode: 'basic',
      optimizationMode: 'system',
    })

    expect(used).toBe(true)
    expect(navigateToSubModeKey).toHaveBeenCalledWith('basic-system')
    expect(order).toEqual(['navigation-started', 'navigation-finished'])
    expect(optimizerPrompt.value).toBe('favorite prompt')
    expect(success).toHaveBeenCalled()
  })

  it('clears basic workspace state before applying a favorite', async () => {
    const success = vi.fn(() => createReactive())
    setGlobalMessageApi({
      success,
      error: vi.fn(() => createReactive()),
      warning: vi.fn(() => createReactive()),
      info: vi.fn(() => createReactive()),
    })

    const optimizerPrompt = ref('')
    const optimizerCurrentVersions = ref([{ id: 'old-version' } as PromptRecord])
    const clearContent = vi.fn()
    const updatePrompt = vi.fn()

    const { handleUseFavorite } = useAppFavorite({
      navigateToSubModeKey: vi.fn(async () => {}),
      handleContextModeChange: vi.fn(async () => {}),
      optimizerPrompt,
      t: (key: string) => key,
      isLoadingExternalData: ref(false),
      basicSystemSession: {
        clearContent,
        updatePrompt,
      },
      optimizerCurrentVersions,
    })

    const used = await handleUseFavorite({
      content: 'clean favorite prompt',
      functionMode: 'basic',
      optimizationMode: 'system',
    })

    expect(used).toBe(true)
    expect(clearContent).toHaveBeenCalledWith({ persist: false })
    expect(optimizerCurrentVersions.value).toEqual([])
    expect(optimizerPrompt.value).toBe('clean favorite prompt')
    expect(updatePrompt).toHaveBeenCalledWith('clean favorite prompt')
    expect(success).toHaveBeenCalled()
  })

  it('rebuilds pro-variable temporary variables from a favorite without keeping stale values', async () => {
    const success = vi.fn(() => createReactive())
    setGlobalMessageApi({
      success,
      error: vi.fn(() => createReactive()),
      warning: vi.fn(() => createReactive()),
      info: vi.fn(() => createReactive()),
    })

    const optimizerPrompt = ref('')
    const temporaryVariables: Record<string, string> = {
      topic: 'old topic',
      obsolete: 'remove me',
    }
    const proVariableSession = {
      getTemporaryVariable: vi.fn((name: string) => temporaryVariables[name]),
      setTemporaryVariable: vi.fn((name: string, value: string) => {
        temporaryVariables[name] = value
      }),
      clearTemporaryVariables: vi.fn(() => {
        for (const key of Object.keys(temporaryVariables)) delete temporaryVariables[key]
      }),
      clearContent: vi.fn(() => {
        for (const key of Object.keys(temporaryVariables)) delete temporaryVariables[key]
      }),
      updatePrompt: vi.fn(),
    }

    const { handleUseFavorite } = useAppFavorite({
      navigateToSubModeKey: vi.fn(async () => {}),
      handleContextModeChange: vi.fn(async () => {}),
      optimizerPrompt,
      t: (key: string) => key,
      isLoadingExternalData: ref(false),
      proVariableSession,
    })

    const used = await handleUseFavorite({
      content: 'Write about {{topic}} in {{tone}}',
      functionMode: 'context',
      optimizationMode: 'user',
      metadata: {
        reproducibility: {
          variables: [
            { name: 'topic', defaultValue: 'default topic' },
            { name: 'tone', defaultValue: 'formal' },
          ],
          examples: [],
        },
      },
    })

    expect(used).toBe(true)
    expect(proVariableSession.clearContent).toHaveBeenCalledWith({ persist: false })
    expect(proVariableSession.clearTemporaryVariables).toHaveBeenCalled()
    expect(temporaryVariables).toEqual({
      topic: 'default topic',
      tone: 'formal',
    })
    expect(proVariableSession.updatePrompt).toHaveBeenCalledWith('Write about {{topic}} in {{tone}}')
    expect(success).toHaveBeenCalled()
  })

  it('keeps legacy default routing without syncing an omitted optimization mode', async () => {
    const success = vi.fn(() => createReactive())
    setGlobalMessageApi({
      success,
      error: vi.fn(() => createReactive()),
      warning: vi.fn(() => createReactive()),
      info: vi.fn(() => createReactive()),
    })

    const optimizerPrompt = ref('')
    const navigateToSubModeKey = vi.fn(async () => {})
    const handleContextModeChange = vi.fn(async () => {})
    const updateAssetBinding = vi.fn()
    const updateTestContent = vi.fn()
    const { handleUseFavorite } = useAppFavorite({
      navigateToSubModeKey,
      handleContextModeChange,
      optimizerPrompt,
      t: (key: string) => key,
      isLoadingExternalData: ref(false),
      proVariableSession: {
        getTemporaryVariable: vi.fn(),
        setTemporaryVariable: vi.fn(),
        clearTemporaryVariables: vi.fn(),
        updateAssetBinding,
      },
    })

    const used = await handleUseFavorite({
      id: 'favorite-legacy',
      content: 'legacy pro favorite',
      functionMode: 'context',
    })

    expect(used).toBe(true)
    expect(navigateToSubModeKey).toHaveBeenCalledWith('pro-variable')
    expect(handleContextModeChange).not.toHaveBeenCalled()
    expect(optimizerPrompt.value).toBe('legacy pro favorite')
    expect(updateAssetBinding).toHaveBeenCalledWith(
      undefined,
      {
        kind: 'favorite',
        id: 'favorite-legacy',
        metadata: expect.objectContaining({
          targetKey: 'pro-variable',
          functionMode: 'context',
        }),
      },
    )
    expect(success).toHaveBeenCalled()
  })

  it('uses promptAsset current version content and mode when loading basic favorites', async () => {
    const success = vi.fn(() => createReactive())
    setGlobalMessageApi({
      success,
      error: vi.fn(() => createReactive()),
      warning: vi.fn(() => createReactive()),
      info: vi.fn(() => createReactive()),
    })

    const optimizerPrompt = ref('')
    const navigateToSubModeKey = vi.fn(async () => {})
    const handleContextModeChange = vi.fn(async () => {})
    const updateAssetBinding = vi.fn()
    const updateTestContent = vi.fn()
    const { handleUseFavorite } = useAppFavorite({
      navigateToSubModeKey,
      handleContextModeChange,
      optimizerPrompt,
      t: (key: string) => key,
      isLoadingExternalData: ref(false),
      basicUserSession: {
        updateAssetBinding,
        clearAssetBinding: vi.fn(),
        updateTestContent,
      },
    })

    const used = await handleUseFavorite({
      content: 'Legacy favorite prompt',
      functionMode: 'basic',
      optimizationMode: 'system',
      metadata: {
        promptAsset: createPromptAsset({
          contract: createPromptContract('basic-user'),
          versions: [
            {
              id: 'version-1',
              version: 1,
              content: { kind: 'text', text: 'Asset current prompt' },
              createdAt: 1,
            },
          ],
          examples: [
            {
              id: 'basic-example',
              basedOnVersionId: 'version-1',
              input: { text: 'Basic example test input' },
            },
          ],
        }),
      },
    }, { applyExample: true, exampleId: 'basic-example' })

    expect(used).toBe(true)
    expect(navigateToSubModeKey).toHaveBeenCalledWith('basic-user')
    expect(handleContextModeChange).not.toHaveBeenCalled()
    expect(optimizerPrompt.value).toBe('Asset current prompt')
    expect(updateTestContent).toHaveBeenCalledWith('Basic example test input')
    expect(updateAssetBinding).toHaveBeenCalledWith(
      {
        assetId: 'asset-1',
        versionId: 'version-1',
        status: 'linked',
      },
      {
        kind: 'favorite',
        metadata: expect.objectContaining({
          targetKey: 'basic-user',
          functionMode: 'basic',
          optimizationMode: 'system',
          assetId: 'asset-1',
          versionId: 'version-1',
        }),
      },
    )
    expect(success).toHaveBeenCalled()
  })

  it('maps pro-conversation prompt assets to pro-multi with role-labeled message content', async () => {
    const success = vi.fn(() => createReactive())
    setGlobalMessageApi({
      success,
      error: vi.fn(() => createReactive()),
      warning: vi.fn(() => createReactive()),
      info: vi.fn(() => createReactive()),
    })

    const optimizerPrompt = ref('')
    const navigateToSubModeKey = vi.fn(async () => {})
    const handleContextModeChange = vi.fn(async () => {})
    const proMultiMessageSession = {
      getTemporaryVariable: vi.fn(),
      setTemporaryVariable: vi.fn(),
      clearTemporaryVariables: vi.fn(),
      updateConversationMessages: vi.fn(),
      setMessageChainMap: vi.fn(),
      selectMessage: vi.fn(),
    }
    const { handleUseFavorite } = useAppFavorite({
      navigateToSubModeKey,
      handleContextModeChange,
      optimizerPrompt,
      t: (key: string) => key,
      isLoadingExternalData: ref(false),
      proMultiMessageSession,
    })

    const used = await handleUseFavorite({
      content: 'Legacy pro prompt',
      functionMode: 'context',
      optimizationMode: 'user',
      metadata: {
        promptAsset: createPromptAsset({
          contract: createPromptContract('pro-conversation'),
          currentVersionId: 'messages-version',
          versions: [
            {
              id: 'messages-version',
              version: 1,
              content: {
                kind: 'messages',
                messages: [
                  { role: 'system', content: 'Use a concise tone.' },
                  { role: 'user', content: 'Asset conversation prompt' },
                ],
              },
              createdAt: 1,
            },
          ],
        }),
      },
    })

    expect(used).toBe(true)
    expect(navigateToSubModeKey).toHaveBeenCalledWith('pro-multi')
    expect(handleContextModeChange).toHaveBeenCalledWith('system')
    expect(optimizerPrompt.value).toBe('[system]\nUse a concise tone.\n\n[user]\nAsset conversation prompt')
    expect(proMultiMessageSession.updateConversationMessages).toHaveBeenCalledWith([
      expect.objectContaining({
        role: 'system',
        content: 'Use a concise tone.',
        originalContent: 'Use a concise tone.',
      }),
      expect.objectContaining({
        role: 'user',
        content: 'Asset conversation prompt',
        originalContent: 'Asset conversation prompt',
      }),
    ])
    expect(proMultiMessageSession.setMessageChainMap).toHaveBeenCalledWith({})
    expect(proMultiMessageSession.selectMessage).toHaveBeenCalledWith('')
    expect(success).toHaveBeenCalled()
  })

  it('applies selected pro-conversation example messages before asset template messages', async () => {
    const success = vi.fn(() => createReactive())
    setGlobalMessageApi({
      success,
      error: vi.fn(() => createReactive()),
      warning: vi.fn(() => createReactive()),
      info: vi.fn(() => createReactive()),
    })

    const optimizerPrompt = ref('')
    const temporaryVariables: Record<string, string> = { topic: 'old' }
    const proMultiMessageSession = {
      getTemporaryVariable: vi.fn((name: string) => temporaryVariables[name]),
      setTemporaryVariable: vi.fn((name: string, value: string) => {
        temporaryVariables[name] = value
      }),
      clearTemporaryVariables: vi.fn(() => {
        for (const key of Object.keys(temporaryVariables)) delete temporaryVariables[key]
      }),
      updateConversationMessages: vi.fn(),
      setMessageChainMap: vi.fn(),
      selectMessage: vi.fn(),
    }

    const { handleUseFavorite } = useAppFavorite({
      navigateToSubModeKey: vi.fn(async () => {}),
      handleContextModeChange: vi.fn(async () => {}),
      optimizerPrompt,
      t: (key: string) => key,
      isLoadingExternalData: ref(false),
      proMultiMessageSession,
    })

    const used = await handleUseFavorite({
      content: 'Legacy pro prompt',
      functionMode: 'context',
      optimizationMode: 'system',
      metadata: {
        promptAsset: createPromptAsset({
          contract: createPromptContract('pro-conversation', {
            variables: [{ name: 'topic', required: false }],
          }),
          currentVersionId: 'messages-version',
          versions: [
            {
              id: 'messages-version',
              version: 1,
              content: {
                kind: 'messages',
                messages: [
                  { role: 'system', content: 'Asset template system' },
                  { role: 'user', content: 'Asset template user' },
                ],
              },
              createdAt: 1,
            },
          ],
          examples: [
            {
              id: 'conversation-example',
              basedOnVersionId: 'messages-version',
              input: {
                messages: [
                  { role: 'system', content: 'Example system {{topic}}' },
                  {
                    id: 'example-user-message',
                    role: 'user',
                    content: 'Example user',
                    originalContent: 'Original example user',
                  },
                ],
                parameters: { topic: 'from-example' },
              },
            },
          ],
        }),
      },
    }, {
      applyExample: true,
      exampleId: 'conversation-example',
    })

    expect(used).toBe(true)
    expect(optimizerPrompt.value).toBe('[system]\nExample system {{topic}}\n\n[user]\nExample user')
    expect(proMultiMessageSession.updateConversationMessages).toHaveBeenCalledWith([
      expect.objectContaining({
        role: 'system',
        content: 'Example system {{topic}}',
        originalContent: 'Example system {{topic}}',
      }),
      expect.objectContaining({
        id: 'example-user-message',
        role: 'user',
        content: 'Example user',
        originalContent: 'Original example user',
      }),
    ])
    expect(proMultiMessageSession.setMessageChainMap).toHaveBeenCalledWith({})
    expect(proMultiMessageSession.selectMessage).toHaveBeenCalledWith('')
    expect(proMultiMessageSession.clearTemporaryVariables).toHaveBeenCalled()
    expect(temporaryVariables.topic).toBe('from-example')
    expect(success).toHaveBeenCalled()
  })

  it('returns success for image favorites after dispatching restore data', async () => {
    const success = vi.fn(() => createReactive())
    setGlobalMessageApi({
      success,
      error: vi.fn(() => createReactive()),
      warning: vi.fn(() => createReactive()),
      info: vi.fn(() => createReactive()),
    })

    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
    const { handleUseFavorite } = useAppFavorite({
      navigateToSubModeKey: vi.fn(async () => {}),
      handleContextModeChange: vi.fn(async () => {}),
      optimizerPrompt: ref('unchanged'),
      t: (key: string) => key,
      isLoadingExternalData: ref(false),
    })

    const used = await handleUseFavorite({
      content: 'image favorite prompt',
      functionMode: 'image',
      imageSubMode: 'text2image',
      metadata: { source: 'test' },
    })

    expect(used).toBe(true)
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'image-workspace-restore-favorite',
    }))

    dispatchSpy.mockRestore()
  })

  it('uses promptAsset image-prompt content when restoring image favorites', async () => {
    const success = vi.fn(() => createReactive())
    setGlobalMessageApi({
      success,
      error: vi.fn(() => createReactive()),
      warning: vi.fn(() => createReactive()),
      info: vi.fn(() => createReactive()),
    })

    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
    const navigateToSubModeKey = vi.fn(async () => {})
    const { handleUseFavorite } = useAppFavorite({
      navigateToSubModeKey,
      handleContextModeChange: vi.fn(async () => {}),
      optimizerPrompt: ref('unchanged'),
      t: (key: string) => key,
      isLoadingExternalData: ref(false),
    })

    const used = await handleUseFavorite({
      content: 'Legacy image prompt',
      functionMode: 'image',
      imageSubMode: 'text2image',
      metadata: {
        promptAsset: createPromptAsset({
          contract: createPromptContract('image-image2image'),
          versions: [
            {
              id: 'version-1',
              version: 1,
              content: { kind: 'image-prompt', text: 'Asset image prompt' },
              createdAt: 1,
            },
          ],
        }),
      },
    })

    expect(used).toBe(true)
    expect(navigateToSubModeKey).toHaveBeenCalledWith('image-image2image')
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'image-workspace-restore-favorite',
      detail: expect.objectContaining({
        content: 'Asset image prompt',
        imageSubMode: 'image2image',
      }),
    }))
    expect(success).toHaveBeenCalled()

    dispatchSpy.mockRestore()
  })

  it('applies selected example parameters to pro-variable temporary variables', async () => {
    const success = vi.fn(() => createReactive())
    setGlobalMessageApi({
      success,
      error: vi.fn(() => createReactive()),
      warning: vi.fn(() => createReactive()),
      info: vi.fn(() => createReactive()),
    })

    const optimizerPrompt = ref('')
    const temporaryVariables: Record<string, string> = { topic: 'old' }
    const proVariableSession = {
      getTemporaryVariable: vi.fn((name: string) => temporaryVariables[name]),
      setTemporaryVariable: vi.fn((name: string, value: string) => {
        temporaryVariables[name] = value
      }),
      clearTemporaryVariables: vi.fn(() => {
        for (const key of Object.keys(temporaryVariables)) delete temporaryVariables[key]
      }),
      updateTestContent: vi.fn(),
    }

    const { handleUseFavorite } = useAppFavorite({
      navigateToSubModeKey: vi.fn(async () => {}),
      handleContextModeChange: vi.fn(async () => {}),
      optimizerPrompt,
      t: (key: string) => key,
      isLoadingExternalData: ref(false),
      proVariableSession,
    })

    const used = await handleUseFavorite({
      content: 'Write about {{topic}}',
      functionMode: 'context',
      optimizationMode: 'user',
      metadata: {
        reproducibility: {
          variables: [{ name: 'topic', defaultValue: 'default' }],
          examples: [
            { id: 'a', parameters: { topic: 'alpha' } },
            { id: 'b', text: 'Example test input', parameters: { topic: 'beta' } },
          ],
        },
      },
    }, { applyExample: true, exampleId: 'b' })

    expect(used).toBe(true)
    expect(optimizerPrompt.value).toBe('Write about {{topic}}')
    expect(proVariableSession.clearTemporaryVariables).toHaveBeenCalled()
    expect(temporaryVariables.topic).toBe('beta')
    expect(proVariableSession.updateTestContent).toHaveBeenCalledWith('Example test input')
    expect(success).toHaveBeenCalled()
  })

  it('applies selected example parameters from promptAsset before legacy metadata', async () => {
    const success = vi.fn(() => createReactive())
    setGlobalMessageApi({
      success,
      error: vi.fn(() => createReactive()),
      warning: vi.fn(() => createReactive()),
      info: vi.fn(() => createReactive()),
    })

    const optimizerPrompt = ref('')
    const temporaryVariables: Record<string, string> = { topic: 'old' }
    const proVariableSession = {
      getTemporaryVariable: vi.fn((name: string) => temporaryVariables[name]),
      setTemporaryVariable: vi.fn((name: string, value: string) => {
        temporaryVariables[name] = value
      }),
      clearTemporaryVariables: vi.fn(() => {
        for (const key of Object.keys(temporaryVariables)) delete temporaryVariables[key]
      }),
    }
    const favorite: FavoritePrompt = {
      id: 'favorite-asset',
      title: 'Asset-backed favorite',
      content: 'Write about {{topic}}',
      createdAt: 1,
      updatedAt: 2,
      tags: [],
      useCount: 0,
      functionMode: 'context',
      optimizationMode: 'user',
      metadata: {
        promptAsset: {
          schemaVersion: PROMPT_MODEL_SCHEMA_VERSION,
          id: 'asset-1',
          title: 'Embedded asset',
          tags: [],
          contract: createPromptContract('pro-variable', {
            variables: [{ name: 'topic', defaultValue: 'asset-default' }],
          }),
          currentVersionId: 'version-1',
          versions: [
            {
              id: 'version-1',
              version: 1,
              content: { kind: 'text', text: 'Write about {{topic}}' },
              createdAt: 1,
            },
          ],
          examples: [
            {
              id: 'asset-example',
              basedOnVersionId: 'version-1',
              input: {
                parameters: { topic: 'from-asset' },
              },
            },
          ],
          createdAt: 1,
          updatedAt: 2,
        },
        reproducibility: {
          variables: [{ name: 'topic', defaultValue: 'legacy-default' }],
          examples: [{ id: 'legacy-example', parameters: { topic: 'from-legacy' } }],
        },
      },
    }

    const { handleUseFavorite } = useAppFavorite({
      navigateToSubModeKey: vi.fn(async () => {}),
      handleContextModeChange: vi.fn(async () => {}),
      optimizerPrompt,
      t: (key: string) => key,
      isLoadingExternalData: ref(false),
      proVariableSession,
    })

    const used = await handleUseFavorite(favorite, {
      applyExample: true,
      exampleId: 'asset-example',
    })

    expect(used).toBe(true)
    expect(optimizerPrompt.value).toBe('Write about {{topic}}')
    expect(proVariableSession.clearTemporaryVariables).toHaveBeenCalled()
    expect(temporaryVariables.topic).toBe('from-asset')
    expect(success).toHaveBeenCalled()
  })

  it('applies image example input images without changing template content', async () => {
    const success = vi.fn(() => createReactive())
    setGlobalMessageApi({
      success,
      error: vi.fn(() => createReactive()),
      warning: vi.fn(() => createReactive()),
      info: vi.fn(() => createReactive()),
    })

    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
    const replaceInputImages = vi.fn()
    const imageMultiImageSession = {
      getTemporaryVariable: vi.fn(() => undefined),
      setTemporaryVariable: vi.fn(),
      clearTemporaryVariables: vi.fn(),
      replaceInputImages,
    }

    const { handleUseFavorite } = useAppFavorite({
      navigateToSubModeKey: vi.fn(async () => {}),
      handleContextModeChange: vi.fn(async () => {}),
      optimizerPrompt: ref('unchanged'),
      t: (key: string) => key,
      isLoadingExternalData: ref(false),
      imageMultiImageSession,
    })

    const used = await handleUseFavorite({
      content: 'Image prompt {{scene}}',
      functionMode: 'image',
      imageSubMode: 'multiimage',
      metadata: {
        reproducibility: {
          variables: [{ name: 'scene' }],
          examples: [{ id: 'img', parameters: { scene: 'city' }, inputImages: ['data:image/png;base64,AAECAw=='] }],
        },
      },
    }, { applyExample: true, exampleId: 'img' })

    expect(used).toBe(true)
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'image-workspace-restore-favorite',
      detail: expect.objectContaining({ content: 'Image prompt {{scene}}' }),
    }))
    expect(imageMultiImageSession.setTemporaryVariable).toHaveBeenCalledWith('scene', 'city')
    expect(replaceInputImages).toHaveBeenCalledWith([{ b64: 'AAECAw==', mimeType: 'image/png' }])

    dispatchSpy.mockRestore()
  })

  it('restores the selected Basic/System example image from favorite storage', async () => {
    const success = vi.fn(() => createReactive())
    setGlobalMessageApi({
      success,
      error: vi.fn(() => createReactive()),
      warning: vi.fn(() => createReactive()),
      info: vi.fn(() => createReactive()),
    })

    const updateTestContent = vi.fn()
    const updateTestImage = vi.fn()
    const getImage = vi.fn(async (assetId: string) => assetId === 'basic-input-asset'
      ? {
          metadata: { id: assetId, mimeType: 'image/webp' },
          data: 'BASIC_INPUT_IMAGE',
        }
      : null)

    const { handleUseFavorite } = useAppFavorite({
      navigateToSubModeKey: vi.fn(async () => {}),
      handleContextModeChange: vi.fn(async () => {}),
      optimizerPrompt: ref(''),
      t: (key: string) => key,
      isLoadingExternalData: ref(false),
      basicSystemSession: {
        clearContent: vi.fn(),
        updatePrompt: vi.fn(),
        updateTestContent,
        updateTestImage,
      },
      getFavoriteImageStorageService: () => ({ getImage } as any),
    })

    const used = await handleUseFavorite({
      content: 'Describe the image accurately',
      functionMode: 'basic',
      optimizationMode: 'system',
      metadata: {
        reproducibility: {
          examples: [{
            id: 'basic-image-example',
            text: 'What is in this image?',
            inputImageAssetIds: ['basic-input-asset'],
          }],
        },
      },
    }, { applyExample: true, exampleId: 'basic-image-example' })

    expect(used).toBe(true)
    expect(getImage).toHaveBeenCalledWith('basic-input-asset')
    expect(updateTestContent).toHaveBeenCalledWith('What is in this image?')
    expect(updateTestImage).toHaveBeenCalledWith('BASIC_INPUT_IMAGE', 'image/webp')
    expect(success).toHaveBeenCalled()
  })

  it('stops loading favorite data when workspace navigation rejects the target key', async () => {
    const success = vi.fn(() => createReactive())
    setGlobalMessageApi({
      success,
      error: vi.fn(() => createReactive()),
      warning: vi.fn(() => createReactive()),
      info: vi.fn(() => createReactive()),
    })

    const optimizerPrompt = ref('unchanged')
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
    const updateAssetBinding = vi.fn()
    const { handleUseFavorite } = useAppFavorite({
      navigateToSubModeKey: vi.fn(async () => false),
      handleContextModeChange: vi.fn(async () => {}),
      optimizerPrompt,
      t: (key: string) => key,
      isLoadingExternalData: ref(false),
      imageText2ImageSession: {
        getTemporaryVariable: vi.fn(),
        setTemporaryVariable: vi.fn(),
        clearTemporaryVariables: vi.fn(),
        updateAssetBinding,
      },
    })

    const used = await handleUseFavorite({
      content: 'image favorite prompt',
      functionMode: 'image',
      imageSubMode: 'text2image',
    })

    expect(used).toBe(false)
    expect(optimizerPrompt.value).toBe('unchanged')
    expect(dispatchSpy).not.toHaveBeenCalledWith(expect.objectContaining({
      type: 'image-workspace-restore-favorite',
    }))
    expect(updateAssetBinding).not.toHaveBeenCalled()
    expect(success).not.toHaveBeenCalled()

    dispatchSpy.mockRestore()
  })

  it('logs favorite restore failures with an English runtime message', async () => {
    const error = vi.fn(() => createReactive())
    setGlobalMessageApi({
      success: vi.fn(() => createReactive()),
      error,
      warning: vi.fn(() => createReactive()),
      info: vi.fn(() => createReactive()),
    })

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { handleUseFavorite } = useAppFavorite({
      navigateToSubModeKey: vi.fn(() => {
        throw new Error('boom')
      }),
      handleContextModeChange: vi.fn(async () => {}),
      optimizerPrompt: ref(''),
      t: (key: string, params?: Record<string, unknown>) =>
        key === 'toast.error.favoriteLoadFailed'
          ? `favorite load failed: ${String(params?.error ?? '')}`
          : key,
      isLoadingExternalData: ref(false),
    })

    const used = await handleUseFavorite({
      content: 'favorite prompt',
      functionMode: 'basic',
      optimizationMode: 'system',
    })

    expect(used).toBe(false)
    expect(consoleErrorSpy).toHaveBeenCalledWith('[App] Failed to load favorite:', expect.any(Error))
    expect(error).toHaveBeenCalledWith(
      'favorite load failed: boom',
      expect.objectContaining({
        closable: true,
        duration: 3000,
        keepAliveOnHover: true,
      }),
    )

    consoleErrorSpy.mockRestore()
  })
})
