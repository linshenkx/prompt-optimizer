import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ImportExportDialog from '../../../src/components/context-mode/ImportExportDialog.vue'

const mockConverter = {
  toOpenAI: vi.fn()
}

const mockContextEditor = {
  currentData: { value: null },
  isLoading: { value: false },
  smartImport: vi.fn(),
  convertFromOpenAI: vi.fn(),
  convertFromLangFuse: vi.fn(),
  importFromFile: vi.fn(),
  exportToFile: vi.fn(),
  exportToClipboard: vi.fn(),
  setData: vi.fn(),
  services: {
    converter: mockConverter
  }
}

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('../../../src/composables/context/useContextEditor', () => ({
  useContextEditor: () => mockContextEditor
}))

const naiveStubs = {
  NModal: {
    name: 'NModal',
    template: '<div v-if="show"><slot /><slot name="action" /></div>',
    props: ['show', 'title', 'preset', 'style'],
    emits: ['update:show']
  },
  NButton: {
    name: 'NButton',
    template: '<button @click="$emit(\'click\')" :disabled="disabled"><slot /></button>',
    props: ['type', 'disabled', 'loading', 'size', 'secondary'],
    emits: ['click']
  },
  NSpace: {
    name: 'NSpace',
    template: '<div class="n-space"><slot /></div>',
    props: ['size', 'align', 'justify', 'wrap']
  },
  NInput: {
    name: 'NInput',
    template: '<textarea v-if="type === \'textarea\'" :value="value" @input="$emit(\'update:value\', $event.target.value)"></textarea>',
    props: ['value', 'type', 'placeholder', 'autosize', 'readonly'],
    emits: ['update:value']
  },
  NText: {
    name: 'NText',
    template: '<span><slot /></span>',
    props: ['depth', 'type']
  }
}

type DialogProps = {
  visible: boolean;
  mode: 'import' | 'export';
  messages: any[];
  tools?: any[];
}

const createWrapper = (props?: Partial<DialogProps>) => {
  return mount(ImportExportDialog, {
    props: {
      visible: true,
      mode: 'import',
      messages: [],
      tools: [],
      ...props
    },
    global: {
      stubs: naiveStubs
    }
  })
}

describe('ImportExportDialog', () => {
  beforeEach(() => {
    mockContextEditor.currentData.value = null
    mockContextEditor.smartImport.mockReset()
    mockContextEditor.convertFromOpenAI.mockReset()
    mockContextEditor.convertFromLangFuse.mockReset()
    mockContextEditor.importFromFile.mockReset()
    mockContextEditor.exportToFile.mockReset()
    mockContextEditor.exportToClipboard.mockReset()
    mockContextEditor.setData.mockReset()
    mockContextEditor.exportToFile.mockReturnValue(true)
    mockContextEditor.exportToClipboard.mockResolvedValue(true)
    mockConverter.toOpenAI.mockReset()
    mockConverter.toOpenAI.mockImplementation((data) => ({
      success: true,
      data: {
        model: data.model || 'gpt-test',
        messages: data.messages,
        tools: data.tools
      }
    }))
  })

  it('应该提供完整的导入格式选项', () => {
    const wrapper = createWrapper()
    expect(wrapper.vm.importFormats.map(f => f.id)).toEqual(['smart', 'openai', 'langfuse', 'conversation'])
  })

  it('会话格式导入成功后应该触发 import-success 事件', async () => {
    const wrapper = createWrapper()
    wrapper.vm.selectedImportFormat = 'conversation'
    wrapper.vm.importData = JSON.stringify({
      messages: [{ role: 'user', content: 'hello' }]
    })

    await wrapper.vm.handleImportSubmit()

    const events = wrapper.emitted('import-success')
    expect(events).toBeTruthy()
    expect(events?.[0]?.[0]?.messages).toHaveLength(1)
    expect(wrapper.vm.importError).toBe('')
  })

  it('无效 JSON 数据会设置错误信息', async () => {
    const wrapper = createWrapper()
    wrapper.vm.importData = 'invalid json'
    wrapper.vm.selectedImportFormat = 'smart'

    await wrapper.vm.handleImportSubmit()

    expect(wrapper.vm.importError.length).toBeGreaterThan(0)
  })

  it('导出预览应该与实际导出结构一致', async () => {
    const wrapper = createWrapper({
      mode: 'export',
      messages: [{ role: 'user', content: 'test' }],
      tools: [{ type: 'function', function: { name: 'tool', description: 'desc', parameters: {} } }]
    })

    await nextTick()

    const preview = JSON.parse(wrapper.vm.exportPreviewData)
    expect(preview.messages).toHaveLength(1)
    expect(preview.tools).toHaveLength(1)
    expect(preview.metadata.origin).toBe('import_export_dialog')
  })

  it('导出成功会触发 export-success 并清除错误信息', async () => {
    const wrapper = createWrapper({
      mode: 'export',
      messages: [{ role: 'user', content: 'test' }]
    })

    await wrapper.vm.handleExportToFile()

    expect(wrapper.emitted('export-success')).toBeTruthy()
    expect(wrapper.vm.exportError).toBe('')
  })

  it('导出失败会展示错误并触发 export-error', async () => {
    mockContextEditor.exportToClipboard.mockResolvedValueOnce(false)
    const wrapper = createWrapper({
      mode: 'export',
      messages: [{ role: 'user', content: 'test' }]
    })

    await wrapper.vm.handleExportToClipboard()

    expect(wrapper.vm.exportError).toContain('contextEditor.copyFailed')
    expect(wrapper.emitted('export-error')).toBeTruthy()
  })

  it('选择 OpenAI 格式时预览应基于转换结果', async () => {
    const wrapper = createWrapper({
      mode: 'export',
      messages: [{ role: 'user', content: 'preview' }]
    })

    wrapper.vm.selectedExportFormat = 'openai'
    await nextTick()

    const preview = JSON.parse(wrapper.vm.exportPreviewData)
    expect(preview.model).toBe('gpt-test')
    expect(preview.metadata).toBeUndefined()
  })
})
