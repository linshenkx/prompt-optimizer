# 任务计划：测试区版本/模型选择（basic-user 优先）

## 目标

在 `/basic/user` 中，让右侧测试区不再读取编辑区 textarea，而是从当前 session 的版本链（`v0..vn`）选择输入，并支持：

- 每个结果面板独立选择提示词版本（`v0 / v1..vn / latest`）
- 每个结果面板独立选择测试模型（左右可以不同）

默认对比：`v0` vs `latest(vn)`，对比测试需要并行执行。

## 当前阶段

Phase 5（验证与交付）

## 阶段与状态

### Phase 1：需求与现状梳理（已完成）

- [x] 与用户确认需求与约束（basic-user first、session-scoped、无草稿选项）
- [x] 识别版本链/测试执行的现有数据流与关键文件
- [x] 将关键约束记录到 `findings.md`

### Phase 2：方案设计（已完成）

- [x] 设计 session 持久化数据模型：`testPanels.{original,optimized}.{version,modelKey}`
- [x] 设计版本解析规则：`v0` / 固定 `vN` / `latest` 跟随
- [x] 设计 UI 集成：结果卡片 header 注入选择器（slot）
- [x] 编写设计文档：`docs/architecture/test-area-version-model-selection.md`

### Phase 3：实现（basic-user）（已完成）

- [x] Session store：新增 `testPanels` 并做旧数据迁移（继承 `selectedTestModelKey`）
- [x] 组件扩展：`TestResultSection` 增加 header-extra slots；`TestAreaPanel` 透传
- [x] `BasicUserWorkspace`：加入每面板 version+model 选择器；测试改用解析后的 prompt；compare 并行
- [x] Evaluation：使用所选 prompt/结果进行评估（original/optimized/compare）

### Phase 4：UI/布局优化（已完成）

- [x] 解决 header 溢出：允许 header/actions 换行；限制 version/model 选择器宽度

### Phase 5：验证与交付（进行中）

- [x] `pnpm -F @prompt-optimizer/ui lint`
- [x] `pnpm -F @prompt-optimizer/ui typecheck`
- [x] `pnpm -F @prompt-optimizer/ui test`
- [ ]（可选）补充 e2e：覆盖 basic-user 的新选择器与并行对比行为
- [ ] 与用户确认是否提交代码变更与文档（`docs/workspace` + `docs/architecture`）

## 关键决策（摘要）

- 将 `testPanels` 持久化在 session store 中，保证刷新/重启后选择稳定。
- `version` 使用 `0 | number | 'latest'` 持久化，既易绑定又能支持 `latest` 跟随。
- 选择器放在每个结果卡 header，A/B 归属更直观；header 已做响应式换行避免溢出。
