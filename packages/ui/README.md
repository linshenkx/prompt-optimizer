# @prompt-optimizer/ui

Prompt Optimizer的Vue 3用户界面组件库，基于Naive UI设计系统构建的现代化UI组件集合。

## 特性

✅ **Vue 3 + TypeScript** - 完整的类型安全支持  
✅ **Naive UI基础** - 基于成熟的设计系统  
✅ **主题系统** - 支持亮色/暗色主题无缝切换  
✅ **响应式设计** - 自动适配不同屏幕尺寸  
✅ **国际化支持** - 多语言界面支持  
✅ **模块化架构** - 可独立使用的组件  

## 安装

```bash
pnpm add @prompt-optimizer/ui @prompt-optimizer/core naive-ui
```

## 快速开始

### 基础设置

```typescript
import { createApp } from 'vue'
import { installI18n } from '@prompt-optimizer/ui'
import App from './App.vue'

const app = createApp(App)

// 安装国际化
installI18n(app)

app.mount('#app')
```

### 主题配置

```vue
<template>
  <NConfigProvider :theme="naiveTheme" :theme-overrides="themeOverrides">
    <NMessageProvider>
      <YourApp />
    </NMessageProvider>
  </NConfigProvider>
</template>

<script setup>
import { NConfigProvider, NMessageProvider } from 'naive-ui'
import { useNaiveTheme } from '@prompt-optimizer/ui'

const { naiveTheme, themeOverrides } = useNaiveTheme()
</script>
```

## 核心组件

### TestArea组件系统

现代化的AI提示词测试界面，支持系统/用户提示词模式和对比测试功能。

```vue
<template>
  <TestAreaPanel
    :optimization-mode="optimizationMode"
    :is-test-running="isTestRunning"
    :test-content="testContent"
    :is-compare-mode="isCompareMode"
    @update:test-content="testContent = $event"
    @compare-toggle="handleCompareToggle"
    @test="handleTest"
  >
    <template #model-select>
      <SelectWithConfig
        v-model="selectedModel"
        :options="modelOptions"
        :getPrimary="(o) => o.label"
        :getValue="(o) => o.value"
      />
    </template>
  </TestAreaPanel>
</template>
```

**包含组件：**
- `TestAreaPanel` - 主容器组件
- `TestInputSection` - 测试内容输入
- `TestControlBar` - 测试控制栏
- `TestResultSection` - 测试结果展示
- `ConversationSection` - 会话管理包装

### 模型管理

```vue
<template>
  <!-- 模型选择器 -->
  <SelectWithConfig
    v-model="selectedModel"
    :options="modelOptions"
    :getPrimary="(o) => o.label"
    :getValue="(o) => o.value"
  />
  
  <!-- 模型管理器 -->
  <ModelManagerUI @model-updated="handleModelUpdate" />
</template>
```

### 模板系统

```vue
<template>
  <!-- 模板选择器 -->
  <TemplateSelectUI v-model="selectedTemplate" />
  
  <!-- 模板管理器 -->
  <TemplateManagerUI @template-saved="handleTemplateSave" />
</template>
```

### 输入输出

```vue
<template>
  <!-- 输入面板 -->
  <InputPanelUI 
    v-model="inputContent"
    :placeholder="placeholder"
  />
  
  <!-- 输出显示 -->
  <OutputDisplay 
    :content="outputContent"
    :enable-fullscreen="true"
  />
  
  <!-- 全屏输出显示 -->
  <OutputDisplayFullscreen 
    v-model:visible="showFullscreen"
    :content="content"
  />
</template>
```

### 布局组件

```vue
<template>
  <!-- 主布局 -->
  <MainLayoutUI>
    <template #header>
      <YourHeader />
    </template>
    <template #sidebar>
      <YourSidebar />
    </template>
    <YourContent />
  </MainLayoutUI>
  
  <!-- 内容卡片 -->
  <ContentCardUI :title="cardTitle">
    <YourContent />
  </ContentCardUI>
</template>
```

### 数据管理

```vue
<template>
  <!-- 数据管理器 -->
  <DataManagerUI 
    @data-imported="handleImport"
    @data-exported="handleExport"
  />
  
  <!-- 变量管理 -->
  <VariableManager 
    v-model="variables"
    @variable-updated="handleVariableUpdate"
  />
</template>
```

## Composables

### 主题管理

```typescript
import { useNaiveTheme } from '@prompt-optimizer/ui'

const {
  naiveTheme,       // Naive UI主题对象
  themeOverrides,   // 主题覆盖配置
  currentTheme,     // 当前主题ID
  switchTheme,      // 切换主题
  initTheme         // 初始化主题
} = useNaiveTheme()
```

### 响应式布局

```typescript
import { useResponsiveTestLayout } from '@prompt-optimizer/ui'

const {
  isMobile,           // 是否为移动端
  isTablet,           // 是否为平板
  currentBreakpoint,  // 当前断点
  inputMode,          // 推荐的输入模式
  controlBarLayout,   // 推荐的控制栏布局
  buttonSize,         // 推荐的按钮尺寸
  responsiveHeights   // 响应式高度配置
} = useResponsiveTestLayout()
```

### 测试模式配置

```typescript
import { useTestModeConfig } from '@prompt-optimizer/ui'

const {
  showTestInput,          // 是否显示测试输入
  requiresTestContent,    // 是否需要测试内容
  canStartTest,           // 是否可以开始测试
  enableCompareMode,      // 是否启用对比模式
  getDynamicButtonText,   // 获取动态按钮文本
  validateTestSetup       // 验证测试配置
} = useTestModeConfig(optimizationMode)
```

## 组件导出

### UI组件

```typescript
// 核心组件
export { default as ToastUI } from './components/Toast.vue'
export { default as ModalUI } from './components/Modal.vue'
export { default as PanelUI } from './components/Panel.vue'

// 布局组件
export { default as MainLayoutUI } from './components/MainLayout.vue'
export { default as ContentCardUI } from './components/ContentCard.vue'

// TestArea组件系统
export { default as TestAreaPanel } from './components/TestAreaPanel.vue'
export { default as TestInputSection } from './components/TestInputSection.vue'
export { default as TestControlBar } from './components/TestControlBar.vue'
export { default as TestResultSection } from './components/TestResultSection.vue'
export { default as ConversationSection } from './components/ConversationSection.vue'

// 输入输出组件
export { default as InputPanelUI } from './components/InputPanel.vue'
export { default as OutputDisplay } from './components/OutputDisplay.vue'
export { default as OutputDisplayFullscreen } from './components/OutputDisplayFullscreen.vue'
export { default as OutputDisplayCore } from './components/OutputDisplayCore.vue'

// 管理组件
export { default as ModelManagerUI } from './components/ModelManager.vue'
export { default as TemplateManagerUI } from './components/TemplateManager.vue'
export { default as TemplateSelectUI } from './components/TemplateSelect.vue'
export { default as DataManagerUI } from './components/DataManager.vue'
export { default as VariableManager } from './components/VariableManager.vue'
export { default as FunctionModelManagerUI } from './components/FunctionModelManager.vue'

// 功能组件
export { default as ActionButtonUI } from './components/ActionButton.vue'
export { default as ThemeToggleUI } from './components/ThemeToggleUI.vue'
export { default as LanguageSwitchDropdown } from './components/LanguageSwitchDropdown.vue'
export { default as OptimizationModeSelectorUI } from './components/OptimizationModeSelector.vue'
export { default as TextDiffUI } from './components/TextDiff.vue'
export { default as MarkdownRenderer } from './components/MarkdownRenderer.vue'

// 高级组件
export { default as AdvancedTestPanel } from './components/AdvancedTestPanel.vue'
export { default as ConversationManager } from './components/ConversationManager.vue'
export { default as VariableEditor } from './components/VariableEditor.vue'
export { default as HistoryDrawerUI } from './components/HistoryDrawer.vue'
```

### Composables

```typescript
// 导出所有composables
export * from './composables'

// 主要composables
export { useNaiveTheme } from './composables/useNaiveTheme'
export { useResponsiveTestLayout } from './composables/useResponsiveTestLayout'
export { useTestModeConfig } from './composables/useTestModeConfig'
```

### 主题系统

```typescript
// 主题配置
export { 
  currentNaiveTheme as naiveTheme,
  currentThemeOverrides as themeOverrides, 
  currentThemeId, 
  currentThemeConfig,
  naiveThemeConfigs,
  switchTheme,
  initializeNaiveTheme
} from './config/naive-theme'
```

### 国际化

```typescript
// I18n系统
export { 
  installI18n, 
  installI18nOnly, 
  initializeI18nWithStorage, 
  setI18nServices, 
  i18n 
} from './plugins/i18n'
```

## 类型系统

### 核心类型

```typescript
import type { 
  OptimizationMode,
  ConversationMessage,
  Template,
  IModelManager,
  ITemplateManager,
  ILLMService,
  IPromptService
} from '@prompt-optimizer/core'

// TestArea组件类型
export interface TestAreaConfig {
  optimizationMode: OptimizationMode
  inputMode: 'default' | 'compact'
  controlBarLayout: 'default' | 'compact'
  buttonSize: 'small' | 'medium' | 'large'
}

export interface TestControlLayout {
  showCompareToggle: boolean
  primaryActionText: string
  buttonSize: string
}
```

## 样式规范

UI组件遵循严格的设计规范：

- **无硬编码像素值** - 使用Naive UI的size系统
- **无Tailwind CSS类** - 纯Naive UI组件实现
- **统一间距系统** - 基于16px基准的间距规范
- **响应式设计** - 支持xs/sm/md/lg/xl/xxl断点
- **主题兼容性** - 完全兼容亮色/暗色主题

详见：[测试区域组件样式规范](../docs/components/test-area-style-guide.md)

## 开发

### 本地开发

```bash
# 安装依赖
pnpm install

# 开发模式
pnpm dev

# 构建UI包
pnpm -F @prompt-optimizer/ui build

# 运行测试
pnpm -F @prompt-optimizer/ui test

# 类型检查
pnpm -F @prompt-optimizer/ui exec tsc --noEmit
```

### 测试

```bash
# 运行所有测试
pnpm -F @prompt-optimizer/ui test

# 运行特定组件测试
pnpm -F @prompt-optimizer/ui test -- TestAreaPanel

# 运行集成测试
pnpm -F @prompt-optimizer/ui test -- test-area-integration

# 运行端到端测试  
pnpm -F @prompt-optimizer/ui test -- test-area-e2e
```

### 组件开发指南

1. **使用Naive UI组件** - 基于NButton、NInput、NFlex等
2. **遵循TypeScript规范** - 完整的类型定义
3. **支持主题切换** - 使用主题变量而非硬编码颜色
4. **响应式设计** - 适配不同屏幕尺寸
5. **国际化支持** - 所有文本使用i18n
6. **单元测试** - 为每个组件编写测试用例

## 依赖

### 核心依赖

- **Vue 3.x** - 渐进式JavaScript框架
- **Naive UI 2.x** - Vue 3设计系统组件库
- **@prompt-optimizer/core** - 核心业务逻辑
- **Vue I18n** - Vue国际化插件

### 开发依赖

- **TypeScript 5.x** - 类型系统
- **Vitest** - 单元测试框架
- **@vue/test-utils** - Vue组件测试工具
- **Vite** - 现代化构建工具

## 兼容性

- **Vue**: 3.0+
- **Node.js**: 18.0+
- **浏览器**: Chrome 88+, Firefox 85+, Safari 14+
- **Naive UI**: 2.34+

## 许可证

GNU Affero General Public License v3.0 (AGPL-3.0-only)

## 文档

- [完整组件文档](../docs/components/test-area.md)
- [样式规范指南](../docs/components/test-area-style-guide.md)
- [开发者指南](../docs/developer/technical-development-guide.md)

---

**最后更新：** 2025-01-20  
**版本：** 1.4.4
