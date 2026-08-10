import { beforeEach, describe, expect, it, vi } from 'vitest'

const toastSpies = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
}))

const serviceMocks = vi.hoisted(() => ({
  converter: {
    fromLangFuse: vi.fn(),
    fromOpenAI: vi.fn(),
    fromConversationMessages: vi.fn(),
    validate: vi.fn(),
  },
  variableExtractor: {
    extractVariable: vi.fn(),
    suggestVariableNames: vi.fn(() => []),
  },
  importExportManager: {
    detectFormat: vi.fn(),
    importFromFile: vi.fn(),
    importFromClipboard: vi.fn(),
    exportToFile: vi.fn(),
    exportToClipboard: vi.fn(),
  },
  templateProcessor: {
    toTemplate: vi.fn(),
    fromTemplate: vi.fn(),
    validateVariables: vi.fn(),
    suggestOptimizations: vi.fn(() => []),
  },
}))

vi.mock('../../../src/composables/ui/useToast', () => ({
  useToast: () => toastSpies,
}))

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string, params?: Record<string, unknown>) =>
        params ? `${key}:${JSON.stringify(params)}` : key,
    }),
  }
})

vi.mock('../../../src/services', () => ({
  PromptDataConverter: class PromptDataConverter {
    constructor() {
      return serviceMocks.converter
    }
  },
  SmartVariableExtractor: class SmartVariableExtractor {
    constructor() {
      return serviceMocks.variableExtractor
    }
  },
  DataImportExportManager: class DataImportExportManager {
    constructor() {
      return serviceMocks.importExportManager
    }
  },
  EnhancedTemplateProcessor: class EnhancedTemplateProcessor {
    constructor() {
      return serviceMocks.templateProcessor
    }
  },
}))

import { useContextEditor } from '../../../src/composables/context/useContextEditor'

describe('useContextEditor i18n feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses localized smart-import success messaging', () => {
    serviceMocks.importExportManager.detectFormat.mockReturnValue('langfuse')
    serviceMocks.converter.fromLangFuse.mockReturnValue({
      success: true,
      data: {
        messages: [],
        metadata: {},
      },
    })

    const editor = useContextEditor()
    editor.smartImport({ trace: true })

    expect(toastSpies.success).toHaveBeenCalledWith(
      'contextEditor.feedback.importSuccess:{"format":"contextEditor.feedback.formatLabels.langfuse"}',
    )
    expect(toastSpies.success).not.toHaveBeenCalledWith('LANGFUSE data imported successfully')
  })

  it('smart-imports the internal standard format without treating it as OpenAI', () => {
    const data = {
      messages: [{ role: 'user' as const, content: 'hello' }],
      tools: [],
      metadata: { source: 'manual' as const, origin: 'import_export_dialog' },
    }
    serviceMocks.importExportManager.detectFormat.mockReturnValue('standard')
    serviceMocks.converter.validate.mockReturnValue({ success: true, data: true })

    const editor = useContextEditor()
    const result = editor.smartImport(data)

    expect(result).toEqual({ success: true, data })
    expect(editor.currentData.value).toEqual(data)
    expect(toastSpies.success).toHaveBeenCalledWith(
      'contextEditor.feedback.importSuccess:{"format":"contextEditor.feedback.formatLabels.conversation"}',
    )
  })

  it('uses localized no-data-export feedback', async () => {
    const editor = useContextEditor()

    const result = await editor.exportToClipboard('standard')

    expect(result).toBe(false)
    expect(toastSpies.error).toHaveBeenCalledWith('contextEditor.feedback.noDataToExport')
    expect(toastSpies.error).not.toHaveBeenCalledWith('No data available to export')
  })
})
