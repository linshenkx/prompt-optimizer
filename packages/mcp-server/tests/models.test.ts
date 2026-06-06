import { beforeEach, describe, expect, it, vi } from 'vitest';

const coreMock = vi.hoisted(() => ({
  defaultModels: {} as Record<string, {
    id: string;
    name: string;
    enabled: boolean;
    providerMeta?: { id?: string; defaultBaseURL?: string };
    modelMeta?: { id?: string; providerId?: string };
  }>
}));

vi.mock('@prompt-optimizer/core', () => ({
  defaultModels: coreMock.defaultModels,
  ModelManager: class ModelManager {}
}));

import { setupDefaultModel } from '../src/config/models.js';

function resetDefaultModels() {
  Object.keys(coreMock.defaultModels).forEach(key => {
    delete coreMock.defaultModels[key];
  });
}

function createModelManager(options?: { updateFails?: boolean }) {
  return {
    updateModel: vi.fn(async () => {
      if (options?.updateFails) {
        throw new Error('missing model');
      }
    }),
    addModel: vi.fn(async () => undefined)
  };
}

describe('MCP default model setup', () => {
  beforeEach(() => {
    resetDefaultModels();
    coreMock.defaultModels.openai = {
      id: 'openai',
      name: 'OpenAI GPT',
      enabled: true,
      providerMeta: { id: 'openai', defaultBaseURL: 'https://api.openai.com/v1' },
      modelMeta: { id: 'gpt-4o-mini', providerId: 'openai' }
    };
    coreMock.defaultModels.deepseek = {
      id: 'deepseek',
      name: 'DeepSeek Chat',
      enabled: true,
      providerMeta: { id: 'deepseek' },
      modelMeta: { id: 'deepseek-chat', providerId: 'deepseek' }
    };
    coreMock.defaultModels.disabled = {
      id: 'disabled',
      name: 'Disabled Model',
      enabled: false,
      providerMeta: { id: 'disabled' },
      modelMeta: { id: 'disabled-model', providerId: 'disabled' }
    };
  });

  it('updates mcp-default with the preferred provider match', async () => {
    const modelManager = createModelManager();

    await setupDefaultModel(modelManager as never, 'deepseek');

    expect(modelManager.updateModel).toHaveBeenCalledWith('mcp-default', expect.objectContaining({
      id: 'deepseek',
      enabled: true,
      providerMeta: expect.objectContaining({ id: 'deepseek' })
    }));
    expect(modelManager.addModel).not.toHaveBeenCalled();
  });

  it('adds mcp-default when updating an existing model fails', async () => {
    const modelManager = createModelManager({ updateFails: true });

    await setupDefaultModel(modelManager as never, 'OpenAI');

    expect(modelManager.updateModel).toHaveBeenCalledWith('mcp-default', expect.objectContaining({
      id: 'openai',
      enabled: true
    }));
    expect(modelManager.addModel).toHaveBeenCalledWith('mcp-default', expect.objectContaining({
      id: 'openai',
      enabled: true
    }));
  });

  it('falls back to the first enabled model when no preferred provider matches', async () => {
    const modelManager = createModelManager();

    await setupDefaultModel(modelManager as never, 'missing-provider');

    expect(modelManager.updateModel).toHaveBeenCalledWith('mcp-default', expect.objectContaining({
      id: 'openai',
      enabled: true
    }));
    expect(modelManager.addModel).not.toHaveBeenCalled();
  });

  it('throws when no enabled default models are available', async () => {
    resetDefaultModels();
    coreMock.defaultModels.disabled = {
      id: 'disabled',
      name: 'Disabled Model',
      enabled: false
    };
    const modelManager = createModelManager();

    await expect(setupDefaultModel(modelManager as never)).rejects.toThrow('No enabled models found');
  });
});
