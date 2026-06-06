import { describe, it, expect, vi } from 'vitest'

import { createVariableValueGenerationService } from '../../../src/services/variable-value-generation/service'
import {
  VariableValueGenerationExecutionError,
  VariableValueGenerationModelError,
  VariableValueGenerationParseError,
  VariableValueGenerationValidationError,
} from '../../../src/services/variable-value-generation/errors'

const validRequest = {
  promptContent: 'Write about {{topic}} in a {{tone}} style.',
  generationModelKey: 'model-1',
  variables: [{ name: 'topic' }],
}

function createService(overrides: {
  sendMessage?: ReturnType<typeof vi.fn>
  getModel?: ReturnType<typeof vi.fn>
  getTemplate?: ReturnType<typeof vi.fn>
} = {}) {
  const sendMessage = overrides.sendMessage ?? vi.fn(async () =>
    JSON.stringify({
      values: [{ name: 'topic', value: 'AI', reason: 'The prompt asks for a subject.' }],
      summary: 'done',
    }),
  )
  const getModel = overrides.getModel ?? vi.fn(async () => ({ key: 'model-1' }))
  const getTemplate = overrides.getTemplate ?? vi.fn(async () => ({
    id: 'variable-value-generation',
    content: 'Prompt={{promptContent}}\nMissing={{variablesText}}',
  }))

  return {
    service: createVariableValueGenerationService(
      { sendMessage } as any,
      { getModel } as any,
      { getTemplate } as any,
    ),
    sendMessage,
    getModel,
    getTemplate,
  }
}

describe('VariableValueGenerationService runtime messages', () => {
  it('passes filled variables as context without requiring generated values for them', async () => {
    const sendMessage = vi.fn(async () =>
      JSON.stringify({
        values: [
          { name: 'style', value: 'explainer', reason: 'Matches the provided audience.' },
          { name: 'length', value: '800', reason: 'Suitable for the provided topic and audience.' },
        ],
        summary: 'done',
      }),
    )

    const service = createVariableValueGenerationService(
      { sendMessage } as any,
      {
        getModel: vi.fn(async () => ({ key: 'model-1' })),
      } as any,
      {
        getTemplate: vi.fn(async () => ({
          id: 'variable-value-generation',
          content: [
            {
              role: 'user',
              content:
                'Context:\n{{contextVariablesText}}\nMissing:\n{{variablesText}}\nContextCount={{contextVariableCount}} MissingCount={{variableCount}}',
            },
          ],
        })),
      } as any,
    )

    const result = await service.generate({
      promptContent: 'Write about {{topic}} for {{audience}} as a {{style}} in {{length}} words.',
      generationModelKey: 'model-1',
      contextVariables: [
        { name: 'topic', currentValue: 'AI', source: 'test' },
        { name: 'audience', currentValue: 'high school students', source: 'test' },
      ],
      variables: [
        {
          name: 'style',
          description: 'Writing style',
          defaultValue: 'explainer',
          source: 'test',
        },
        { name: 'length', source: 'test' },
      ],
    })

    const messages = sendMessage.mock.calls[0][0]
    expect(messages[0].content).toContain('1. topic (current value: AI) [test]')
    expect(messages[0].content).toContain('2. audience (current value: high school students) [test]')
    expect(messages[0].content).toContain(
      '1. style (description: Writing style) (default value: explainer) [test]',
    )
    expect(messages[0].content).toContain('2. length [test]')
    expect(messages[0].content).toContain('ContextCount=2 MissingCount=2')
    expect(result.values.map((value) => value.name)).toEqual(['style', 'length'])
  })

  it('uses English warnings and fallback reason for alignment edge cases', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const service = createVariableValueGenerationService(
      {
        sendMessage: vi.fn(async () =>
          JSON.stringify({
            values: [
              { name: 'topic', value: 'cats', reason: 'first' },
              { name: 'topic', value: 'dogs', reason: 'second' },
              { name: 'extra', value: 'unused', reason: 'extra' },
            ],
            summary: 'done',
          }),
        ),
      } as any,
      {
        getModel: vi.fn(async () => ({ key: 'model-1' })),
      } as any,
      {
        getTemplate: vi.fn(async () => ({
          id: 'variable-value-generation',
          content: 'template',
        })),
      } as any,
    )

    const result = await service.generate({
      promptContent: 'Write about {{topic}} in a {{tone}} style.',
      generationModelKey: 'model-1',
      variables: [
        { name: 'topic' },
        { name: 'topic' },
        { name: 'tone' },
      ],
    })

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[VariableValueGeneration] LLM returned a duplicate variable name: topic. The later value will overwrite the earlier one.',
    )
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[VariableValueGeneration] LLM returned a variable that was not requested: extra',
    )
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[VariableValueGeneration] The request list contains a duplicate variable name: topic. The generated result will be reused.',
    )
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[VariableValueGeneration] LLM did not return variable "tone". Filling it with an empty value.',
    )
    expect(result.values).toEqual([
      { name: 'topic', value: 'dogs', reason: 'second', confidence: undefined },
      { name: 'topic', value: 'dogs', reason: 'second', confidence: undefined },
      {
        name: 'tone',
        value: '',
        reason: 'LLM did not generate a value for this variable.',
        confidence: 0,
      },
    ])

    consoleWarnSpy.mockRestore()
  })

  it.each([
    [
      'rejects empty prompt content',
      { ...validRequest, promptContent: '   ' },
      'Prompt content must not be empty.',
    ],
    [
      'rejects empty model key',
      { ...validRequest, generationModelKey: '   ' },
      'Generation model key must not be empty.',
    ],
    [
      'rejects empty variables list',
      { ...validRequest, variables: [] },
      'Variables list must not be empty.',
    ],
    [
      'rejects variables with blank names',
      { ...validRequest, variables: [{ name: 'topic' }, { name: '   ' }] },
      'Variable at index 1 has empty name.',
    ],
  ])('%s', async (_caseName, request, expectedMessage) => {
    const { service, getModel, getTemplate, sendMessage } = createService()
    const generation = service.generate(request as any)

    await expect(generation).rejects.toMatchObject({
      name: 'VariableValueGenerationValidationError',
      message: expect.stringContaining(expectedMessage),
    })
    await expect(generation).rejects.toBeInstanceOf(VariableValueGenerationValidationError)
    expect(getModel).not.toHaveBeenCalled()
    expect(getTemplate).not.toHaveBeenCalled()
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('rejects unknown generation models before loading a template', async () => {
    const { service, getModel, getTemplate, sendMessage } = createService({
      getModel: vi.fn(async () => undefined),
    })

    await expect(service.generate(validRequest)).rejects.toBeInstanceOf(VariableValueGenerationModelError)
    expect(getModel).toHaveBeenCalledWith('model-1')
    expect(getTemplate).not.toHaveBeenCalled()
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it.each([
    ['missing template', undefined],
    ['empty template content', { id: 'variable-value-generation', content: '' }],
  ])('fails when the variable generation template is %s', async (_caseName, template) => {
    const { service, sendMessage } = createService({
      getTemplate: vi.fn(async () => template),
    })
    const generation = service.generate(validRequest)

    await expect(generation).rejects.toMatchObject({
      name: 'VariableValueGenerationExecutionError',
      message: expect.stringContaining('Template "variable-value-generation" not found or empty.'),
    })
    await expect(generation).rejects.toBeInstanceOf(VariableValueGenerationExecutionError)
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('preserves structured template manager errors for caller diagnostics', async () => {
    const structuredError = {
      code: 'TEMPLATE_STORAGE_UNAVAILABLE',
      message: 'Template storage is unavailable.',
      params: { source: 'unit-test' },
    }
    const { service, sendMessage } = createService({
      getTemplate: vi.fn(async () => {
        throw structuredError
      }),
    })

    await expect(service.generate(validRequest)).rejects.toMatchObject({
      code: 'TEMPLATE_STORAGE_UNAVAILABLE',
      message: 'Template storage is unavailable.',
      params: { source: 'unit-test' },
    })
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('wraps unexpected LLM failures as execution errors', async () => {
    const { service } = createService({
      sendMessage: vi.fn(async () => {
        throw new Error('provider timeout')
      }),
    })

    await expect(service.generate(validRequest)).rejects.toMatchObject({
      name: 'VariableValueGenerationExecutionError',
      message: expect.stringContaining('provider timeout'),
    })
  })

  it('parses repaired JSON from fenced responses and trims returned names', async () => {
    const { service } = createService({
      sendMessage: vi.fn(async () => ({
        content: `\`\`\`json
{
  values: [
    { name: ' topic ', value: 'AI prompt engineering', reason: 'Prompt mentions topic', confidence: 0.8 },
  ],
  summary: ' completed '
}
\`\`\``,
      })),
    })

    await expect(service.generate(validRequest)).resolves.toEqual({
      values: [
        {
          name: 'topic',
          value: 'AI prompt engineering',
          reason: 'Prompt mentions topic',
          confidence: 0.8,
        },
      ],
      summary: 'completed',
    })
  })

  it.each([
    ['non-object response', 'null', 'Generation result is not a valid object.'],
    ['missing values array', '{"summary":"done"}', 'Generation result must have a "values" array.'],
    [
      'missing summary string',
      '{"values":[{"name":"topic","value":"AI","reason":"ok"}]}',
      'Generation result must have a "summary" string.',
    ],
    ['non-object value item', '{"values":[null],"summary":"done"}', 'values[0] is not a valid object.'],
    [
      'missing value name',
      '{"values":[{"name":" ","value":"AI","reason":"ok"}],"summary":"done"}',
      'values[0] is missing a valid "name" field.',
    ],
    [
      'missing string value',
      '{"values":[{"name":"topic","value":42,"reason":"ok"}],"summary":"done"}',
      'values[0] is missing a valid "value" field.',
    ],
    [
      'missing reason',
      '{"values":[{"name":"topic","value":"AI"}],"summary":"done"}',
      'values[0] is missing a valid "reason" field.',
    ],
    ['malformed JSON', '{not json', 'Failed to parse LLM response:'],
  ])('rejects invalid LLM response shape: %s', async (_caseName, response, expectedMessage) => {
    const { service } = createService({
      sendMessage: vi.fn(async () => response),
    })
    const generation = service.generate(validRequest)

    await expect(generation).rejects.toMatchObject({
      name: 'VariableValueGenerationParseError',
      message: expect.stringContaining(expectedMessage),
    })
    await expect(generation).rejects.toBeInstanceOf(VariableValueGenerationParseError)
  })
})
