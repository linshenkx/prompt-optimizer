import { ref, computed, onMounted, onUnmounted, readonly } from 'vue'

import type {
  TestAreaConfig,
  TestControlLayout,
  TestResultConfig,
  ComponentSize,
  ButtonSize
} from '../../components/types/test-area'

// 屏幕断点定义
const BREAKPOINTS = {
  xs: 0,
  sm: 576,
  md: 768,
  lg: 992,
  xl: 1200,
  xxl: 1600
} as const

type ScreenSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl'

export interface ResponsiveTestLayoutOptions {
  // 初始配置
  initialConfig?: Partial<TestAreaConfig>
  
  // 自定义断点
  customBreakpoints?: Partial<typeof BREAKPOINTS>
  
  // 是否启用自动监听
  enableAutoResize?: boolean
}

export function useResponsiveTestLayout(options: ResponsiveTestLayoutOptions = {}) {
  const {
    initialConfig,
    customBreakpoints,
    enableAutoResize = true
  } = options

  // 响应式状态
  const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1200)
  const windowHeight = ref(typeof window !== 'undefined' ? window.innerHeight : 800)

  // 合并断点配置
  const breakpoints = { ...BREAKPOINTS, ...customBreakpoints }

  // 计算当前屏幕尺寸
  const currentScreenSize = computed<ScreenSize>(() => {
    const width = windowWidth.value
    if (width >= breakpoints.xxl) return 'xxl'
    if (width >= breakpoints.xl) return 'xl'
    if (width >= breakpoints.lg) return 'lg'
    if (width >= breakpoints.md) return 'md'
    if (width >= breakpoints.sm) return 'sm'
    return 'xs'
  })

  // 屏幕尺寸检测
  const isXS = computed(() => currentScreenSize.value === 'xs')
  const isSM = computed(() => currentScreenSize.value === 'sm')
  const isMD = computed(() => currentScreenSize.value === 'md')
  const isLG = computed(() => currentScreenSize.value === 'lg')
  const isXL = computed(() => currentScreenSize.value === 'xl')
  const isXXL = computed(() => currentScreenSize.value === 'xxl')

  // 屏幕类型检测
  const isMobile = computed(() => windowWidth.value < breakpoints.md)
  const isTablet = computed(() => windowWidth.value >= breakpoints.md && windowWidth.value < breakpoints.lg)
  const isDesktop = computed(() => windowWidth.value >= breakpoints.lg)
  const isLargeScreen = computed(() => windowWidth.value >= breakpoints.xl)

  // 智能组件尺寸计算
  const smartComponentSize = computed<ComponentSize>(() => {
    if (isMobile.value) return 'small'
    if (isTablet.value) return 'medium'
    return 'large'
  })

  const smartButtonSize = computed<ButtonSize>(() => {
    if (isMobile.value) return 'small'
    if (isTablet.value) return 'medium'
    return 'medium' // 桌面端保持中等尺寸，避免过大
  })

  // 响应式布局模式
  const recommendedInputMode = computed<'compact' | 'normal'>(() => {
    return isMobile.value ? 'compact' : 'normal'
  })

  const recommendedControlBarLayout = computed<'default' | 'compact' | 'minimal'>(() => {
    if (isMobile.value) return 'minimal'
    if (isTablet.value) return 'compact'
    return 'default'
  })

  // NGrid 响应式配置
  const gridResponsiveConfig = computed(() => {
    return {
      modelSelectSpan: {
        xs: 24,
        sm: 12,
        md: 8,
        lg: 8,
        xl: 6,
        xxl: 6
      },
      controlButtonsSpan: {
        xs: 24,
        sm: 12,
        md: 16,
        lg: 16,
        xl: 18,
        xxl: 18
      }
    }
  })

  // 高度配置计算
  const responsiveHeights = computed(() => {
    const baseHeight = windowHeight.value
    
    return {
      testInputMin: isMobile.value ? 2 : 3,
      testInputMax: isMobile.value ? 4 : 8,
      conversationMax: isMobile.value ? '200px' : isTablet.value ? '250px' : '300px',
      resultAreaMax: Math.max(200, baseHeight * 0.6) + 'px'
    }
  })

  // 生成完整的测试区域配置
  const testAreaConfig = computed<TestAreaConfig>(() => {
    return {
      layout: {
        inputMode: recommendedInputMode.value,
        controlBarLayout: recommendedControlBarLayout.value,
        buttonSize: smartButtonSize.value,
        enableFullscreen: !isMobile.value // 移动端不建议全屏编辑
      },
      features: {
        compareMode: !isMobile.value, // 移动端不建议对比模式
        conversationManager: true,
        advancedMode: isDesktop.value // 仅桌面端启用高级模式
      },
      heights: {
        testInputMin: responsiveHeights.value.testInputMin,
        testInputMax: responsiveHeights.value.testInputMax,
        conversationMax: responsiveHeights.value.conversationMax
      },
      responsive: {
        modelSelectSpan: gridResponsiveConfig.value.modelSelectSpan,
        controlButtonsSpan: gridResponsiveConfig.value.controlButtonsSpan
      },
      ...initialConfig
    }
  })

  // 控制布局配置
  const controlLayoutConfig = computed<TestControlLayout>(() => {
    return {
      modelSelect: {
        span: gridResponsiveConfig.value.modelSelectSpan[currentScreenSize.value],
        responsive: gridResponsiveConfig.value.modelSelectSpan
      },
      controls: {
        span: gridResponsiveConfig.value.controlButtonsSpan[currentScreenSize.value],
        responsive: gridResponsiveConfig.value.controlButtonsSpan,
        justification: isMobile.value ? 'center' : 'end'
      },
      buttons: {
        size: smartButtonSize.value,
        spacing: isMobile.value ? 8 : 12,
        primary: {
          type: 'primary',
          ghost: false
        },
        secondary: {
          type: 'default',
          ghost: !isMobile.value
        }
      }
    }
  })

  // 结果显示配置
  const resultConfig = computed<TestResultConfig>(() => {
    return {
      compareMode: {
        enabled: !isMobile.value,
        layout: isMobile.value || isTablet.value ? 'vertical' : 'horizontal',
        showOriginal: !isMobile.value
      },
      singleMode: {
        title: '测试结果',
        showToolbar: isDesktop.value
      },
      display: {
        cardSize: smartComponentSize.value,
        gap: isMobile.value ? 8 : 12,
        enableDiff: isDesktop.value,
        enableFullscreen: isDesktop.value
      }
    }
  })

  // 窗口尺寸变化监听
  const handleResize = () => {
    windowWidth.value = window.innerWidth
    windowHeight.value = window.innerHeight
  }

  // 防抖处理
  let resizeTimer: ReturnType<typeof setTimeout> | null = null
  const debouncedHandleResize = () => {
    if (resizeTimer) clearTimeout(resizeTimer)
    resizeTimer = setTimeout(handleResize, 150)
  }

  // 生命周期管理
  onMounted(() => {
    if (typeof window !== 'undefined' && enableAutoResize) {
      handleResize() // 初始化
      window.addEventListener('resize', debouncedHandleResize)
    }
  })

  onUnmounted(() => {
    if (typeof window !== 'undefined' && enableAutoResize) {
      window.removeEventListener('resize', debouncedHandleResize)
    }
    if (resizeTimer) {
      clearTimeout(resizeTimer)
      resizeTimer = null
    }
  })

  // 手动触发重新计算
  const recalculate = () => {
    handleResize()
  }

  // 获取特定断点的配置
  const getConfigForBreakpoint = (): TestAreaConfig => {
    // 简化实现：直接返回当前配置的副本
    return { ...testAreaConfig.value }
  }

  return {
    // 响应式状态
    windowWidth: readonly(windowWidth),
    windowHeight: readonly(windowHeight),
    currentScreenSize: readonly(currentScreenSize),
    
    // 屏幕尺寸检测
    isXS: readonly(isXS),
    isSM: readonly(isSM),
    isMD: readonly(isMD),
    isLG: readonly(isLG),
    isXL: readonly(isXL),
    isXXL: readonly(isXXL),
    
    // 屏幕类型检测
    isMobile: readonly(isMobile),
    isTablet: readonly(isTablet),
    isDesktop: readonly(isDesktop),
    isLargeScreen: readonly(isLargeScreen),
    
    // 智能配置
    smartComponentSize: readonly(smartComponentSize),
    smartButtonSize: readonly(smartButtonSize),
    recommendedInputMode: readonly(recommendedInputMode),
    recommendedControlBarLayout: readonly(recommendedControlBarLayout),
    
    // 响应式配置
    gridResponsiveConfig: readonly(gridResponsiveConfig),
    responsiveHeights: readonly(responsiveHeights),
    
    // 完整配置
    testAreaConfig: readonly(testAreaConfig),
    controlLayoutConfig: readonly(controlLayoutConfig),
    resultConfig: readonly(resultConfig),
    
    // 工具方法
    recalculate,
    getConfigForBreakpoint,
    
    // 常量
    breakpoints: readonly(breakpoints)
  }
}
