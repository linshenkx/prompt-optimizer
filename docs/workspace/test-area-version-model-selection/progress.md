# 进展日志

## 会话：2026-01-22

### Phase 1：需求与现状梳理（已完成）

- 动作：
  - 阅读 basic-user 现有测试流与 workspace 绑定关系。
  - 定位历史链数据模型与当前测试执行逻辑。
  - 明确目前不支持 per-panel 模型/版本选择。
- 产出：`findings.md`。

### Phase 2：方案设计（已完成）

- 动作：
  - 定义 session-scoped 的 per-panel version/model 数据模型。
  - 定义 v0/fixed/latest 的解析规则。
  - 定义 UI 方案：结果卡 header 注入选择器。
  - 输出设计文档。
- 产出：`task_plan.md`、`docs/architecture/test-area-version-model-selection.md`。

## 会话：2026-01-23

### 先行修复（已完成）

- 修复 `save-local-edit` 在 basic 子模式不落盘的问题，并移除“功能开发中”占位提示。
- 相关提交：`ba3c4b7`。

### Phase 3：实现（basic-user）（已完成）

- Session：`packages/ui/src/stores/session/useBasicUserSession.ts`
  - 新增 `testPanels`：每面板保存 `{ version, modelKey }`，并兼容旧数据迁移。
- 组件：
  - `packages/ui/src/components/TestResultSection.vue`：增加 header-extra slots 并承载评估入口。
  - `packages/ui/src/components/TestAreaPanel.vue`：透传 header-extra slots；允许隐藏顶部 model-select。
  - `packages/ui/src/components/TestControlBar.vue`：支持 `showModelSelect`。
- Basic-user：`packages/ui/src/components/basic-mode/BasicUserWorkspace.vue`
  - 结果面板增加 version/model 选择器（original/optimized/single）。
  - 测试输入 prompt 改为从版本链 resolver 解析得到。
  - Compare 模式测试并行执行。
  - Evaluation 使用解析后的 prompt/结果对齐（original/optimized/compare）。
- 测试执行：`packages/ui/src/composables/workspaces/useBasicWorkspaceLogic.ts`
  - `handleTest` 支持 options 对象输入，并在 compare 模式支持并行执行。

### Phase 4：UI/布局优化（已完成）

- 解决结果卡 header 溢出：`TestResultSection` header/actions 启用 flex-wrap。
- 降低选择器宽度压力：在 `BasicUserWorkspace` 的 header-extra 中约束 version/model select 宽度。

### 验证（已完成）

| 命令 | 结果 |
| --- | --- |
| `pnpm -F @prompt-optimizer/ui lint` | 通过 |
| `pnpm -F @prompt-optimizer/ui typecheck` | 通过 |
| `pnpm -F @prompt-optimizer/ui test` | 通过 |
