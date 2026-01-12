# Session Store 持久化验证方案

## 修复内容

Codex 已实现"Session Store 作为模型选择唯一真源"的架构：

- 模型选择持久化以 Session Store 为唯一真源
- PromptOptimizerApp 直接读写当前激活的 Session Store
- 移除 BasicWorkspaceContainer 的全局同步桥接
- 已清理旧的模型选择全局键（不再存在迁移逻辑）

## 测试目标

验证用户报告的 P0 级 Bug 是否已修复：
- **现象**：在 Basic 模式下将优化模型和测试模型都改为 deepseek，刷新页面后模型选择又回到了 siliconflow 和 openai
- **预期**：刷新后模型选择保持为 deepseek

## 测试步骤

### 1. 基础持久化测试

1. 访问 http://localhost:18181
2. 进入 Basic/System 模式（/basic/system）
3. **当前状态**：左侧优化模型显示 `siliconflow`，右侧测试模型显示 `openai`
4. **操作**：将左侧和右侧模型都改为 `deepseek`
5. **验证**：刷新页面（F5），确认两个模型下拉框都保持 `deepseek` ✅

### 2. 模式隔离测试

验证不同模式的模型选择是否独立：

1. 在 Basic/System 模式选择 `deepseek` 作为优化模型
2. 切换到 Basic/User 模式，选择 `gemini` 作为优化模型
3. 切换到 Pro 模式，选择 `openai` 作为优化模型
4. **验证**：
   - 返回 Basic/System，优化模型应为 `deepseek` ✅
   - 返回 Basic/User，优化模型应为 `gemini` ✅
   - 返回 Pro，优化模型应为 `openai` ✅

### 3. 迁移逻辑测试

验证 Session Store 的恢复：

1. **现有用户场景**：
   - 打开应用
   - **验证**：Session Store 中的模型选择应正确恢复 ✅

### 4. 跨浏览器测试

如果使用 Electron 桌面应用：
1. 关闭应用
2. 重新打开
3. **验证**：模型选择应正确恢复 ✅

## 测试记录

### 测试执行人
- 日期：2025-01-07
- 执行人：

### 测试结果

| 测试项 | 预期结果 | 实际结果 | 状态 |
|--------|---------|---------|------|
| 基础持久化测试 | deepseek 保持 | | ⏳ |
| 模式隔离测试 | 各模式独立 | | ⏳ |
| 迁移逻辑测试 | 正确恢复 | | ⏳ |
| 跨浏览器测试 | Electron 正常 | | ⏳ |

### 备注

## 相关文件

- `packages/ui/src/composables/model/useModelManager.ts` - 模型管理器（不再负责模型选择持久化）
- `packages/ui/src/stores/session/useBasicSystemSession.ts` - Basic/System Session Store
- `packages/ui/src/stores/session/useBasicUserSession.ts` - Basic/User Session Store
- `packages/ui/src/stores/session/useProMultiMessageSession.ts` - Pro Session Store
- `packages/ui/src/components/workspaces/BasicWorkspaceContainer.vue` - Basic 容器（已移除同步）
- `packages/ui/src/components/app-layout/PromptOptimizerApp.vue` - 主应用（直接读写 Session）

## 下一步计划

如果测试通过：
1. 确认 Electron 端必须继续使用 PreferenceService（而非 localStorage）
2. 逐步扩展迁移逻辑覆盖其他配置项（主题、语言等）
3. 补齐自动化回归用例（模式隔离、快速切换、刷新恢复）
