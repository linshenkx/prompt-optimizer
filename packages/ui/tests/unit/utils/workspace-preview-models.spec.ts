import { describe, expect, it, vi } from 'vitest'
import { createImageAdapterRegistry, createTextAdapterRegistry } from '@prompt-optimizer/core'
import { migrateWorkspacePreviewTextModel, relocateWorkspacePreviewModels, seedWorkspacePreviewImageModel, seedWorkspacePreviewTextModel, WORKSPACE_PREVIEW_IMAGE_MODEL_ID, WORKSPACE_PREVIEW_TEXT_MODEL_ID } from '../../../src/utils/workspace-preview-models'

describe('workspace preview image configuration', () => {
  it('moves the untouched legacy preview selection to Magpie without losing its id', async () => {
    const manager = { getModel: vi.fn().mockResolvedValue({ enabled: true, name: 'Mobile Preview', modelId: 'Qwen/Qwen3-32B', connectionConfig: { baseURL: 'https://api.siliconflow.cn/v1', apiKey: 'old', requestStyle: 'chat_completions' } }), updateModel: vi.fn() }
    expect(await migrateWorkspacePreviewTextModel(manager, createTextAdapterRegistry(), { enabled: true, origin: 'http://192.0.2.20:18181', legacyApiKey: 'old' })).toBe(true)
    expect(manager.updateModel).toHaveBeenCalledWith('custom_mobile_preview', expect.objectContaining({ modelId: 'antigravity/gemini-3.8-flash', connectionConfig: { apiKey: 'magpie-prompt-optimizer', baseURL: 'http://192.0.2.20:18181/__local_magpie/v1' } }))
  })
  it.each([{ enabled: false }, { name: 'Edited' }, { paramOverrides: { temperature: 0.1 } }, { connectionConfig: { baseURL: 'http://my-server/v1', apiKey: 'old' } }, { connectionConfig: { baseURL: 'https://api.siliconflow.cn/v1', apiKey: 'edited-key' } }])('preserves an edited or disabled old preset: %s', async edits => {
    const manager = { getModel: vi.fn().mockResolvedValue({ enabled: true, name: 'Mobile Preview', modelId: 'Qwen/Qwen3-32B', connectionConfig: { baseURL: 'https://api.siliconflow.cn/v1', apiKey: 'old' }, ...edits }), updateModel: vi.fn() }
    expect(await migrateWorkspacePreviewTextModel(manager, createTextAdapterRegistry(), { enabled: true, origin: 'http://192.0.2.20:18181', legacyApiKey: 'old' })).toBe(false)
    expect(manager.updateModel).not.toHaveBeenCalled()
  })
  it('adds a same-origin vision optimizer only in the dedicated preview', async () => {
    const manager = { getModel: vi.fn().mockResolvedValue(undefined), addModel: vi.fn() }
    expect(await seedWorkspacePreviewTextModel(manager, createTextAdapterRegistry(), { enabled: true, origin: 'http://192.0.2.20:18181' })).toBe(true)
    expect(manager.addModel.mock.calls[0]).toMatchObject([WORKSPACE_PREVIEW_TEXT_MODEL_ID, {
      enabled: true, modelId: 'antigravity/gemini-3.8-flash',
      connectionConfig: { baseURL: 'http://192.0.2.20:18181/__local_magpie/v1' },
    }])
  })
  it('never replaces a saved vision model or seeds one outside the preview', async () => {
    const manager = { getModel: vi.fn().mockResolvedValue({ enabled: false }), addModel: vi.fn() }
    const registry = { getAdapter: vi.fn() }
    expect(await seedWorkspacePreviewTextModel(manager, registry, { enabled: false, origin: '' })).toBe(false)
    expect(manager.getModel).not.toHaveBeenCalled()
    expect(await seedWorkspacePreviewTextModel(manager, registry, { enabled: true, origin: 'http://192.0.2.20:18181' })).toBe(false)
    expect(registry.getAdapter).not.toHaveBeenCalled()
    expect(manager.addModel).not.toHaveBeenCalled()
  })
  it.each(['http://127.0.0.1:18181', 'http://192.0.2.20:18181', 'http://192.0.2.21:18181'])(
    'uses the page origin %s and supports the three existing image workspaces', async origin => {
      const manager = { getConfig: vi.fn().mockResolvedValue(null), addConfig: vi.fn() }
      expect(await seedWorkspacePreviewImageModel(manager, createImageAdapterRegistry(), { enabled: true, origin })).toBe(true)
      expect(manager.addConfig).toHaveBeenCalledOnce()
      expect(manager.addConfig.mock.calls[0][0]).toMatchObject({
        id: WORKSPACE_PREVIEW_IMAGE_MODEL_ID, enabled: true, providerId: 'openai', modelId: 'codex/gpt-image-2',
        connectionConfig: { baseURL: origin + '/__local_magpie/v1' },
        paramOverrides: { quality: 'low' },
        model: { capabilities: { text2image: true, image2image: true, multiImage: true } },
      })
    },
  )

  it('does not add or change models when the dedicated preview is disabled', async () => {
    const manager = { getConfig: vi.fn(), addConfig: vi.fn() }
    const registry = { getAdapter: vi.fn() }
    expect(await seedWorkspacePreviewImageModel(manager, registry, { enabled: false, origin: '' })).toBe(false)
    expect(manager.getConfig).not.toHaveBeenCalled()
    expect(registry.getAdapter).not.toHaveBeenCalled()
    expect(manager.addConfig).not.toHaveBeenCalled()
  })

  it('retains a saved configuration including explicit disabling and user edits', async () => {
    const manager = { getConfig: vi.fn().mockResolvedValue({ id: WORKSPACE_PREVIEW_IMAGE_MODEL_ID, enabled: false }), addConfig: vi.fn() }
    const registry = { getAdapter: vi.fn() }
    expect(await seedWorkspacePreviewImageModel(manager, registry, { enabled: true, origin: 'http://192.0.2.20:18181' })).toBe(false)
    expect(manager.addConfig).not.toHaveBeenCalled()
    expect(registry.getAdapter).not.toHaveBeenCalled()
  })
})

describe('workspace preview origin changes', () => {
  const connection = { baseURL: 'http://192.168.31.20:18181/__local_magpie/v1', apiKey: 'magpie-prompt-optimizer' }
  const text = { id: WORKSPACE_PREVIEW_TEXT_MODEL_ID, enabled: true, name: 'Mobile Preview · Gemini', providerId: 'openai-compatible', modelId: 'antigravity/gemini-3.8-flash', connectionConfig: connection }
  const image = { id: WORKSPACE_PREVIEW_IMAGE_MODEL_ID, enabled: true, name: 'Mobile Preview · GPT Image', providerId: 'openai', modelId: 'codex/gpt-image-2', connectionConfig: connection }
  const managers = (textModel = text, imageModel = image) => ({
    text: { getModel: vi.fn(async id => id === textModel.id ? textModel : undefined), updateModel: vi.fn() },
    image: { getConfig: vi.fn().mockResolvedValue(imageModel), updateConfig: vi.fn() },
  })

  it('relocates both built-in presets after a LAN backup moves to phone localhost', async () => {
    const models = managers()
    await relocateWorkspacePreviewModels(models.text, models.image, { enabled: true, origin: 'http://localhost:18181' })
    const updated = { connectionConfig: { ...connection, baseURL: 'http://localhost:18181/__local_magpie/v1' } }
    expect(models.text.updateModel).toHaveBeenCalledExactlyOnceWith(text.id, updated)
    expect(models.image.updateConfig).toHaveBeenCalledExactlyOnceWith(image.id, updated)
  })

  it('does not touch models in ordinary builds or when already at this origin', async () => {
    const models = managers()
    await relocateWorkspacePreviewModels(models.text, models.image, { enabled: false, origin: 'http://localhost:18181' })
    expect(models.text.getModel).not.toHaveBeenCalled()
    expect(models.image.getConfig).not.toHaveBeenCalled()
    await relocateWorkspacePreviewModels(models.text, models.image, { enabled: true, origin: 'http://192.168.31.20:18181' })
    expect(models.text.updateModel).not.toHaveBeenCalled()
    expect(models.image.updateConfig).not.toHaveBeenCalled()
  })

  it.each([
    { enabled: false },
    { name: 'My model' },
    { connectionConfig: { ...connection, apiKey: 'user-chosen-key' } },
    { connectionConfig: { ...connection, baseURL: 'https://example.com/__local_magpie/v1' } },
    { connectionConfig: { ...connection, baseURL: 'http://192.168.31.20:18181/custom/v1' } },
    { connectionConfig: { ...connection, baseURL: connection.baseURL + '?key=custom' } },
    { connectionConfig: { ...connection, baseURL: 'not a url' } },
  ])('preserves custom or disabled configurations: %s', async changes => {
    const models = managers({ ...text, ...changes }, { ...image, ...changes })
    await relocateWorkspacePreviewModels(models.text, models.image, { enabled: true, origin: 'http://localhost:18181' })
    expect(models.text.updateModel).not.toHaveBeenCalled()
    expect(models.image.updateConfig).not.toHaveBeenCalled()
  })
})
