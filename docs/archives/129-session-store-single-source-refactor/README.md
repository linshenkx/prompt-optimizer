# 129-session-store-single-source-refactor - Session Store 单一真源架构重构

## 概述
完成 Session Store 架构重构，实现单一真源（Single Source of Truth）原则，解决跨模式状态污染问题，新增图像存储服务，优化代码分割。

## 状态
✅ 已完成（迁移指南部分为长期规划）

## 关键成果

### 核心架构改进
- ✅ 新增 ImageStorageService（独立 IndexedDB，支持 LRU 缓存）
- ✅ 优化 Session Store 持久化防护，防止数据覆盖
- ✅ 串行化恢复和保存流程，避免内存峰值
- ✅ 拆分单体组件为细粒度工作区

### 代码优化
- ✅ 移除不必要的图像迁移逻辑
- ✅ 清理废弃存储键，添加向后兼容注释
- ✅ 移除 Basic 组件的静态导出，优化代码分割
- ✅ 主 bundle 减少约 57KB，改善首屏加载

### 组件重构
- ✅ 删除 BasicModeWorkspace 单体组件（635 行）
- ✅ 新增 BasicSystemWorkspace（680 行）
- ✅ 新增 BasicUserWorkspace（685 行）
- ✅ 删除 ImageWorkspace 单体组件（1606 行）
- ✅ 新增 ImageText2ImageWorkspace（2205 行）
- ✅ 新增 ImageImage2ImageWorkspace（2205 行）

## 文档清单

- [x] **bug-fix-testresults-display.md** - P0 Bug修复记录
  - 问题：Basic 模式测试结果不显示
  - 根因：ComputedRef 访问遗漏 `.value`
  - 解决：优化响应式数据流

- [x] **architecture-comparison.md** - 三种模式架构对比分析
  - Basic 模式：Store → Logic → Component
  - Context 模式：Tester composable → Component
  - Image 模式：Store 直连 → Component
  - 统一目标：Store + Operations

- [x] **test-plan.md** - Session 持久化测试计划
  - 基础持久化测试
  - 模式隔离测试
  - 迁移逻辑测试
  - 跨浏览器测试

## 后续规划

Logic → Operations 迁移指南已移回 `docs/workspace/architecture-migration-guide.md`，包含：
- Phase 1: 基础设施准备
- Phase 2: Basic 模式迁移
- Phase 3: Context 模式迁移
- Phase 4: Image 模式对齐
- Phase 5: 清理和优化

## 技术亮点

### ImageStorageService 设计
- **表分离**：metadata 和 data 分表，避免查询时加载大量 base64
- **数据库迁移**：提供完整的 v1 → v2 升级路径，分批处理避免内存尖峰
- **配额管理**：LRU 策略 + 自动清理 + 可配置阈值
- **事务保证**：使用 Dexie 事务确保数据一致性

### Session Store 防御性增强
- **未恢复前禁止保存**：避免覆盖持久化数据
- **串行化处理**：恢复和保存都采用串行化，避免并发导致内存峰值
- **并发锁保护**：使用全局锁防止保存操作冲突

### 代码分割优化
- **移除静态导出**：Basic 组件改为 router 动态导入
- **成功分割**：生成独立 chunk（23KB × 2）
- **性能提升**：主 bundle 减少 57KB，首屏加载更快

## 相关 Commits

- `5ea1004` - fix(ui): 修复跨模式状态污染问题，实现单一真源架构
- `a364799` - fix(ui): 增强图像模式模型选择的防御性
- `687a4f1` - fix(ui): 修复 session 状态持久化的 P0 问题
- `3ede3d8` - refactor(ui): 重构 ImageWorkspace 为 session store 单一真源并修复历史加载
- `2b669b9` - refactor(ui): 完善单一真源架构并优化代码分割

## 代码统计

### 最终提交（2b669b9）
- **总变更**: 91 个文件
- **新增**: +13,757 行
- **删除**: -4,989 行
- **净增**: +8,768 行

### 主要新增文件
- `packages/core/src/services/image/storage.ts` (457 行)
- `packages/core/src/services/image/index.ts` (47 行)
- `packages/ui/src/components/basic-mode/BasicSystemWorkspace.vue` (680 行)
- `packages/ui/src/components/basic-mode/BasicUserWorkspace.vue` (685 行)
- `packages/ui/src/components/image-mode/ImageImage2ImageWorkspace.vue` (2,205 行)

### 主要删除文件
- `packages/ui/src/components/basic-mode/BasicModeWorkspace.vue` (-635 行)
- `packages/ui/src/composables/image/useImageWorkspace.ts` (-927 行)

## 相关架构文档

- **前置重构**: [117-pinia-refactoring](../117-pinia-refactoring/) - Pinia 状态管理引入
- **核心架构**: [docs/architecture/storage-key-architecture.md](../../architecture/storage-key-architecture.md)
- **开发指南**: [docs/developer/technical-development-guide.md](../../developer/technical-development-guide.md)

## 经验总结

### 成功经验
1. ✅ **单一真源原则**：Session Store 作为唯一数据源，避免状态分叉
2. ✅ **防御性编程**：未恢复前禁止保存，避免数据覆盖
3. ✅ **串行化处理**：大对象序列化采用串行，避免内存峰值
4. ✅ **代码分割优先**：移除不必要的静态导出，让动态导入生效

### 注意事项
1. ⚠️ ComputedRef 在 `<script setup>` 中需要显式 `.value`
2. ⚠️ computed getter 不应返回临时对象（破坏依赖追踪）
3. ⚠️ 并发保存需要全局锁保护
4. ⚠️ 图像存储的清理策略应基于 `accessedAt`（LRU）

### 后续优化方向
1. 完成 Logic → Operations 迁移（migration-guide.md）
2. 补充自动化测试覆盖
3. 性能监控和优化（流式 token 更新）
4. 错误边界和异常处理增强
