import { computed, readonly, type Ref, type ComputedRef } from 'vue'

import type { OptimizationMode } from '@prompt-optimizer/core'

export interface TestModeConfigOptions {
  // 是否启用高级模式功能
  enableAdvancedFeatures?: boolean
  
  // 自定义模式配置
  customModeConfig?: Partial<TestModeConfigMap>
  
  // 默认配置覆盖
  defaultOverrides?: {
    showTestInput?: boolean
    enableCompareMode?: boolean
    enableConversationManager?: boolean
  }
}

export interface TestModeConfig {
  // 显示控制
  showTestInput: boolean
  showConversationManager: boolean
  
  // 功能开关
  enableCompareMode: boolean
  enableFullscreen: boolean
  
  // UI配置
  inputMode: 'compact' | 'normal'
  controlBarLayout: 'default' | 'compact' | 'minimal'
  
  // 文本配置
  inputLabel: string
  inputPlaceholder: string
  inputHelpText: string
  primaryButtonText: string
  
  // 验证配置
  requiresTestContent: boolean
  canStartTest: (testContent: string, hasPrompt: boolean) => boolean
}

interface TestModeConfigMap {
  system: TestModeConfig
  user: TestModeConfig
}

type OptimizationModeSource = Ref<OptimizationMode> | ComputedRef<OptimizationMode>

export function useTestModeConfig(
  optimizationMode: OptimizationModeSource, 
  options: TestModeConfigOptions = {}
) {
  const {
    enableAdvancedFeatures = true,
    customModeConfig,
    defaultOverrides
  } = options

  // 默认模式配置
  const defaultModeConfigs: TestModeConfigMap = {
    system: {
      // 显示控制
      showTestInput: true, // 系统提示词模式需要测试输入
      showConversationManager: enableAdvancedFeatures,
      
      // 功能开关
      enableCompareMode: true,
      enableFullscreen: true,
      
      // UI配置
      inputMode: 'normal',
      controlBarLayout: 'default',
      
      // 文本配置
      inputLabel: 'test.content',
      inputPlaceholder: 'test.placeholder', 
      inputHelpText: 'test.simpleMode.help',
      primaryButtonText: 'test.startTest',
      
      // 验证配置
      requiresTestContent: true,
      canStartTest: (testContent: string, hasPrompt: boolean) => {
        return hasPrompt && testContent.trim() !== ''
      }
    },
    
    user: {
      // 显示控制
      showTestInput: false, // 用户提示词模式不需要额外测试输入
      showConversationManager: enableAdvancedFeatures,
      
      // 功能开关
      enableCompareMode: true,
      enableFullscreen: true,
      
      // UI配置
      inputMode: 'normal',
      controlBarLayout: 'default',
      
      // 文本配置
      inputLabel: 'test.userPromptTest',
      inputPlaceholder: '',
      inputHelpText: '',
      primaryButtonText: 'test.startTest',
      
      // 验证配置
      requiresTestContent: false,
      canStartTest: (testContent: string, hasPrompt: boolean) => {
        return hasPrompt // 只需要有提示词即可
      }
    }
  }

  // 合并自定义配置
  const modeConfigs = computed(() => {
    const merged = { ...defaultModeConfigs }
    
    if (customModeConfig) {
      Object.keys(customModeConfig).forEach(mode => {
        const modeKey = mode as keyof TestModeConfigMap
        if (merged[modeKey]) {
          merged[modeKey] = { ...merged[modeKey], ...customModeConfig[modeKey] }
        }
      })
    }
    
    // 应用默认覆盖
    if (defaultOverrides) {
      Object.keys(merged).forEach(mode => {
        const modeKey = mode as keyof TestModeConfigMap
        merged[modeKey] = { ...merged[modeKey], ...defaultOverrides }
      })
    }
    
    return merged
  })

  // 当前模式配置
  const currentModeConfig = computed<TestModeConfig>(() => {
    return modeConfigs.value[optimizationMode.value] || modeConfigs.value.system
  })

  // 关键计算属性：解决接口冗余问题
  const showTestInput = computed(() => currentModeConfig.value.showTestInput)
  
  const showConversationManager = computed(() => currentModeConfig.value.showConversationManager)
  
  const enableCompareMode = computed(() => currentModeConfig.value.enableCompareMode)
  
  const enableFullscreen = computed(() => currentModeConfig.value.enableFullscreen)

  // UI 配置
  const inputMode = computed(() => currentModeConfig.value.inputMode)
  
  const controlBarLayout = computed(() => currentModeConfig.value.controlBarLayout)

  // 文本配置
  const inputLabel = computed(() => currentModeConfig.value.inputLabel)
  
  const inputPlaceholder = computed(() => currentModeConfig.value.inputPlaceholder)
  
  const inputHelpText = computed(() => currentModeConfig.value.inputHelpText)
  
  const primaryButtonText = computed(() => currentModeConfig.value.primaryButtonText)

  // 验证相关
  const requiresTestContent = computed(() => currentModeConfig.value.requiresTestContent)

  // 测试启动验证
  const canStartTest = computed(() => {
    return (testContent: string, hasPrompt: boolean) => {
      return currentModeConfig.value.canStartTest(testContent, hasPrompt)
    }
  })

  // 模式特定的帮助信息
  const getModeHelpInfo = computed(() => {
    switch (optimizationMode.value) {
      case 'system':
        return {
          title: '系统提示词测试模式',
          description: '在此模式下，原始/优化提示词作为系统消息，您需要提供用户问题进行测试。',
          requirements: ['需要提供测试内容作为用户问题', '支持对比测试原始和优化版本'],
          features: ['智能输入框', '对比模式', '全屏编辑', '高级对话管理']
        }
      case 'user':
        return {
          title: '用户提示词测试模式', 
          description: '在此模式下，原始/优化提示词直接作为用户消息进行测试。',
          requirements: ['无需额外测试内容', '直接测试提示词效果'],
          features: ['简化界面', '对比模式', '全屏编辑', '高级对话管理']
        }
      default:
        return {
          title: '未知模式',
          description: '当前模式配置不正确',
          requirements: [],
          features: []
        }
    }
  })

  // 动态按钮文本
  const getDynamicButtonText = (isCompareMode: boolean, isLoading: boolean) => {
    if (isLoading) return 'test.testing'
    
    const baseText = primaryButtonText.value
    if (isCompareMode && enableCompareMode.value) {
      return 'test.startCompare'
    }
    return baseText
  }

  // 验证辅助函数
  const validateTestSetup = (testContent: string, hasPrompt: boolean) => {
    const errors: string[] = []
    
    if (!hasPrompt) {
      errors.push('需要提供提示词')
    }
    
    if (requiresTestContent.value && !testContent.trim()) {
      errors.push('需要提供测试内容')
    }
    
    return {
      isValid: errors.length === 0,
      errors
    }
  }

  // 获取特定模式的配置
  const getModeConfig = (mode: OptimizationMode): TestModeConfig => {
    return modeConfigs.value[mode] || modeConfigs.value.system
  }

  // 检查模式切换的兼容性
  const checkModeCompatibility = (fromMode: OptimizationMode, toMode: OptimizationMode) => {
    const fromConfig = getModeConfig(fromMode)
    const toConfig = getModeConfig(toMode)
    
    return {
      requiresTestContentChange: fromConfig.requiresTestContent !== toConfig.requiresTestContent,
      requiresUIReset: fromConfig.showTestInput !== toConfig.showTestInput,
      compatibilityWarnings: [] as string[]
    }
  }

  return {
    // 核心配置
    currentModeConfig: readonly(currentModeConfig),
    modeConfigs: readonly(modeConfigs),
    
    // 关键计算属性
    showTestInput: readonly(showTestInput),
    showConversationManager: readonly(showConversationManager),
    enableCompareMode: readonly(enableCompareMode),
    enableFullscreen: readonly(enableFullscreen),
    
    // UI 配置
    inputMode: readonly(inputMode),
    controlBarLayout: readonly(controlBarLayout),
    
    // 文本配置
    inputLabel: readonly(inputLabel),
    inputPlaceholder: readonly(inputPlaceholder), 
    inputHelpText: readonly(inputHelpText),
    primaryButtonText: readonly(primaryButtonText),
    
    // 验证配置
    requiresTestContent: readonly(requiresTestContent),
    canStartTest: readonly(canStartTest),
    
    // 帮助信息
    getModeHelpInfo: readonly(getModeHelpInfo),
    
    // 工具函数
    getDynamicButtonText,
    validateTestSetup,
    getModeConfig,
    checkModeCompatibility
  }
}
