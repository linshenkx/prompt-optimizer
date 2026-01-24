# 发现与决策

## 需求摘要

- 本期实现范围：仅 `basic-user`（后续再推广到其他子模式）。
- 测试区输入必须与编辑区 textarea 解耦。
- 提示词版本来源：session 的历史链（`v0..vn`）。
  - `v0`：原始提示词（不在历史链中作为一条 record 存在）
  - `v1..vn`：历史链版本号
- 每个测试结果面板独立选择：
  - 提示词版本（`v0..vn` + `latest`）
  - 模型（左右可不同）
- 默认对比：`v0` vs `latest(vn)`。
- Compare 测试并行执行。
- 不允许选择草稿/未保存提示词。

## 代码/结构发现

- 版本链模型来自 core history：
  - `packages/core/src/services/history/types.ts` 定义 `PromptRecord` / `PromptRecordChain`。
  - 历史链版本号为 `version = 1..n`；`v0` 单独由原始提示词代表。
- basic-user 当前测试入口：
  - `packages/ui/src/components/basic-mode/BasicUserWorkspace.vue` → `<TestAreaPanel>`
  - 测试执行由 `packages/ui/src/composables/workspaces/useBasicWorkspaceLogic.ts#handleTest` 驱动。
- UI 容器结构：
  - `TestAreaPanel` 包含：`TestControlBar` + `TestResultSection`。
  - `TestResultSection` 负责结果卡片 header + 评估入口。
- `SelectWithConfig` 默认注入 `style: { minWidth: '160px' }`（见 `packages/ui/src/components/SelectWithConfig.vue`）。
  - 当把它放进结果卡 header 时，会明显挤压标题区域，窄屏容易溢出。

## 技术决策

| 决策 | 理由 |
| --- | --- |
| 在 `useBasicUserSession` 中持久化 per-panel 的 version+model 选择（`testPanels`） | session 已持久化 compare/testContent 等状态；符合“session-scoped”的预期。 |
| `version` 使用 `0 | number | 'latest'` 表示 | 易持久化、易绑定到 select，`latest` 可跟随新版本增长。 |
| 通过确定性 resolver 将选择值解析为 prompt 文本 | 解耦 UI 与测试逻辑，并对缺失/非法版本做 fallback。 |
| `TestResultSection` 增加 header-extra slots，`TestAreaPanel` 透传 | 组件保持通用；各 workspace 仅注入自己的控制区。 |

## UI/布局决策（本次）

| 决策 | 理由 |
| --- | --- |
| 结果卡 header/actions 允许换行（flex-wrap） | 避免窄屏时标题+选择器+评估入口溢出。 |
| 限制选择器宽度：version 固定 `100px`；model 覆盖为 `min-width: 120px; width: 160px` | 解决 `SelectWithConfig` 默认 minWidth=160 造成的宽度压力，同时保持可用性。 |
| 在 header-extra 内使用 `NFlex` 对齐与 spacing | 比 `NSpace wrap=false` 更可控，且在 header 换行时更稳定。 |

## 资源

- Core history types：`packages/core/src/services/history/types.ts`
- Basic 测试逻辑：`packages/ui/src/composables/workspaces/useBasicWorkspaceLogic.ts`
- Basic-user workspace：`packages/ui/src/components/basic-mode/BasicUserWorkspace.vue`
- Test area 组件：`packages/ui/src/components/TestAreaPanel.vue` / `packages/ui/src/components/TestResultSection.vue` / `packages/ui/src/components/TestControlBar.vue`
- 设计文档：`docs/architecture/test-area-version-model-selection.md`
