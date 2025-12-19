# 模式术语统一迁移总结

## 📋 迁移概述

本次迁移旨在统一项目中的模式术语，将过时或语义不清的 `optimizationMode`、`contextMode`、`selectedOptimizationMode` 等表达，逐步对齐到 `functionMode`（一级功能模式）与 `subMode`（二级子模式）的设计，并确保各模式的子模式状态独立持久化。

说明：该文档保留在 `docs/workspace/` 作为“模式术语与迁移现状”的单点入口；其中的“待办/清理项”只保留仍然有效的内容，避免对过往实现阶段产生误导。

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

## ✅ 当前实现现状（已落地）

### 1) 主装配位置从 Web/Extension App.vue 收敛到 UI 主组件

- `packages/web/src/App.vue`、`packages/extension/src/App.vue` 目前仅作为壳组件渲染 UI 主应用。
- 真实的模式状态管理与装配已收敛到：
  - `packages/ui/src/components/app-layout/PromptOptimizerApp.vue`

### 2) 子模式持久化已实现，且 `selectedOptimizationMode` 已改为 computed（非独立状态源）

- `PromptOptimizerApp.vue` 使用 `useFunctionMode` + `useBasicSubMode/useProSubMode/useImageSubMode` 管理状态，并做独立持久化。
- `selectedOptimizationMode` 不再是独立 `ref`，而是从 subMode 推导的 `computed`（兼容旧接口/props 形态）。

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
- 在 `PromptOptimizerApp.vue` 中保留必要的兼容性注释（以反映真实装配位置）

## 🔍 仍需迁移的区域

### 高优先级（清理与一致性）
1. **逐步移除命名上的“误导”**
   - `selectedOptimizationMode` 虽已是 computed，但命名仍容易让人误以为它是“用户选择的优化模式状态源”。
   - 建议方向：
     - 对外仍可维持 `optimizationMode` props（避免大范围破坏性改动）
     - 内部逐步改为更准确的命名（例如 `currentOptimizationMode` / `derivedOptimizationMode`），并集中在 UI 层统一出口

2. **组件/模板中的旧名收敛**
   - 将零散的 `optimizationMode/contextMode/selectedOptimizationMode` 相关命名逐步统一为“functionMode/subMode 派生值”的表达（不强求一次性替换，但要避免继续引入新旧混用）

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

### 重点方向：以“不破坏行为”为前提做术语清理
1. 将“状态源”限定为 `functionMode + 各自 subMode`（已完成）
2. 将“对外接口/props”保持可用，同时逐步减少旧命名在内部传播（进行中）
3. 等调用方与文档一致后，再移除 `@deprecated` 标记（后续清理）

## 📝 迁移检查清单

- [x] 更新 usePromptOptimizer 参数
- [x] 更新 usePromptTester 参数
- [x] 更新 useContextManagement 接口
- [x] 统一内部变量名
- [x] 添加 @deprecated 标记
- [x] 模式管理收敛到 PromptOptimizerApp（由 subMode 推导 optimizationMode）
- [ ] 更新所有 Vue 模板/props 命名（逐步收敛，避免引入新旧混用）
- [ ] 更新类型定义
- [ ] 更新测试文件
- [ ] 验证功能完整性
- [ ] 更新文档

## 🎯 预期收益

1. **术语统一**: 消除混淆，提高代码可读性
2. **架构清晰**: 明确的层级关系（functionMode → subMode）
3. **状态隔离**: 不同功能模式的子模式独立持久化
4. **开发体验**: 统一的 API 和清晰的使用模式

## 🔗 相关文档

- [功能模式设计文档](../archives/126-submode-persistence/README.md)
- [模式管理 API](../../../packages/ui/src/composables/mode/index.ts)
- [上下文 UI 改造与变量系统重构（归档）](../archives/128-context-ui-and-variable-system-refactor/README.md)

---

**文档版本**: v1.0
**创建时间**: 2025-10-31
**最近更新**: 2025-12-19
**维护者**: 用户
