import { describe, expect, it, vi } from 'vitest'
import { DataImportExportManager } from '../../../src/services/DataImportExportManager'

describe('DataImportExportManager', () => {
  it('imports the internal standard format from clipboard and file without dropping fields', async () => {
    const data = {
      messages: [{ role: 'user' as const, content: 'hello' }],
      tools: [
        {
          type: 'function' as const,
          function: { name: 'lookup', parameters: { type: 'object' } },
        },
      ],
      model: 'gpt-test',
      metadata: {
        source: 'manual' as const,
        origin: 'import_export_dialog',
        nested: { keep: true },
      },
    }
    const manager = new DataImportExportManager()

    expect(manager.detectFormat(data)).toBe('standard')
    expect(manager.importFromClipboard(JSON.stringify(data))).toEqual({
      success: true,
      data,
    })
    await expect(
      manager.importFromFile(new File([JSON.stringify(data)], 'standard-prompt.json', { type: 'application/json' })),
    ).resolves.toEqual({ success: true, data })
  })

  it('keeps model requests without internal metadata on the OpenAI path', () => {
    const manager = new DataImportExportManager()
    const data = {
      model: 'gpt-test',
      messages: [{ role: 'user', content: 'hello' }],
    }

    expect(manager.detectFormat(data)).toBe('openai')
    expect(manager.importFromClipboard(JSON.stringify(data)).success).toBe(true)
  })

  it('marks standard exports so model and metadata round-trip unambiguously', async () => {
    const manager = new DataImportExportManager()
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    const data = {
      model: 'gpt-test',
      messages: [{ role: 'user' as const, content: 'hello' }],
      metadata: { source: 'manual' as const, custom: 'keep' },
    }

    await expect(manager.exportToClipboard(data, 'standard')).resolves.toBe(true)
    const exported = JSON.parse(writeText.mock.calls[0][0])

    expect(exported).toEqual({ ...data, format: 'prompt-optimizer-standard' })
    expect(manager.detectFormat(exported)).toBe('standard')
    expect(manager.importFromClipboard(JSON.stringify(exported))).toEqual({
      success: true,
      data: exported,
    })
  })

  it.each([
    { request_id: 'request-1' },
    null,
  ])('keeps OpenAI requests with metadata on the OpenAI path: $metadata', (metadata) => {
    const manager = new DataImportExportManager()
    const data = {
      model: 'gpt-test',
      messages: [{ role: 'user', content: 'hello' }],
      metadata,
    }

    expect(manager.detectFormat(data)).toBe('openai')
    expect(manager.importFromClipboard(JSON.stringify(data)).success).toBe(true)
  })

  it('accepts array tool parameters supported by the existing editor contract', () => {
    const manager = new DataImportExportManager()
    const data = {
      messages: [{ role: 'user' as const, content: 'hello' }],
      tools: [{ type: 'function' as const, function: { name: 'lookup', parameters: [] } }],
    }

    expect(manager.importFromClipboard(JSON.stringify(data))).toEqual({ success: true, data })
  })

  it('accepts an empty internal workspace', () => {
    const manager = new DataImportExportManager()
    const data = { messages: [], metadata: { source: 'manual' as const } }

    expect(manager.importFromClipboard(JSON.stringify(data))).toEqual({ success: true, data })
  })

  it.each([
    { messages: [{ role: 'invalid', content: 'hello' }] },
    { messages: [{ role: 'user', content: 42 }] },
  ])('rejects malformed internal messages: $messages', (data) => {
    const manager = new DataImportExportManager()

    expect(manager.importFromClipboard(JSON.stringify(data))).toEqual(
      expect.objectContaining({ success: false }),
    )
  })

  it.each([
    { tools: { invalid: true } },
    { tools: [{ type: 'function', function: { parameters: {} } }] },
    { metadata: 'invalid' },
    { metadata: { source: 123 } },
    { metadata: { source: 'invalid' } },
    { metadata: { timestamp: 42 } },
    { metadata: { template_info: 'invalid' } },
    { metadata: { template_info: { name: 42 } } },
    { metadata: { template_info: { version: 42 } } },
    { metadata: { template_info: { variables: [1] } } },
    { model: null },
    { temperature: 'hot' },
    { max_tokens: 'many' },
    { top_p: 'high' },
    { frequency_penalty: 'high' },
    { presence_penalty: 'high' },
    { stop: [42] },
    { stream: 'yes' },
  ])('rejects malformed internal fields: $tools $metadata $model', (fields) => {
    const manager = new DataImportExportManager()
    const data = {
      messages: [{ role: 'user', content: 'hello' }],
      ...fields,
    }

    expect(manager.importFromClipboard(JSON.stringify(data))).toEqual(
      expect.objectContaining({ success: false }),
    )
  })
})
