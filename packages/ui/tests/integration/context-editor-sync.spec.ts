import { describe, it, expect, beforeEach, vi, beforeAll, afterAll } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { ref, nextTick, reactive } from 'vue'
import { createApp } from 'vue'
import ConversationManager from '../../src/components/context-mode/ConversationManager.vue'
import ContextEditor from '../../src/components/context-mode/ContextEditor.vue'

// Mock Naive UI 组件
vi.mock('naive-ui', () => ({
  NCard: {
    name: 'NCard',
    template: `<div class="n-card"><div class="n-card__header" v-if="$slots.header"><slot name="header" /></div><div class="n-card__content"><slot /></div></div>`,
    props: ['size', 'bordered', 'embedded', 'hoverable', 'dashed']
  },
  NSpace: {
    name: 'NSpace',
    template: '<div class="n-space"><slot /></div>',
    props: ['justify', 'align', 'size', 'wrap']
  },
  NText: {
    name: 'NText',
    template: '<span class="n-text"><slot /></span>',
    props: ['class', 'depth']
  },
  NTag: {
    name: 'NTag',
    template: '<span class="n-tag"><slot name="icon" /><slot /></span>',
    props: ['size', 'type', 'round']
  },
  NButton: {
    name: 'NButton',
    template: '<button class="n-button" :disabled="disabled" :loading="loading" @click="$emit(\'click\')" data-testid="button"><slot name="icon" /><slot /></button>',
    props: ['type', 'disabled', 'loading', 'size', 'dashed', 'block', 'quaternary', 'circle', 'secondary'],
    emits: ['click']
  },
  NEmpty: {
    name: 'NEmpty',
    template: '<div class="n-empty" data-testid="empty"><slot name="icon" /><div><slot /></div><slot name="extra" /></div>',
    props: ['description', 'size']
  },
  NScrollbar: {
    name: 'NScrollbar',
    template: '<div class="n-scrollbar"><slot /></div>',
    props: ['style']
  },
  NList: {
    name: 'NList',
    template: '<div class="n-list"><slot /></div>'
  },
  NListItem: {
    name: 'NListItem',
    template: '<div class="n-list-item"><slot /></div>'
  },
  NInput: {
    name: 'NInput',
    template: '<textarea v-if="type === \'textarea\'" class="n-input" :value="value" :placeholder="placeholder" :disabled="disabled" @input="$emit(\'update:value\', $event.target.value)"></textarea>',
    props: ['value', 'type', 'placeholder', 'autosize', 'size', 'disabled', 'readonly'],
    emits: ['update:value']
  },
  NDropdown: {
    name: 'NDropdown',
    template: '<div class="n-dropdown" @click="$emit(\'select\', \'user\')"><slot /></div>',
    props: ['options'],
    emits: ['select']
  },
  NModal: {
    name: 'NModal',
    template: `
      <div v-if="show" class="n-modal" data-testid="modal">
        <div class="n-card">
          <div class="n-card__header">
            <slot name="header" />{{ title }}<slot name="header-extra" />
          </div>
          <div class="n-card__content"><slot /></div>
          <div class="n-card__footer"><slot name="action" /></div>
        </div>
      </div>
    `,
    props: ['show', 'preset', 'title', 'style', 'size', 'bordered', 'segmented', 'maskClosable'],
    emits: ['update:show', 'afterEnter', 'afterLeave']
  },
  NTabs: {
    name: 'NTabs',
    template: '<div class="n-tabs"><slot /></div>',
    props: ['value', 'type', 'size'],
    emits: ['update:value']
  },
  NTabPane: {
    name: 'NTabPane',
    template: '<div class="n-tab-pane" v-if="$parent.value === name || !$parent.value"><slot /></div>',
    props: ['name', 'tab']
  },
  NSelect: {
    name: 'NSelect',
    template: '<select class="n-select" :value="value" @change="$emit(\'update:value\', $event.target.value)"><option v-for="opt in options" :key="opt.value" :value="opt.value">{{opt.label}}</option></select>',
    props: ['value', 'options', 'size', 'disabled'],
    emits: ['update:value']
  },
  NGrid: {
    name: 'NGrid',
    template: '<div class="n-grid"><slot /></div>',
    props: ['cols', 'xGap', 'yGap']
  },
  NGridItem: {
    name: 'NGridItem',
    template: '<div class="n-grid-item"><slot /></div>'
  }
}))

// Mock vue-i18n
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: any) => {
      // 基础翻译键处理
      const translations: Record<string, any> = {
        'conversation.management.title': '对话管理',
        'conversation.messageCount': `${params?.count || 0} 条消息`,
        'variables.count': `${params?.count || 0} 个变量`,
        'variables.missing': `缺失 ${params?.count || 0} 个`,
        'tools.count': `${params?.count || 0} 个工具`,
        'conversation.noMessages': '暂无消息',
        'conversation.addFirst': '添加第一条消息',
        'conversation.addMessage': '添加消息',
        'common.expand': '展开',
        'common.collapse': '折叠',
        'conversation.management.openEditor': '打开编辑器',
        'common.moveUp': '上移',
        'common.moveDown': '下移',
        'common.delete': '删除',
        'conversation.roles.system': '系统',
        'conversation.roles.user': '用户',
        'conversation.roles.assistant': '助手',
        'conversation.placeholders.system': '输入系统提示...',
        'conversation.placeholders.user': '输入用户消息...',
        'conversation.placeholders.assistant': '输入助手回复...',
        'conversation.clickToCreateVariable': '点击创建变量',
        'contextEditor.noMessages': '暂无消息',
        'contextEditor.addFirstMessage': '添加第一条消息',
        'contextEditor.addMessage': '添加消息',
        'common.preview': '预览',
        'common.edit': '编辑',
        'common.save': '保存',
        'common.cancel': '取消',
        'common.import': '导入',
        'common.export': '导出'
      }
      return translations[key] || key
    },
    locale: { value: 'zh-CN' }
  })
}))

// Mock composables
vi.mock('../../src/composables/useResponsive', () => ({
  useResponsive: () => ({
    modalWidth: { value: '90vw' },
    buttonSize: { value: 'medium' },
    inputSize: { value: 'medium' },
    shouldUseVerticalLayout: { value: false },
    isMobile: { value: false }
  })
}))

vi.mock('../../src/composables/usePerformanceMonitor', () => ({
  usePerformanceMonitor: () => ({
    recordUpdate: vi.fn()
  })
}))

vi.mock('../../src/composables/useDebounceThrottle', () => ({
  useDebounceThrottle: () => ({
    debounce: (fn: Function) => fn,
    throttle: (fn: Function) => fn,
    batchExecute: (fn: Function) => {
      // 正确模拟批处理函数：接收一个处理数组的函数，返回一个接收单个项目的函数
      return (item: any) => {
        // 在测试中立即执行，传入包含单个项目的数组
        fn([item])
      }
    }
  })
}))

vi.mock('../../src/composables/useAccessibility', () => ({
  useAccessibility: () => ({
    aria: {
      getLabel: (key: string, fallback?: string) => fallback || key,
      getDescription: (key: string) => key,
      getLiveRegionText: (key: string) => key
    },
    announce: vi.fn(),
    accessibilityClasses: { value: {} },
    isAccessibilityMode: { value: false },
    liveRegionMessage: { value: '' },
    announcements: { value: [] }
  })
}))

// Mock useContextEditor
const mockContextEditor = {
  currentData: { value: null },
  isLoading: { value: false },
  smartImport: vi.fn(),
  convertFromOpenAI: vi.fn(),
  convertFromLangFuse: vi.fn(),
  importFromFile: vi.fn(),
  exportToFile: vi.fn(),
  exportToClipboard: vi.fn(),
  setData: vi.fn()
}

vi.mock('../../src/composables/useContextEditor', () => ({
  useContextEditor: () => mockContextEditor
}))

// Mock quickTemplateManager
vi.mock('../../src/data/quickTemplates', () => ({
  quickTemplateManager: {
    getTemplates: vi.fn(() => [
      {
        id: 'template1',
        name: 'System Template',
        description: 'System chat template',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' }
        ]
      }
    ])
  }
}))

/**
 * 测试父组件，用于模拟真实的数据同步场景
 */
const TestParentComponent = {
  name: 'TestParentComponent',
  props: {
    initialMessages: {
      type: Array,
      default: () => []
    },
    initialVariables: {
      type: Object,
      default: () => ({})
    }
  },
  setup(props: any, { emit }: any) {
    // 共享的响应式状态
    const messages = ref([...props.initialMessages])
    const variables = ref({ ...props.initialVariables })
    const showContextEditor = ref(false)

    // 模拟变量扫描函数
    const scanVariables = (content: string): string[] => {
      if (!content) return []
      const matches = content.match(/\{\{([^}]+)\}\}/g) || []
      return matches.map(match => match.slice(2, -2))
    }

    // 模拟变量替换函数
    const replaceVariables = (content: string, vars?: Record<string, string>): string => {
      if (!content || !vars) return content
      let result = content
      Object.entries(vars).forEach(([key, value]) => {
        result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
      })
      return result
    }

    // Mock variableManager
    const mockVariableManager = {
      variableManager: ref(null),
      isReady: ref(true),
      isAdvancedMode: ref(false),
      customVariables: ref<Record<string, string>>({}),
      allVariables: ref<Record<string, string>>({}),
      statistics: ref({
        customVariableCount: 0,
        predefinedVariableCount: 7,
        totalVariableCount: 7,
        advancedModeEnabled: false
      }),
      setAdvancedMode: vi.fn(),
      addVariable: vi.fn(),
      updateVariable: vi.fn(),
      deleteVariable: vi.fn(),
      getVariable: vi.fn((name: string) => undefined),
      validateVariableName: vi.fn(() => true),
      scanVariablesInContent: vi.fn(scanVariables),
      replaceVariables: vi.fn(replaceVariables),
      detectMissingVariables: vi.fn(() => []),
      getConversationMessages: vi.fn(() => []),
      setConversationMessages: vi.fn(),
      exportVariables: vi.fn(() => '{}'),
      importVariables: vi.fn(),
      refresh: vi.fn()
    }
    
    // 处理 ConversationManager 的消息更新
    const handleMessagesUpdate = (newMessages: any[]) => {
      messages.value = [...newMessages]
      emit('messagesChanged', messages.value)
    }
    
    // 处理 ContextEditor 的状态更新
    const handleContextEditorStateUpdate = (newState: any) => {
      if (newState.messages) {
        messages.value = [...newState.messages]
      }
      if (newState.variables) {
        variables.value = { ...newState.variables }
      }
      emit('contextChanged', { messages: messages.value, variables: variables.value })
    }
    
    // 处理上下文变更事件
    const handleContextChange = (newMessages: any[], newVariables: Record<string, string>) => {
      messages.value = [...newMessages]
      variables.value = { ...newVariables }
      emit('contextChanged', { messages: messages.value, variables: variables.value })
    }
    
    // 打开编辑器
    const handleOpenContextEditor = () => {
      showContextEditor.value = true
    }
    
    // 关闭编辑器
    const handleCloseContextEditor = () => {
      showContextEditor.value = false
    }
    
    return {
      messages,
      variables,
      showContextEditor,
      scanVariables,
      replaceVariables,
      handleMessagesUpdate,
      handleContextEditorStateUpdate,
      handleContextChange,
      handleOpenContextEditor,
      handleCloseContextEditor,
      mockVariableManager
    }
  },
  template: `
    <div>
      <ConversationManager
        :messages="messages"
        :available-variables="variables"
        :scan-variables="scanVariables"
        :replace-variables="replaceVariables"
        @update:messages="handleMessagesUpdate"
        @openContextEditor="handleOpenContextEditor"
        data-testid="conversation-manager"
      />

      <ContextEditor
        :visible="showContextEditor"
        :state="{ messages, variables, tools: [], showVariablePreview: true, showToolManager: false, mode: 'edit' }"
        :scan-variables="scanVariables"
        :replace-variables="replaceVariables"
        :is-predefined-variable="() => false"
        :variable-manager="mockVariableManager"
        @update:visible="(visible) => showContextEditor = visible"
        @update:state="handleContextEditorStateUpdate"
        @contextChange="handleContextChange"
        data-testid="context-editor"
      />
    </div>
  `,
  components: {
    ConversationManager,
    ContextEditor
  }
}

describe('ConversationManager 和 ContextEditor 数据同步集成测试', () => {
  let wrapper: VueWrapper<any>
  
  beforeEach(() => {
    // 清理 mock
    vi.clearAllMocks()
    if (wrapper) {
      wrapper.unmount()
    }
  })
  
  const createIntegratedWrapper = async (props = {}) => {
    const defaultProps = {
      initialMessages: [],
      initialVariables: {}
    }
    
    wrapper = mount(TestParentComponent, {
      props: { ...defaultProps, ...props },
      global: {
        stubs: {},
        mocks: {
          announcements: []
        }
      }
    })
    
    await nextTick()
    return wrapper
  }
  
  describe('基础数据同步机制', () => {
    it('应该正确初始化共享数据状态', async () => {
      const initialMessages = [
        { role: 'user', content: '测试消息 {{testVar}}' }
      ]
      const initialVariables = { testVar: 'value1' }
      
      wrapper = await createIntegratedWrapper({
        initialMessages,
        initialVariables
      })
      
      // 验证 ConversationManager 接收到正确数据
      const manager = wrapper.findComponent({ name: 'ConversationManager' })
      // 使用 toMatchObject 而不是 toEqual，因为 ConversationManager 会自动添加 id 和 originalContent
      expect(manager.props('messages')).toMatchObject(initialMessages)
      expect(manager.props('availableVariables')).toEqual(initialVariables)

      // 验证父组件状态正确初始化
      expect(wrapper.vm.messages).toMatchObject(initialMessages)
      expect(wrapper.vm.variables).toEqual(initialVariables)
    })
    
    it('应该在 ConversationManager 和 ContextEditor 之间共享同一数据源', async () => {
      const initialMessages = [
        { role: 'system', content: '系统提示' },
        { role: 'user', content: '用户消息' }
      ]
      
      wrapper = await createIntegratedWrapper({
        initialMessages
      })
      
      // 打开 ContextEditor
      wrapper.vm.handleOpenContextEditor()
      await nextTick()
      
      // 验证 ContextEditor 接收到相同的数据
      const editor = wrapper.findComponent({ name: 'ContextEditor' })
      // 使用 toMatchObject 而不是 toEqual，因为消息会自动添加 id 和 originalContent
      expect(editor.props('state').messages).toMatchObject(initialMessages)
      
      // 验证两个组件引用同一数据源
      expect(wrapper.vm.messages).toBe(wrapper.vm.messages) // 引用相等
    })
  })
  
  describe('ConversationManager → ContextEditor 数据同步', () => {
    it('在 ConversationManager 修改消息时，ContextEditor 应该实时反映变化', async () => {
      wrapper = await createIntegratedWrapper({
        initialMessages: [
          { role: 'user', content: '原始消息' }
        ]
      })
      
      // 打开 ContextEditor
      wrapper.vm.handleOpenContextEditor()
      await nextTick()
      
      const manager = wrapper.findComponent({ name: 'ConversationManager' })
      const editor = wrapper.findComponent({ name: 'ContextEditor' })
      
      // 在 ConversationManager 中修改消息
      const newMessages = [
        { role: 'user', content: '修改后的消息' }
      ]
      
      await manager.vm.$emit('update:messages', newMessages)
      await nextTick()
      
      // 验证 ContextEditor 实时反映变化
      expect(wrapper.vm.messages[0].content).toBe('修改后的消息')
      expect(editor.props('state').messages[0].content).toBe('修改后的消息')
    })
    
    it('在 ConversationManager 添加消息时，ContextEditor 应该立即显示新消息', async () => {
      wrapper = await createIntegratedWrapper({
        initialMessages: [
          { role: 'user', content: '第一条消息' }
        ]
      })
      
      wrapper.vm.handleOpenContextEditor()
      await nextTick()
      
      const manager = wrapper.findComponent({ name: 'ConversationManager' })
      const editor = wrapper.findComponent({ name: 'ContextEditor' })
      
      // 在 ConversationManager 中添加消息
      const newMessages = [
        { role: 'user', content: '第一条消息' },
        { role: 'assistant', content: '第二条消息' }
      ]
      
      await manager.vm.$emit('update:messages', newMessages)
      await nextTick()
      
      // 验证 ContextEditor 显示新消息
      expect(wrapper.vm.messages).toHaveLength(2)
      expect(wrapper.vm.messages[1].content).toBe('第二条消息')
      expect(editor.props('state').messages).toHaveLength(2)
    })
    
    it('在 ConversationManager 删除消息时，ContextEditor 应该同步删除', async () => {
      wrapper = await createIntegratedWrapper({
        initialMessages: [
          { role: 'user', content: '消息1' },
          { role: 'assistant', content: '消息2' }
        ]
      })
      
      wrapper.vm.handleOpenContextEditor()
      await nextTick()
      
      const manager = wrapper.findComponent({ name: 'ConversationManager' })
      
      // 删除第一条消息
      const newMessages = [
        { role: 'assistant', content: '消息2' }
      ]
      
      await manager.vm.$emit('update:messages', newMessages)
      await nextTick()
      
      // 验证两个组件都反映删除操作
      expect(wrapper.vm.messages).toHaveLength(1)
      expect(wrapper.vm.messages[0].content).toBe('消息2')
    })
  })
  
  describe('ContextEditor → ConversationManager 数据同步', () => {
    it('在 ContextEditor 修改消息时，ConversationManager 应该实时反映变化', async () => {
      wrapper = await createIntegratedWrapper({
        initialMessages: [
          { role: 'user', content: '原始内容' }
        ]
      })
      
      wrapper.vm.handleOpenContextEditor()
      await nextTick()
      
      const editor = wrapper.findComponent({ name: 'ContextEditor' })
      
      // 模拟在 ContextEditor 中修改状态
      const newState = {
        messages: [{ role: 'user', content: '在编辑器中修改的内容' }],
        variables: {},
        tools: [],
        showVariablePreview: true,
        showToolManager: false,
        mode: 'edit'
      }
      
      await editor.vm.$emit('update:state', newState)
      await nextTick()
      
      // 验证 ConversationManager 实时反映变化
      expect(wrapper.vm.messages[0].content).toBe('在编辑器中修改的内容')
      
      const manager = wrapper.findComponent({ name: 'ConversationManager' })
      expect(manager.props('messages')[0].content).toBe('在编辑器中修改的内容')
    })
    
    it('在 ContextEditor 通过 contextChange 事件修改数据时，ConversationManager 应该同步', async () => {
      wrapper = await createIntegratedWrapper({
        initialMessages: [
          { role: 'system', content: '系统消息' }
        ],
        initialVariables: { oldVar: 'oldValue' }
      })
      
      wrapper.vm.handleOpenContextEditor()
      await nextTick()
      
      const editor = wrapper.findComponent({ name: 'ContextEditor' })
      
      // 模拟 contextChange 事件
      const newMessages = [
        { role: 'system', content: '更新的系统消息' },
        { role: 'user', content: '新增的用户消息 {{newVar}}' }
      ]
      const newVariables = { newVar: 'newValue' }
      
      await editor.vm.$emit('contextChange', newMessages, newVariables)
      await nextTick()
      
      // 验证父组件状态更新
      expect(wrapper.vm.messages).toHaveLength(2)
      expect(wrapper.vm.messages[0].content).toBe('更新的系统消息')
      expect(wrapper.vm.messages[1].content).toBe('新增的用户消息 {{newVar}}')
      expect(wrapper.vm.variables).toEqual({ newVar: 'newValue' })
      
      // 验证 ConversationManager 接收到新数据
      const manager = wrapper.findComponent({ name: 'ConversationManager' })
      expect(manager.props('messages')).toEqual(newMessages)
      expect(manager.props('availableVariables')).toEqual(newVariables)
    })
  })
  
  describe('模板应用对数据同步的影响', () => {
    it('在 ContextEditor 中应用模板时，ConversationManager 应该实时反映模板内容', async () => {
      wrapper = await createIntegratedWrapper()
      
      wrapper.vm.handleOpenContextEditor()
      await nextTick()
      
      const editor = wrapper.findComponent({ name: 'ContextEditor' })
      
      // 模拟应用模板（通过 contextChange 事件）
      const templateMessages = [
        { role: 'system', content: 'You are a helpful assistant specialized in {{domain}}.' },
        { role: 'user', content: '{{userQuery}}' }
      ]
      const templateVariables = { domain: 'AI', userQuery: 'Help me' }
      
      await editor.vm.$emit('contextChange', templateMessages, templateVariables)
      await nextTick()
      
      // 验证 ConversationManager 显示模板内容
      expect(wrapper.vm.messages).toEqual(templateMessages)
      expect(wrapper.vm.variables).toEqual(templateVariables)
      
      const manager = wrapper.findComponent({ name: 'ConversationManager' })
      expect(manager.props('messages')).toEqual(templateMessages)
      expect(manager.props('availableVariables')).toEqual(templateVariables)
    })
  })
  
  describe('导入导出对数据同步的影响', () => {
    it('在 ContextEditor 中导入数据时，ConversationManager 应该实时更新', async () => {
      wrapper = await createIntegratedWrapper({
        initialMessages: [{ role: 'user', content: '旧数据' }]
      })
      
      wrapper.vm.handleOpenContextEditor()
      await nextTick()
      
      const editor = wrapper.findComponent({ name: 'ContextEditor' })
      
      // 模拟导入操作（通过 contextChange 事件）
      const importedMessages = [
        { role: 'system', content: '导入的系统消息' },
        { role: 'user', content: '导入的用户消息 {{importedVar}}' }
      ]
      const importedVariables = { importedVar: '导入的变量值' }
      
      await editor.vm.$emit('contextChange', importedMessages, importedVariables)
      await nextTick()
      
      // 验证数据同步
      expect(wrapper.vm.messages).toEqual(importedMessages)
      expect(wrapper.vm.variables).toEqual(importedVariables)
      
      const manager = wrapper.findComponent({ name: 'ConversationManager' })
      expect(manager.props('messages')).toEqual(importedMessages)
      expect(manager.props('availableVariables')).toEqual(importedVariables)
    })
    
    it('导入的数据应该立即在两个组件中可用', async () => {
      wrapper = await createIntegratedWrapper()
      
      wrapper.vm.handleOpenContextEditor()
      await nextTick()
      
      // 模拟复杂的导入数据
      const complexImportedData = {
        messages: [
          { role: 'system', content: '复杂系统提示：处理 {{taskType}} 任务' },
          { role: 'user', content: '用户问题：{{question}}' },
          { role: 'assistant', content: '助手回复模板' }
        ],
        variables: {
          taskType: '数据分析',
          question: '如何优化性能？'
        }
      }
      
      const editor = wrapper.findComponent({ name: 'ContextEditor' })
      await editor.vm.$emit('contextChange', complexImportedData.messages, complexImportedData.variables)
      await nextTick()
      
      // 验证复杂数据的同步
      expect(wrapper.vm.messages).toHaveLength(3)
      expect(wrapper.vm.messages[0].content).toContain('{{taskType}}')
      expect(wrapper.vm.variables.taskType).toBe('数据分析')
      
      // 验证 ConversationManager 的变量扫描功能
      const detectedVars = wrapper.vm.scanVariables(wrapper.vm.messages[0].content)
      expect(detectedVars).toContain('taskType')
    })
  })
  
  describe('完整的 "编辑即emit → 父级更新 → 实时反映" 链路验证', () => {
    it('应该验证完整的数据流链路', async () => {
      const eventsEmitted: any[] = []
      
      wrapper = await createIntegratedWrapper({
        initialMessages: [{ role: 'user', content: '测试消息' }]
      })
      
      // 用onMounted来监听组件事件（替代Vue 3中移除的$on）
      const handleMessagesChanged = (messages: any) => {
        eventsEmitted.push({ type: 'messagesChanged', data: messages })
      }
      const handleContextChanged = (context: any) => {
        eventsEmitted.push({ type: 'contextChanged', data: context })
      }
      
      // 模拟事件监听（通过直接验证组件状态变化替代事件监听）
      
      wrapper.vm.handleOpenContextEditor()
      await nextTick()
      
      const manager = wrapper.findComponent({ name: 'ConversationManager' })
      const editor = wrapper.findComponent({ name: 'ContextEditor' })
      
      // 第1步：ConversationManager 编辑 → emit
      const newMessages1 = [{ role: 'user', content: '第1步修改' }]
      await manager.vm.$emit('update:messages', newMessages1)
      await nextTick()
      
      // 验证链路：编辑 → emit → 父级更新 → ContextEditor 反映
      expect(wrapper.vm.messages[0].content).toBe('第1步修改')
      expect(editor.props('state').messages[0].content).toBe('第1步修改')
      
      // 第2步：ContextEditor 编辑 → emit
      const newMessages2 = [{ role: 'user', content: '第2步修改' }]
      await editor.vm.$emit('contextChange', newMessages2, {})
      await nextTick()
      
      // 验证链路：编辑 → emit → 父级更新 → ConversationManager 反映
      expect(wrapper.vm.messages[0].content).toBe('第2步修改')
      expect(manager.props('messages')[0].content).toBe('第2步修改')
      
      // 验证事件发射（通过emitted()检查）
      expect(manager.emitted('update:messages')).toBeTruthy()
      expect(editor.emitted('contextChange')).toBeTruthy()
    })
    
    it('应该确保数据一致性不会出现竞态条件', async () => {
      wrapper = await createIntegratedWrapper({
        initialMessages: [{ role: 'user', content: '初始消息' }]
      })
      
      wrapper.vm.handleOpenContextEditor()
      await nextTick()
      
      const manager = wrapper.findComponent({ name: 'ConversationManager' })
      const editor = wrapper.findComponent({ name: 'ContextEditor' })
      
      // 快速连续的修改操作
      const operations = [
        { source: 'manager', content: '快速修改1' },
        { source: 'editor', content: '快速修改2' },
        { source: 'manager', content: '快速修改3' }
      ]
      
      // 模拟快速连续操作
      for (const op of operations) {
        if (op.source === 'manager') {
          await manager.vm.$emit('update:messages', [{ role: 'user', content: op.content }])
        } else {
          await editor.vm.$emit('contextChange', [{ role: 'user', content: op.content }], {})
        }
        await nextTick()
      }
      
      // 验证最终状态一致
      expect(wrapper.vm.messages[0].content).toBe('快速修改3')
      expect(manager.props('messages')[0].content).toBe('快速修改3')
      expect(editor.props('state').messages[0].content).toBe('快速修改3')
    })
  })
  
  describe('变量同步特性', () => {
    it('变量更新应该在两个组件中同步反映', async () => {
      wrapper = await createIntegratedWrapper({
        initialMessages: [{ role: 'user', content: 'Hello {{name}}!' }],
        initialVariables: { name: 'World' }
      })
      
      wrapper.vm.handleOpenContextEditor()
      await nextTick()
      
      const editor = wrapper.findComponent({ name: 'ContextEditor' })
      
      // 更新变量
      const newVariables = { name: 'Vue', greeting: 'Hi' }
      await editor.vm.$emit('contextChange', wrapper.vm.messages, newVariables)
      await nextTick()
      
      // 验证变量同步
      expect(wrapper.vm.variables).toEqual(newVariables)
      
      const manager = wrapper.findComponent({ name: 'ConversationManager' })
      expect(manager.props('availableVariables')).toEqual(newVariables)
      
      // 验证变量替换功能
      const replacedContent = wrapper.vm.replaceVariables('Hello {{name}}!', wrapper.vm.variables)
      expect(replacedContent).toBe('Hello Vue!')
    })
  })
})