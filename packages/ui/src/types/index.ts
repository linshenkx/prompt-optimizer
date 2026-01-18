/**
 * 统一类型导出
 */

// 现有类型
export * from './variable'
export * from './services'

// 新增的标准化prompt类型
export * from './standard-prompt'
export * from './data-converter'

// 高级模块组件类型
export * from './components'

// 选择器选项类型
export * from './select-options'

// 测试区域组件类型
export type {
  ComponentSize,
  LayoutMode,
  ButtonSize,
  TestInputSectionProps,
  TestInputSectionEmits,
  TestControlBarProps,
  TestControlBarEmits,
  TestAreaConfig,
  TestControlLayout,
  TestResultConfig,
  TestAreaPanelInstance,
  TestAreaSlots,
  TestAreaEventCallbacks,
  CreateTestAreaConfig,
  TestAreaPresets
} from '../components/types/test-area'

// 明确区分不同模块的同名类型
export type {
  TestAreaPanelProps as TestAreaPanelLegacyProps,
  TestResultSectionProps as TestResultSectionLegacyProps
} from '../components/types/test-area'