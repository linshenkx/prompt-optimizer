import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { ref, nextTick } from 'vue'
import ContextEditor from '../../src/components/context-mode/ContextEditor.vue'
import { createContextRepo, MemoryStorageProvider } from '@prompt-optimizer/core'
import type { ContextRepo } from '@prompt-optimizer/core'

// Mock Naive UI 组件
vi.mock('naive-ui', () => ({
  NModal: {
    name: 'NModal',
    template: `
      <div v-if="show" class="n-modal" data-testid="modal">
        <div class="n-card">
          <div class="n-card__header">
            <slot name="header" />{{ title }}<slot name="header-extra" />
          </div>
          <div class="n-card__content"><slot /></div>
        </div>
      </div>
    `,
    props: ['show', 'preset', 'title', 'style', 'size', 'bordered', 'segmented', 'maskClosable'],
    emits: ['update:show', 'afterEnter', 'afterLeave']
  },
  NTabs: {
    name: 'NTabs',
    template: '<div class="n-tabs" data-testid="tabs"><slot /></div>',
    props: ['value', 'type', 'size'],
    emits: ['update:value']
  },
  NTabPane: {
    name: 'NTabPane',
    template: '<div class="n-tab-pane" v-if="$parent.value === name || !$parent.value" :data-testid="`tab-${name}`"><slot /></div>',
    props: ['name', 'tab']
  },
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
    props: ['class', 'depth', 'strong']
  },
  NTag: {
    name: 'NTag',
    template: '<span class="n-tag" :data-type="type"><slot name="icon" /><slot /></span>',
    props: ['size', 'type', 'round']
  },
  NButton: {
    name: 'NButton',
    template: '<button class="n-button" :disabled="disabled" :loading="loading" @click="$emit(\'click\')" :data-testid="$attrs[\'data-testid\'] || \'button\'"><slot name="icon" /><slot /></button>',
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
    template: '<textarea v-if="type === \'textarea\'" class="n-input" :value="value" :placeholder="placeholder" :disabled="disabled" @input="$emit(\'update:value\', $event.target.value)" data-testid="textarea"></textarea>',
    props: ['value', 'type', 'placeholder', 'autosize', 'size', 'disabled', 'readonly'],
    emits: ['update:value']
  },
  NSelect: {
    name: 'NSelect',
    template: '<select class="n-select" :value="value" @change="$emit(\'update:value\', $event.target.value)" data-testid="select"><option v-for="opt in options" :key="opt.value" :value="opt.value">{{opt.label}}</option></select>',
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
      const translations: Record<string, any> = {
        'contextEditor.noMessages': '暂无消息',
        'contextEditor.addFirstMessage': '添加第一条消息',
        'contextEditor.addMessage': '添加消息',
        'contextEditor.noVariables': '暂无变量',
        'contextEditor.addFirstVariable': '添加第一个变量覆盖',
        'contextEditor.addVariable': '添加变量',
        'contextEditor.variableOverrides': '上下文变量覆盖',
        'contextEditor.globalVariables': `全局: ${params?.count || 0}`,
        'contextEditor.overrideCount': `${params?.count || 0} 个覆盖`,
        'contextEditor.missingVariableHint': '点击缺失变量进入编辑模式',
        'conversation.clickToCreateVariable': '点击创建变量',
        'common.edit': '编辑',
        'common.preview': '预览',
        'common.save': '保存',
        'common.cancel': '取消',
        'common.delete': '删除',
        'common.moveUp': '上移',
        'common.moveDown': '下移'
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
    cardSize: { value: 'small' },
    tagSize: { value: 'small' },
    size: { value: 'medium' },
    shouldUseVerticalLayout: { value: false },
    isMobile: { value: false }
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
    announcements: { value: [] } // 添加缺失的 announcements 属性
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

/**
 * 测试组件包装器，集成ContextRepo进行持久化测试
 */
const TestContextEditorWithPersistence = {
  name: 'TestContextEditorWithPersistence',
  props: {
    initialState: {
      type: Object,
      default: () => ({
        messages: [],
        variables: {},
        tools: [],
        showVariablePreview: true,
        showToolManager: false,
        mode: 'edit'
      })
    }
  },
  setup(props: any, { emit }: any) {
    const visible = ref(true)
    const storage = new MemoryStorageProvider()
    const contextRepo = createContextRepo(storage)
    const currentContextId = ref<string | null>(null)

    // 模拟变量扫描函数
    const scanVariables = (content: string): string[] => {
      if (!content) return []
      const matches = content.match(/\{\{([^}]+)\}\}/g) || []
      return matches.map(match => match.slice(2, -2))
    }

    // 模拟变量替换函数
    const replaceVariables = (content: string, vars?: Record<string, string>): string => {
      if (!content) return content
      const allVars = { ...vars }
      let result = content
      Object.entries(allVars).forEach(([key, value]) => {
        result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
      })
      return result
    }

    // 检查是否为预定义变量
    const isPredefinedVariable = (name: string): boolean => {
      const predefined = ['originalPrompt', 'currentPrompt', 'userQuestion', 'conversationContext', 'iterateInput', 'lastOptimizedPrompt', 'toolsContext']
      return predefined.includes(name)
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
    
    // 处理状态更新并持久化
    const handleStateUpdate = async (newState: any) => {
      if (!currentContextId.value) {
        // 创建新上下文
        currentContextId.value = await contextRepo.create({ title: '测试上下文' })
      }
      
      // 持久化到ContextRepo
      await contextRepo.update(currentContextId.value, {
        messages: newState.messages || [],
        variables: newState.variables || {}
      })
      
      emit('stateChanged', newState)
    }
    
    // 处理上下文变更
    const handleContextChange = async (messages: any[], variables: Record<string, string>) => {
      if (!currentContextId.value) {
        currentContextId.value = await contextRepo.create({ title: '测试上下文' })
      }
      
      await contextRepo.update(currentContextId.value, {
        messages: messages || [],
        variables: variables || {}
      })
      
      emit('contextChanged', { messages, variables })
    }
    
    // 模拟刷新后的数据恢复
    const simulateRefresh = async () => {
      if (currentContextId.value) {
        const contextData = await contextRepo.get(currentContextId.value)
        return {
          messages: contextData.messages,
          variables: contextData.variables,
          tools: contextData.tools || [],
          showVariablePreview: true,
          showToolManager: false,
          mode: 'edit'
        }
      }
      return props.initialState
    }
    
    return {
      visible,
      contextRepo,
      currentContextId,
      scanVariables,
      replaceVariables,
      isPredefinedVariable,
      handleStateUpdate,
      handleContextChange,
      simulateRefresh,
      mockVariableManager
    }
  },
  template: `
    <ContextEditor
      v-model:visible="visible"
      :state="initialState"
      :scan-variables="scanVariables"
      :replace-variables="replaceVariables"
      :is-predefined-variable="isPredefinedVariable"
      :variable-manager="mockVariableManager"
      @update:state="handleStateUpdate"
      @contextChange="handleContextChange"
      data-testid="context-editor-with-persistence"
    />
  `,
  components: {
    ContextEditor
  }
}

describe('ContextEditor 持久化集成测试', () => {
  let wrapper: VueWrapper<any>
  
  beforeEach(() => {
    vi.clearAllMocks()
  })
  
  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })
  
  const createPersistenceWrapper = async (initialState = {}) => {
    const defaultState = {
      messages: [],
      variables: {},
      tools: [],
      showVariablePreview: true,
      showToolManager: false,
      mode: 'edit'
    }
    
    wrapper = mount(TestContextEditorWithPersistence, {
      props: {
        initialState: { ...defaultState, ...initialState }
      },
      global: {
        stubs: {},
        mocks: {
          announcements: []  // 在全局添加mock
        }
      }
    })
    
    await nextTick()
    return wrapper
  }

  describe('核心持久化功能验证', () => {
    it('应该创建ContextRepo并支持基本持久化', async () => {
      wrapper = await createPersistenceWrapper()
      
      // 验证包装器组件正确创建了存储和仓库（通过组件实例方法验证）
      expect(wrapper.vm.contextRepo).toBeDefined()
      expect(wrapper.vm.currentContextId).toBeDefined()
      
      // 验证辅助函数可用
      expect(typeof wrapper.vm.scanVariables).toBe('function')
      expect(typeof wrapper.vm.replaceVariables).toBe('function') 
      expect(typeof wrapper.vm.isPredefinedVariable).toBe('function')
      expect(typeof wrapper.vm.simulateRefresh).toBe('function')
    })
    
    it('应该支持变量扫描和替换功能', async () => {
      wrapper = await createPersistenceWrapper()
      
      // 测试变量扫描
      const content = 'Hello {{name}}, your task is {{task}}'
      const variables = wrapper.vm.scanVariables(content)
      expect(variables).toEqual(['name', 'task'])
      
      // 测试变量替换
      const values = { name: 'Alice', task: 'testing' }
      const replaced = wrapper.vm.replaceVariables(content, values)
      expect(replaced).toBe('Hello Alice, your task is testing')
      
      // 测试预定义变量检测
      expect(wrapper.vm.isPredefinedVariable('originalPrompt')).toBe(true)
      expect(wrapper.vm.isPredefinedVariable('customVar')).toBe(false)
    })
    
    it('应该支持上下文数据持久化', async () => {
      const testState = {
        messages: [
          { role: 'system', content: 'Test {{mode}} message' }
        ],
        variables: { mode: 'integration' }
      }
      
      wrapper = await createPersistenceWrapper(testState)
      
      // 模拟状态更新持久化
      await wrapper.vm.handleStateUpdate({
        messages: [
          ...testState.messages,
          { role: 'user', content: 'User message with {{param}}' }
        ],
        variables: { ...testState.variables, param: 'value' }
      })
      
      // 验证上下文已创建
      expect(wrapper.vm.currentContextId).toBeTruthy()
      
      // 验证状态更新事件被发射
      expect(wrapper.emitted('stateChanged')).toBeTruthy()
    })
    
    it('应该支持刷新后数据恢复', async () => {
      const initialData = {
        messages: [
          { role: 'user', content: 'Initial message with {{var}}' }
        ],
        variables: { var: 'initial' }
      }
      
      wrapper = await createPersistenceWrapper(initialData)
      
      // 模拟数据修改
      await wrapper.vm.handleContextChange(
        [
          ...initialData.messages,
          { role: 'assistant', content: 'Response with {{response}}' }
        ],
        { ...initialData.variables, response: 'result' }
      )
      
      // 验证上下文已创建并有数据
      expect(wrapper.vm.currentContextId).toBeTruthy()
      
      // 模拟刷新后恢复
      const restoredState = await wrapper.vm.simulateRefresh()
      
      // 验证数据正确恢复
      expect(restoredState.messages).toHaveLength(2)
      expect(restoredState.messages[1].content).toBe('Response with {{response}}')
      expect(restoredState.variables.response).toBe('result')
      expect(restoredState.variables.var).toBe('initial')
    })
    
    it('应该确保变量预览一致性', async () => {
      wrapper = await createPersistenceWrapper()
      
      const testContent = 'Processing {{task}} in {{mode}} environment'
      const testVariables = { task: 'analysis', mode: 'production' }
      
      // 验证变量扫描结果
      const detectedVars = wrapper.vm.scanVariables(testContent)
      expect(detectedVars).toEqual(['task', 'mode'])
      
      // 验证完整替换
      const fullyReplaced = wrapper.vm.replaceVariables(testContent, testVariables)
      expect(fullyReplaced).toBe('Processing analysis in production environment')
      
      // 验证缺失变量处理
      const partialVars = { task: 'analysis' } // mode 缺失
      const partiallyReplaced = wrapper.vm.replaceVariables(testContent, partialVars)
      expect(partiallyReplaced).toBe('Processing analysis in {{mode}} environment')
      
      // 验证缺失变量检测
      const availableVars = Object.keys(partialVars)
      const missingVars = detectedVars.filter(v => !availableVars.includes(v))
      expect(missingVars).toEqual(['mode'])
    })
  })
})
