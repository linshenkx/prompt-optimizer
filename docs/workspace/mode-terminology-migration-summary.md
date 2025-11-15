# 模式术语统一迁移总结

## 📋 迁移概述

本次迁移旨在统一项目中的模式术语，将过时的 `optimizationMode`、`contextMode`、`selectedOptimizationMode` 等表达对齐到最新的 `functionMode` 和 `subMode` 设计。

## 🎯 统一设计架构

### 核心概念
- **functionMode**: 一级功能模式 (`basic` | `pro` | `image`)
- **subMode**: 二级子模式，根据 functionMode 而定
  - 基础模式子模式 (`system` | `user`)
  - 上下文模式子模式 (`system` | `user`)
  - 图像模式子模式 (`text2image` | `image2image`)

### 统一管理函数
所有模式状态应使用 `packages/ui/src/composables/mode/` 下的函数：

```typescript
// 功能模式管理
useFunctionMode(services) // { functionMode, setFunctionMode, ... }

// 子模式管理（独立持久化）
useBasicSubMode(services)  // 基础模式子模式
useProSubMode(services)    // 上下文模式子模式
useImageSubMode(services)  // 图像模式子模式

// 只读访问（无需 services）
useCurrentMode()           // { functionMode, proSubMode, isBasicMode, ... }
```

## ✅ 已完成的迁移

### 1. Composables 参数统一
- **usePromptOptimizer**: `selectedOptimizationMode` → `optimizationMode`
- **usePromptTester**: `selectedOptimizationMode` → `optimizationMode`
- **useContextManagement**: 添加 @deprecated 标记

### 2. 内部变量名统一
- `usePromptTester.ts` 中所有 `selectedOptimizationMode.value` → `optimizationMode.value`

### 3. 文档和注释更新
- 为迁移的参数添加 @deprecated 标记
- 更新 JSDoc 注释，说明统一使用 subMode 概念
- 在 App.vue 中添加兼容性注释

## 🔍 仍需迁移的区域

### 高优先级
1. **App.vue 中的 selectedOptimizationMode**
   ```typescript
   // 当前：仍使用独立的 selectedOptimizationMode ref
   const selectedOptimizationMode = ref<OptimizationMode>("system");

   // 建议：改为根据 functionMode 动态获取对应的 subMode
   const currentSubMode = computed(() => {
     if (functionMode.value === 'basic') return basicSubMode.value;
     if (functionMode.value === 'pro') return proSubMode.value;
     return 'system'; // 默认值
   });
   ```

2. **模板中的变量名**
   - 搜索所有 Vue 模板中的 `selectedOptimizationMode`
   - 替换为对应的 `basicSubMode`/`proSubMode`

### 中优先级
3. **类型定义中的过时术语**
   - 检查 `packages/ui/src/types/components.ts`
   - 检查 `packages/core/src/types/` 相关文件

4. **测试文件中的术语**
   - 更新测试用例中的变量名和断言

### 低优先级
5. **国际化文件**
   - 检查 `packages/ui/src/i18n/locales/` 中的键名
   - 确保文档和帮助文本使用统一术语

## 🚀 迁移建议

### 阶段 1: 核心逻辑迁移
1. 在 App.vue 中移除独立的 `selectedOptimizationMode`
2. 使用 `basicSubMode`/`proSubMode` 作为唯一切换源
3. 更新所有事件处理器

### 阶段 2: UI 组件迁移
1. 更新所有接收 `selectedOptimizationMode` 的组件
2. 改为接收对应的 subMode 或使用 `useCurrentMode()`
3. 验证所有功能正常工作

### 阶段 3: 清理和优化
1. 移除所有 @deprecated 标记的代码
2. 更新文档和示例
3. 添加 ESLint 规则防止回退

## 📝 迁移检查清单

- [x] 更新 usePromptOptimizer 参数
- [x] 更新 usePromptTester 参数
- [x] 更新 useContextManagement 接口
- [x] 统一内部变量名
- [x] 添加 @deprecated 标记
- [ ] 重构 App.vue 中的模式管理
- [ ] 更新所有 Vue 模板绑定
- [ ] 更新类型定义
- [ ] 更新测试文件
- [ ] 验证功能完整性
- [ ] 更新文档

## 🎯 预期收益

1. **术语统一**: 消除混淆，提高代码可读性
2. **架构清晰**: 明确的层级关系（functionMode → subMode）
3. **状态隔离**: 不同功能模式的子模式���立持久化
4. **开发体验**: 统一的 API 和清晰的使用模式

## 🔗 相关文档

- [功能模式设计文档](../archives/126-submode-persistence/README.md)
- [模式管理 API](../../../packages/ui/src/composables/mode/index.ts)
- [迁移最佳实践](../migration/)

---

**文档版本**: v1.0
**创建时间**: 2025-10-31
**维护者**: Claude & 用户
