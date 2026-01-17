/**
 * messageChainMap Key 格式迁移测试
 *
 * 验证从旧格式（mode:messageId）到新格式（messageId）的迁移逻辑
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import { useProMultiMessageSession } from '../../../src/stores/session/useProMultiMessageSession'
import { useConversationOptimization } from '../../../src/composables/prompt/useConversationOptimization'
import type { AppServices } from '../../../src/types/services'

// Mock dependencies
vi.mock('../../../src/stores/session/useProMultiMessageSession', () => ({
  useProMultiMessageSession: vi.fn()
}))

vi.mock('../../../src/composables/ui/useToast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn()
  })
}))

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key
    })
  }
})

describe('messageChainMap 迁移逻辑测试', () => {
  let mockSession: any
  let services: any
  let conversationMessages: any
  let optimizationMode: any
  let selectedOptimizeModel: any
  let selectedTemplate: any
  let selectedIterateTemplate: any

  beforeEach(() => {
    // Mock session store（标准模式，直接暴露字段）
    mockSession = {
      selectedMessageId: '',
      messageChainMap: {},
      selectMessage: vi.fn(),
      setMessageChainMap: vi.fn()
    }

    vi.mocked(useProMultiMessageSession).mockReturnValue(mockSession)

    // Mock services
    services = ref<AppServices | null>({
      historyManager: {
        getChain: vi.fn(),
        createNewChain: vi.fn(),
        addIteration: vi.fn()
      },
      promptService: {}
    } as any)

    conversationMessages = ref([])
    optimizationMode = ref('system')
    selectedOptimizeModel = ref('test-model')
    selectedTemplate = ref({ id: 'test-template', name: 'Test Template' })
    selectedIterateTemplate = ref({ id: 'test-iterate-template', name: 'Test Iterate Template' })
  })

  it('应该将旧格式 key (system:messageId) 迁移为新格式 (messageId)', () => {
    // 准备旧格式数据
    mockSession.messageChainMap = {
      'system:msg-123': 'chain-abc',
      'system:msg-456': 'chain-def',
      'user:msg-789': 'chain-ghi'
    }

    // 创建 composable
    const composable = useConversationOptimization(
      services,
      conversationMessages,
      optimizationMode,
      selectedOptimizeModel,
      selectedTemplate,
      selectedIterateTemplate
    )

    // 触发恢复（模拟应用启动时的 session restore）
    composable.restoreFromSessionStore()

    // 验证 messageChainMap 使用新格式
    expect(composable.messageChainMap.value.get('msg-123')).toBe('chain-abc')
    expect(composable.messageChainMap.value.get('msg-456')).toBe('chain-def')
    expect(composable.messageChainMap.value.get('msg-789')).toBe('chain-ghi')

    // 验证旧格式 key 不存在
    expect(composable.messageChainMap.value.has('system:msg-123')).toBe(false)
    expect(composable.messageChainMap.value.has('system:msg-456')).toBe(false)
    expect(composable.messageChainMap.value.has('user:msg-789')).toBe(false)

    // 验证迁移后自动保存到 session store
    expect(mockSession.setMessageChainMap).toHaveBeenCalledWith({
      'msg-123': 'chain-abc',
      'msg-456': 'chain-def',
      'msg-789': 'chain-ghi'
    })
  })

  it('应该正确处理新格式 key（不需要迁移）', () => {
    // 准备新格式数据
    mockSession.messageChainMap = {
      'msg-123': 'chain-abc',
      'msg-456': 'chain-def'
    }

    const composable = useConversationOptimization(
      services,
      conversationMessages,
      optimizationMode,
      selectedOptimizeModel,
      selectedTemplate,
      selectedIterateTemplate
    )

    composable.restoreFromSessionStore()

    // 验证数据正确恢复
    expect(composable.messageChainMap.value.get('msg-123')).toBe('chain-abc')
    expect(composable.messageChainMap.value.get('msg-456')).toBe('chain-def')

    // 验证没有触发迁移保存（因为都是新格式）
    expect(mockSession.setMessageChainMap).not.toHaveBeenCalled()
  })

  it('应该正确处理混合格式数据（部分旧格式，部分新格式）', () => {
    // 准备混合格式数据
    mockSession.messageChainMap = {
      'system:msg-old-1': 'chain-old-1',
      'msg-new-1': 'chain-new-1',
      'user:msg-old-2': 'chain-old-2',
      'msg-new-2': 'chain-new-2'
    }

    const composable = useConversationOptimization(
      services,
      conversationMessages,
      optimizationMode,
      selectedOptimizeModel,
      selectedTemplate,
      selectedIterateTemplate
    )

    composable.restoreFromSessionStore()

    // 验证所有数据都使用新格式
    expect(composable.messageChainMap.value.get('msg-old-1')).toBe('chain-old-1')
    expect(composable.messageChainMap.value.get('msg-new-1')).toBe('chain-new-1')
    expect(composable.messageChainMap.value.get('msg-old-2')).toBe('chain-old-2')
    expect(composable.messageChainMap.value.get('msg-new-2')).toBe('chain-new-2')

    // 验证迁移后保存
    expect(mockSession.setMessageChainMap).toHaveBeenCalledWith({
      'msg-old-1': 'chain-old-1',
      'msg-new-1': 'chain-new-1',
      'msg-old-2': 'chain-old-2',
      'msg-new-2': 'chain-new-2'
    })
  })

  it('应该正确处理空数据', () => {
    mockSession.messageChainMap = {}

    const composable = useConversationOptimization(
      services,
      conversationMessages,
      optimizationMode,
      selectedOptimizeModel,
      selectedTemplate,
      selectedIterateTemplate
    )

    composable.restoreFromSessionStore()

    // 验证 Map 为空
    expect(composable.messageChainMap.value.size).toBe(0)

    // 验证没有触发保存
    expect(mockSession.setMessageChainMap).not.toHaveBeenCalled()
  })

  it('应该忽略非 system 模式的迁移（只在 Pro-system 模式触发）', () => {
    mockSession.messageChainMap = {
      'system:msg-123': 'chain-abc'
    }

    // 切换到 user 模式
    optimizationMode.value = 'user'

    const composable = useConversationOptimization(
      services,
      conversationMessages,
      optimizationMode,
      selectedOptimizeModel,
      selectedTemplate,
      selectedIterateTemplate
    )

    composable.restoreFromSessionStore()

    // 验证 Map 仍为空（因为不是 system 模式）
    expect(composable.messageChainMap.value.size).toBe(0)

    // 验证没有触发保存
    expect(mockSession.setMessageChainMap).not.toHaveBeenCalled()
  })

  it('应该使用严格前缀匹配，不误迁移包含 : 的 messageId', () => {
    // 准备混合数据：包含旧格式、新格式、以及包含 : 但不是旧格式的 messageId
    mockSession.messageChainMap = {
      'system:msg-123': 'chain-abc',         // 旧格式，应迁移
      'msg-with:colon': 'chain-def',         // 新格式但包含 :，不应迁移
      'random:prefix:msg': 'chain-ghi',      // 新格式但包含多个 :，不应迁移
      'user:msg-456': 'chain-jkl'            // 旧格式，应迁移
    }

    const composable = useConversationOptimization(
      services,
      conversationMessages,
      optimizationMode,
      selectedOptimizeModel,
      selectedTemplate,
      selectedIterateTemplate
    )

    composable.restoreFromSessionStore()

    // 验证旧格式被正确迁移
    expect(composable.messageChainMap.value.get('msg-123')).toBe('chain-abc')
    expect(composable.messageChainMap.value.get('msg-456')).toBe('chain-jkl')

    // 验证包含 : 的新格式 messageId 保持原样（不被误迁移）
    expect(composable.messageChainMap.value.get('msg-with:colon')).toBe('chain-def')
    expect(composable.messageChainMap.value.get('random:prefix:msg')).toBe('chain-ghi')

    // 验证旧格式 key 不存在
    expect(composable.messageChainMap.value.has('system:msg-123')).toBe(false)
    expect(composable.messageChainMap.value.has('user:msg-456')).toBe(false)

    // 验证迁移后保存
    expect(mockSession.setMessageChainMap).toHaveBeenCalledWith({
      'msg-123': 'chain-abc',
      'msg-with:colon': 'chain-def',
      'random:prefix:msg': 'chain-ghi',
      'msg-456': 'chain-jkl'
    })
  })

  it('应该支持所有已知的旧格式前缀 (system, user, basic, pro, image)', () => {
    // 准备所有旧格式前缀的数据
    mockSession.messageChainMap = {
      'system:msg-1': 'chain-1',
      'user:msg-2': 'chain-2',
      'basic:msg-3': 'chain-3',
      'pro:msg-4': 'chain-4',
      'image:msg-5': 'chain-5'
    }

    const composable = useConversationOptimization(
      services,
      conversationMessages,
      optimizationMode,
      selectedOptimizeModel,
      selectedTemplate,
      selectedIterateTemplate
    )

    composable.restoreFromSessionStore()

    // 验证所有前缀都被正确迁移
    expect(composable.messageChainMap.value.get('msg-1')).toBe('chain-1')
    expect(composable.messageChainMap.value.get('msg-2')).toBe('chain-2')
    expect(composable.messageChainMap.value.get('msg-3')).toBe('chain-3')
    expect(composable.messageChainMap.value.get('msg-4')).toBe('chain-4')
    expect(composable.messageChainMap.value.get('msg-5')).toBe('chain-5')

    // 验证迁移后保存
    expect(mockSession.setMessageChainMap).toHaveBeenCalled()
  })
})
