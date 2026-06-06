import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createVariableExtractionService,
  VariableExtractionService,
} from '../../../src/services/variable-extraction/service'
import {
  VariableExtractionExecutionError,
  VariableExtractionModelError,
  VariableExtractionParseError,
  VariableExtractionValidationError,
} from '../../../src/services/variable-extraction/errors'
import type { Template } from '../../../src/services/template/types'

const extractionTemplate: Template = {
  id: 'variable-extraction',
  name: 'Variable extraction',
  content: [
    {
      role: 'system',
      content:
        'Extract variables from {{promptContent}}. Existing: {{existingVariableNames}}. Has existing: {{hasExistingVariables}}.',
    },
  ],
  metadata: {
    version: '1.0.0',
    lastModified: 0,
    templateType: 'variable-extraction',
  },
}

function createMocks() {
  const llmService = {
    sendMessage: vi.fn(),
  }
  const modelManager = {
    getModel: vi.fn().mockResolvedValue({ key: 'extractor-model' }),
  }
  const templateManager = {
    getTemplate: vi.fn().mockResolvedValue(extractionTemplate),
  }

  return { llmService, modelManager, templateManager }
}

describe('VariableExtractionService', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('extracts variables, renders the extraction context, and filters existing or duplicate names', async () => {
    const { llmService, modelManager, templateManager } = createMocks()
    llmService.sendMessage.mockResolvedValue(`\`\`\`json
{
  "summary": " extracted ",
  "variables": [
    {
      "name": " Topic ",
      "value": "AI",
      "position": { "originalText": "AI", "occurrence": 1 },
      "reason": "main subject",
      "category": "subject"
    },
    {
      "name": "topic",
      "value": "duplicate",
      "position": { "originalText": "duplicate", "occurrence": 1 },
      "reason": "duplicate"
    },
    {
      "name": "Audience",
      "value": "developers",
      "position": { "originalText": "developers", "occurrence": 1 },
      "reason": "target audience"
    }
  ]
}
\`\`\``)

    const service = createVariableExtractionService(
      llmService as any,
      modelManager as any,
      templateManager as any,
    )

    const result = await service.extract({
      promptContent: 'Write an AI guide for developers.',
      extractionModelKey: 'extractor-model',
      existingVariableNames: [' audience '],
    })

    expect(modelManager.getModel).toHaveBeenCalledWith('extractor-model')
    expect(templateManager.getTemplate).toHaveBeenCalledWith('variable-extraction')
    expect(llmService.sendMessage).toHaveBeenCalledWith(
      [
        {
          role: 'system',
          content:
            'Extract variables from Write an AI guide for developers.. Existing:  audience . Has existing: true.',
        },
      ],
      'extractor-model',
    )
    expect(result).toEqual({
      summary: 'extracted',
      variables: [
        {
          name: 'Topic',
          value: 'AI',
          position: { originalText: 'AI', occurrence: 1 },
          reason: 'main subject',
          category: 'subject',
        },
      ],
    })
  })

  it('uses jsonrepair before parsing malformed but repairable LLM JSON', async () => {
    const { llmService, modelManager, templateManager } = createMocks()
    llmService.sendMessage.mockResolvedValue(`{
      summary: "ok",
      variables: [{
        name: "tone",
        value: "formal",
        position: { originalText: "formal", occurrence: 1 },
        reason: "style",
      }],
    }`)

    const service = new VariableExtractionService(
      llmService as any,
      modelManager as any,
      templateManager as any,
    )

    await expect(
      service.extract({
        promptContent: 'Use a formal tone.',
        extractionModelKey: 'extractor-model',
      }),
    ).resolves.toMatchObject({
      variables: [{ name: 'tone', value: 'formal' }],
      summary: 'ok',
    })
  })

  it('rejects empty prompt content and empty model keys before calling dependencies', async () => {
    const { llmService, modelManager, templateManager } = createMocks()
    const service = createVariableExtractionService(
      llmService as any,
      modelManager as any,
      templateManager as any,
    )

    await expect(
      service.extract({ promptContent: ' ', extractionModelKey: 'extractor-model' }),
    ).rejects.toBeInstanceOf(VariableExtractionValidationError)
    await expect(
      service.extract({ promptContent: 'prompt', extractionModelKey: ' ' }),
    ).rejects.toBeInstanceOf(VariableExtractionValidationError)

    expect(modelManager.getModel).not.toHaveBeenCalled()
    expect(templateManager.getTemplate).not.toHaveBeenCalled()
    expect(llmService.sendMessage).not.toHaveBeenCalled()
  })

  it('rejects unknown extraction models', async () => {
    const { llmService, modelManager, templateManager } = createMocks()
    modelManager.getModel.mockResolvedValue(null)
    const service = createVariableExtractionService(
      llmService as any,
      modelManager as any,
      templateManager as any,
    )

    await expect(
      service.extract({ promptContent: 'prompt', extractionModelKey: 'missing-model' }),
    ).rejects.toBeInstanceOf(VariableExtractionModelError)

    expect(templateManager.getTemplate).not.toHaveBeenCalled()
    expect(llmService.sendMessage).not.toHaveBeenCalled()
  })

  it('reports missing or empty extraction templates as execution errors', async () => {
    const { llmService, modelManager, templateManager } = createMocks()
    templateManager.getTemplate.mockResolvedValue({ ...extractionTemplate, content: '' })
    const service = createVariableExtractionService(
      llmService as any,
      modelManager as any,
      templateManager as any,
    )

    await expect(
      service.extract({ promptContent: 'prompt', extractionModelKey: 'extractor-model' }),
    ).rejects.toThrow('Template "variable-extraction" not found or empty.')
  })

  it('preserves structured template errors that cross process boundaries', async () => {
    const { modelManager, templateManager } = createMocks()
    templateManager.getTemplate.mockRejectedValue({
      code: 'TEMPLATE_NOT_FOUND',
      message: 'Template missing',
      params: { context: 'variable-extraction' },
      name: 'TemplateNotFoundError',
    })
    const service = createVariableExtractionService(
      { sendMessage: vi.fn() } as any,
      modelManager as any,
      templateManager as any,
    )

    await expect(
      service.extract({ promptContent: 'prompt', extractionModelKey: 'extractor-model' }),
    ).rejects.toMatchObject({
      code: 'TEMPLATE_NOT_FOUND',
      message: 'Template missing',
      params: { context: 'variable-extraction' },
      name: 'TemplateNotFoundError',
    })
  })

  it('normalizes LLM failures into execution errors', async () => {
    const { llmService, modelManager, templateManager } = createMocks()
    llmService.sendMessage.mockRejectedValue(new Error('network down'))
    const service = createVariableExtractionService(
      llmService as any,
      modelManager as any,
      templateManager as any,
    )

    await expect(
      service.extract({ promptContent: 'prompt', extractionModelKey: 'extractor-model' }),
    ).rejects.toBeInstanceOf(VariableExtractionExecutionError)
  })

  it('rejects invalid result shapes with parse errors', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { llmService, modelManager, templateManager } = createMocks()
    llmService.sendMessage.mockResolvedValue('{"summary": "missing variables"}')
    const service = createVariableExtractionService(
      llmService as any,
      modelManager as any,
      templateManager as any,
    )

    await expect(
      service.extract({ promptContent: 'prompt', extractionModelKey: 'extractor-model' }),
    ).rejects.toBeInstanceOf(VariableExtractionParseError)

    consoleSpy.mockRestore()
  })

  it('rejects variables with invalid required fields', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { llmService, modelManager, templateManager } = createMocks()
    llmService.sendMessage.mockResolvedValue(
      JSON.stringify({
        summary: 'bad variable',
        variables: [{ name: 'topic', value: 'AI', reason: 'missing position' }],
      }),
    )
    const service = createVariableExtractionService(
      llmService as any,
      modelManager as any,
      templateManager as any,
    )

    await expect(
      service.extract({ promptContent: 'prompt', extractionModelKey: 'extractor-model' }),
    ).rejects.toThrow('position')

    consoleSpy.mockRestore()
  })
})
