# 评估功能（Evaluation）近期代码变更审查报告（2025-12-17）

> 说明：按要求**不在 WSL 环境运行测试/构建**（该仓库为 Windows 项目）。本报告基于提交记录与静态代码阅读，附带在 Windows 环境下的手动验证清单。

## 1. 审查范围与证据来源

### 1.1 覆盖提交（按时间）

- `821c0fb` 2025-12-12：`feat(evaluation): 新增 LLM 智能评估功能`
- `121f049` 2025-12-14：`refactor(evaluation): 优化评估系统的字段命名和评分策略`
- `4262895` 2025-12-15：`feat(evaluation): 支持将评估改进建议应用到迭代优化`
- `7d28de6` 2025-12-15：`feat(evaluation): 实现多模式评估系统支持`
- `67c30ea` 2025-12-15：`feat(evaluation): 为高级模式添加评估 UI 集成`
- `f1ed1c9` 2025-12-16：`refactor(evaluation): 修复高级模式评估问题并抽取通用逻辑`
- `7369408` 2025-12-16：`feat(extension): 集成评估功能并优化测试区域组件`
- `eaba046` 2025-12-17：`feat(ui): 添加功能模型管理器支持独立配置评估模型`

### 1.2 关键文件清单（抽样）

**Core**
- `packages/core/src/services/evaluation/service.ts`
- `packages/core/src/services/evaluation/types.ts`
- `packages/core/src/services/evaluation/errors.ts`
- `packages/core/src/services/template/default-templates/evaluation/**`
- `packages/core/src/constants/storage-keys.ts`

**UI**
- `packages/ui/src/composables/prompt/useEvaluation.ts`
- `packages/ui/src/composables/prompt/useEvaluationHandler.ts`
- `packages/ui/src/components/evaluation/EvaluationPanel.vue`
- `packages/ui/src/components/evaluation/EvaluationScoreBadge.vue`
- `packages/ui/src/components/evaluation/EvaluationHoverCard.vue`
- `packages/ui/src/components/context-mode/ContextUserWorkspace.vue`
- `packages/ui/src/components/context-mode/ContextSystemWorkspace.vue`
- `packages/ui/src/composables/model/useFunctionModelManager.ts`

**集成层**
- `packages/web/src/App.vue`
- `packages/extension/src/App.vue`

## 2. 变更概览（做了什么）

### 2.1 Core：评估服务与协议

- 新增 `EvaluationService`：支持非流式与流式评估（`evaluate`/`evaluateStream`），并对请求做字段校验、模板获取、LLM 调用与结果解析。见 `packages/core/src/services/evaluation/service.ts:42` 起。
- 建立统一的评估响应结构：`score.overall` + `score.dimensions[]` + `issues[]` + `improvements[]` + `summary` + `isOptimizedBetter?`。见 `packages/core/src/services/evaluation/types.ts:150` 起。
- 引入多模式模板命名规则：`evaluation-{functionMode}-{subMode}-{type}`（basic/pro/image × subMode × original/optimized/compare）。见 `packages/core/src/services/evaluation/types.ts:236` 及 `packages/core/src/services/evaluation/service.ts:245`。
- Pro 场景上下文（`proContext`）支持：
  - Pro-System：目标消息 + 全量对话列表。见 `packages/core/src/services/evaluation/types.ts:38` 起。
  - Pro-User：变量列表（含来源）+ raw/resolved prompt。见 `packages/core/src/services/evaluation/types.ts:63` 起。

### 2.2 UI：状态管理、入口与结果展示

- `useEvaluation`：维护按类型隔离的评估状态（original/optimized/compare），支持流式 token 累积、结果缓存与错误展示。见 `packages/ui/src/composables/prompt/useEvaluation.ts:49` 起。
- `useEvaluationHandler`：把“从页面状态拼请求、触发评估、面板 props 组装、清理旧结果、应用改进建议”等接线逻辑集中，减少 App/Workspace 重复代码。见 `packages/ui/src/composables/prompt/useEvaluationHandler.ts:158` 起。
- UI 组件链路：
  - `EvaluationPanel.vue`：抽屉式详情（分数、维度、问题、改进、一键应用到迭代、重试/清理）。见 `packages/ui/src/components/evaluation/EvaluationPanel.vue:1` 起。
  - `EvaluationScoreBadge.vue` + `EvaluationHoverCard.vue`：分数徽章与悬浮预览（维度/问题/改进/详情入口）。见 `packages/ui/src/components/evaluation/EvaluationScoreBadge.vue:1` 起。
  - `TestResultSection.vue`：把评估入口嵌到测试结果卡片 header（原始/优化各自入口）。见 `packages/ui/src/components/TestResultSection.vue:38` 起。

### 2.3 集成：web / extension / context workspace

- `packages/web/src/App.vue`、`packages/extension/src/App.vue`：引入 `EvaluationPanel`，并在对比模式下额外提供 compare 评估入口（custom-actions 区域）。见 `packages/web/src/App.vue:747`、`packages/extension/src/App.vue:747`。
- context-mode：
  - `ContextSystemWorkspace.vue` 组装 Pro-System `proContext`，并在测试前清理旧评估结果（避免复测残留）。见 `packages/ui/src/components/context-mode/ContextSystemWorkspace.vue:400`、`:560`。
  - `ContextUserWorkspace.vue` 组装 Pro-User `proContext`（变量收集 + raw/resolved），并在测试前清理旧评估结果。见 `packages/ui/src/components/context-mode/ContextUserWorkspace.vue:381`、`:676`。

### 2.4 评估模型独立配置（Function Model）

- 新增全局存储键 `FUNCTION_MODEL_KEYS.EVALUATION_MODEL`。见 `packages/core/src/constants/storage-keys.ts:57`。
- `useFunctionModelManager` 使用单例保存评估模型偏好，并提供 `effectiveEvaluationModel`（优先评估模型，否则跟随 optimize 模型）。见 `packages/ui/src/composables/model/useFunctionModelManager.ts:39` 起。
- `useEvaluation` 在请求里通过 `getModelKey()` 实现“只要用户曾配置过评估模型则始终优先使用，否则退回传入 key/全局优化模型”。见 `packages/ui/src/composables/prompt/useEvaluation.ts:267` 起。

## 3. 架构评价（优点）

1) **Core/UI 分层清晰**
- Core 侧负责：请求校验、模板选择、LLM 调用、结果解析/规范化；UI 侧负责状态机与交互呈现（徽章/悬浮/抽屉）。

2) **多模式扩展路径明确**
- 通过 `mode(functionMode/subMode)` + 模板 ID 规则，把“不同功能模式/子模式的评估提示词差异”完全交给模板层，避免业务代码大量分支。证据：`packages/core/src/services/evaluation/service.ts:245-247`。

3) **评估状态按类型隔离，避免互相污染**
- original/optimized/compare 各自拥有独立的 `isEvaluating/result/streamContent/error`。证据：`packages/ui/src/composables/prompt/useEvaluation.ts:49-58`。

4) **“评估 -> 迭代”闭环落地**
- UI 可从改进建议直接打开迭代弹窗预填。证据：`packages/ui/src/composables/prompt/useEvaluationHandler.ts:301-315` 与 `packages/ui/src/components/evaluation/EvaluationPanel.vue:90-102`。

## 4. 主要问题与风险（含证据）

### 4.1 JSON 提取正则可能“抓太多”，导致结构化解析失败后降级丢信息

**证据**
- `packages/core/src/services/evaluation/service.ts:302-306`：
  - 先匹配 fenced ` ```json ... ``` `
  - 否则用 `/\{[\s\S]*"score"[\s\S]*\}/` 抓取 JSON 块

**风险说明**
- 当 LLM 输出包含多个 `{...}` 片段、或在 JSON 前后混入说明性 `{}`/示例时，这个正则可能匹配到过长内容，`JSON.parse` 失败后走文本降级（只提取总体分，`issues/improvements/dimensions` 都会丢失）。

**建议（可选实现方向）**
- 优先要求模板输出 fenced JSON（目前模板已要求），并在解析端：
  - 仅在 fenced 失败时做“括号平衡截取”或“从短到长的可解析片段尝试”，而不是单个贪婪正则。

### 4.2 compare 评估结果 `isOptimizedBetter` 未显式规范化为 boolean

**证据**
- `packages/core/src/services/evaluation/service.ts:410-413`：`response.isOptimizedBetter = data.isOptimizedBetter;`

**风险说明**
- LLM 可能返回 `"true"`/`"false"` 字符串或其它类型。UI 里多处按 boolean 使用（例如 `EvaluationPanel` 的对比提示、`EvaluationHoverCard` 的结论展示），可能出现误判或展示不一致。

**建议**
- 在 `normalizeEvaluationResponse` 中对该字段做 `typeof === 'boolean'` 校验；或兼容 `"true"/"false"` 字符串转换；否则置 `undefined`。

### 4.3 `useEvaluation` 默认不打开面板（openPanel=false），可能造成“无明显反馈”的体验差

**证据**
- `packages/ui/src/composables/prompt/useEvaluation.ts:322-346`：`executeEvaluation(..., openPanel=true)` 才会设置 `activeDetailType` 并打开面板。
- 但 `evaluateOriginal/Optimized/Compare` 均调用 `executeEvaluation(..., false)`，见：
  - `packages/ui/src/composables/prompt/useEvaluation.ts:388`
  - `packages/ui/src/composables/prompt/useEvaluation.ts:412`
  - `packages/ui/src/composables/prompt/useEvaluation.ts:438`

**风险说明**
- 首次评估时用户可能只看到按钮/徽章 loading，但看不到流式 token 预览；若评估失败，错误 toast 可能一闪而过，不易定位。

**建议**
- 至少对以下场景打开面板：compare、错误发生时、或用户显式点击“查看详情/评估”入口（与 hover card 交互对齐）。

### 4.4 Pro-User 变量扫描回退正则不支持中文变量名

**证据**
- `packages/ui/src/components/context-mode/ContextUserWorkspace.vue:405-407`：回退使用 `/\{\{(\w+)\}\}/g`。

**风险说明**
- 当 `variableManager` 未就绪（或某些 host 未注入）时，回退扫描会漏掉中文变量名（`\w` 不包含中文），导致 `proContext.variables` 不完整，评估模板收到的变量上下文失真。

**建议**
- 回退正则改为更宽松的占位符提取（例如抓取 `{{...}}` 非贪婪，再做 trim/过滤），或支持 Unicode 字符集。

### 4.5 功能模型管理器使用全局单例：多宿主/多 services 场景可能产生耦合

**证据**
- `packages/ui/src/composables/model/useFunctionModelManager.ts:39-61`：`instance` 全局单例，存在即直接返回。
- 同文件 `:63`：`usePreferences(services)` 绑定首次传入的 `services` 引用。

**风险说明**
- 若未来出现多个宿主（web/extension/desktop）在同进程/同页面引入同一 bundle 且 services 来源不同，单例会把偏好读写"锁定"在首次的 services 上，导致配置不一致或难以排查。

**建议**
- 若确定永远单宿主可忽略；否则可考虑按 storage backend/keyed 单例，或允许更新内部 services 依赖。

### 4.6 类型断言过度使用（`as any`）影响类型安全

**证据**
- `packages/ui/src/composables/prompt/useEvaluation.ts:289`：
  ```typescript
  const selectedOptimizeModel = (services.value?.modelManager as any)?.selectedOptimizeModel || ''
  ```
- `packages/ui/src/composables/model/useFunctionModelManager.ts:84`：
  ```typescript
  (services.value?.modelManager as any)?.selectedOptimizeModel
  ```

**风险说明**
- 使用 `as any` 绕过类型检查，若 `modelManager` 接口变更，编译器无法捕获错误，可能导致运行时异常。

**建议**
- 扩展 `AppServices` 类型定义，为 `modelManager` 添加 `selectedOptimizeModel` 属性声明，移除 `as any`。

### 4.7 Extension App.vue 文件过于庞大

**证据**
- `packages/extension/src/App.vue`：当前约 **2438 行**（与 `packages/web/src/App.vue` 同量级）。
- `7369408` 对 `packages/extension/src/App.vue` 的单次变更为 **+256/-141 行**（`git show --stat 7369408 -- packages/extension/src/App.vue`）。

**风险说明**
- 单个文件行数过多，难以维护和审查；评估相关逻辑与其他业务逻辑混杂，职责边界模糊。

**建议**
- 将评估相关逻辑抽取到独立的 composable（如 `useExtensionEvaluation`）。
- 考虑将 `TestAreaPanel` 的 props 配置抽取到配置对象，减少模板复杂度。

### 4.8 Extension 重复实现 `handleApplyImprovement` 未复用工厂方法

**证据**
- `packages/extension/src/App.vue:1707-1717`（当前版本行号可能随其他改动漂移）：
  ```typescript
  const handleApplyImprovement = (payload: { improvement: string; type: EvaluationType }) => {
    evaluation.closePanel()
    promptPanelRef.value?.openIterateDialog?.(improvement)
  }
  ```
- `packages/ui/src/composables/prompt/useEvaluationHandler.ts:295-309`：已提供 `createApplyImprovementHandler` 工厂方法。

**风险说明**
- 逻辑重复，若后续需要修改"应用改进建议"的行为，需同步修改多处，易遗漏。

**建议**
- Extension 中使用 `evaluationHandler.createApplyImprovementHandler(promptPanelRef)` 替代手动实现，保持一致性。

### 4.9 UI 包导出变更可能影响外部依赖

**证据**
- `eaba046` 在 `packages/ui/src/index.ts` 删除了以下导出（并新增 `FunctionModelManagerUI`）：
  ```typescript
  - export { default as ModelSelectUI } from "./components/ModelSelect.vue";
  - export { default as BasicTestMode } from "./components/BasicTestMode.vue";
  ```
- 当前仓库中 `packages/ui/src/components/ModelSelect.vue`、`packages/ui/src/components/BasicTestMode.vue` 均已不存在，因此移除导出与“组件已废弃/被替换”这一事实一致。

**风险说明**
- 若外部代码（如 desktop 或第三方）依赖这些导出，会导致编译/运行时错误。

**建议**
- 确认对外发布版本是否需要在 `CHANGELOG`/迁移文档中明确标注破坏性变更；如仍需兼容，可考虑提供临时别名/空壳导出并给出替代方案。

## 5. 回归/验证建议（Windows 环境）

> 建议在 Windows 终端执行（不要在 WSL）。

### 5.1 推荐命令

- 全量测试：`pnpm test`
- Core 测试：`pnpm -F @prompt-optimizer/core test`
- UI lint：`pnpm -F @prompt-optimizer/ui lint`
- Web 启动：`pnpm dev`
- Extension 启动：`pnpm dev:ext`

### 5.2 手工用例清单（高价值）

1) **模板命中正确性**
- 覆盖 `basic/pro/image` × 各子模式 × `original/optimized/compare`，确认最终请求的模板 ID 符合：`evaluation-{functionMode}-{subMode}-{type}`（证据：`packages/core/src/services/evaluation/service.ts:245-247`）。

2) **结构化解析稳定性**
- 构造模型输出：在 JSON 前后插入额外 `{}`/解释文字，观察是否仍能正确解析 `dimensions/issues/improvements`（风险点见 §4.1）。

3) **compare 评估一致性**
- Web 与 Extension：
  - 对比模式下点击 compare 评估入口，检查结果是否进入同一套详情面板渲染（证据：`packages/web/src/App.vue:747`、`packages/extension/src/App.vue:747`）。
  - 强制让模型返回 `"isOptimizedBetter": "true"`（字符串），观察 UI 是否误判（风险点见 §4.2）。

4) **Pro-System（多消息）**
- 切换目标消息后进行评估：确认 `proContext.targetMessage.originalContent` 与 `optimizedPrompt` 映射正确（证据：`packages/ui/src/components/context-mode/ContextSystemWorkspace.vue:400-417`）。
- “复测”前是否清理旧评估：确认不会把旧分数/建议留在新结果上（证据：`packages/ui/src/components/context-mode/ContextSystemWorkspace.vue:560-565`）。

5) **Pro-User（变量模式）**
- 使用中文变量名（例如 `{{城市}}`）在 `variableManager` 未就绪的极端情况下，确认仍能进入 `proContext.variables`（风险点见 §4.4）。

## 6. Bug 修复确认（`f1ed1c9`）

以下是提交 `f1ed1c9` 中修复的问题及其状态：

| 问题描述 | 修复方式 | 状态 |
|----------|----------|------|
| 变量模式评估传递所有变量（而非实际使用的） | 扫描 `rawPrompt` 和 `resolvedPrompt` 中实际使用的变量名，只传递相关变量 | ✅ 已修复 |
| 点击评估改进建议"应用"按钮无反应 | 使用 `createApplyImprovementHandler` 工厂方法统一处理 | ✅ 已修复 |
| 迭代弹窗确认按钮无反应 | 修复字段名 `iterationNote` → `iterateInput` | ✅ 已修复 |
| 重新测试后评估结果未清空 | 新增 `clearBeforeTest()` 方法，在测试前统一清空旧评估结果 | ✅ 已修复 |

**关键代码变更**：
- `packages/ui/src/components/context-mode/ContextUserWorkspace.vue`：实现变量扫描逻辑，仅收集实际使用的变量；并在 `f1ed1c9` 中将迭代 payload 字段从 `iterationNote` 修正为 `iterateInput`（避免迭代确认无效）。
- `packages/ui/src/composables/prompt/useEvaluationHandler.ts`：新增 `clearBeforeTest()`，并在 Context workspace 的测试流程中调用以清空旧评估结果。

## 7. 代码统计

> 统计口径：使用 `git diff 821c0fb^..eaba046` 计算**从评估功能引入前到 eaba046 的净变更**（包含该时间段内一并发生的其它改动，因此用于“规模感知”，不等同于逐 commit 叠加的总和）。

| 指标 | 数值 |
|------|------|
| 净新增行数（insertions） | 8654 |
| 净删除行数（deletions） | 876 |
| 涉及文件数 | 75 |
| 新增文件数（A） | 43 |
| 修改文件数（M） | 32 |

## 8. 问题优先级汇总

| 优先级 | 问题 | 建议工作量 | 状态 |
|--------|------|------------|------|
| 🔴 高 | §4.6 类型断言 `as any` | 小 | ✅ 已修复 |
| 🔴 高 | §4.2 `isOptimizedBetter` 类型规范化 | 小 | ✅ 已修复 |
| 🟡 中 | §4.1 JSON 提取正则优化 | 中 | ✅ 已修复 |
| 🟡 中 | §4.7 Extension App.vue 拆分 | 中 | ⏸️ 延后处理（大工程） |
| 🟡 中 | §4.3 默认打开面板策略 | 小 | ⏭️ 不修复（计划移除详情面板） |
| 🟢 低 | §4.8 复用 `createApplyImprovementHandler` | 小 | ✅ 已修复 |
| 🟢 低 | §4.4 中文变量名回退支持 | 小 | ✅ 已修复 |
| 🟢 低 | §4.5 单例模式多宿主问题 | 中 | ✅ 已评估（当前架构无影响，已添加注释） |
| 🟢 低 | §4.9 确认导出变更影响 | 小 | ✅ 已确认（无外部依赖） |

### 8.1 已修复问题详情（2025-12-17）

**§4.1 JSON 提取正则优化**
- 引入 `jsonrepair` 库（[josdejong/jsonrepair](https://github.com/josdejong/jsonrepair)）
- 自动处理：fenced code blocks、缺失引号/逗号、截断 JSON、Python 常量（None/True/False）
- 移除自定义括号平衡算法，简化代码
- 见 `packages/core/src/services/evaluation/service.ts:292-332`

**§4.2 `isOptimizedBetter` 类型规范化**
- 添加类型转换逻辑，处理 `"true"`/`"false"`/`"yes"`/`"no"` 字符串
- 非 boolean/string 类型保持 `undefined`
- 见 `packages/core/src/services/evaluation/service.ts:413-428`

**§4.6 类型断言 `as any` 移除**
- `useEvaluation.ts:getModelKey()` - 移除从 `services.modelManager` 获取 `selectedOptimizeModel` 的兜底逻辑，改用 `functionModelManager.effectiveEvaluationModel`（已从偏好设置读取）
- `useFunctionModelManager.ts:effectiveEvaluationModel` - 移除对 `services.modelManager` 的 `as any` 访问，仅依赖传入参数和偏好设置兜底
- 根本原因：`selectedOptimizeModel` 是 UI 层状态（`useModelManager` 返回），不属于 Core 层 `IModelManager` 接口
- 见 `packages/ui/src/composables/prompt/useEvaluation.ts:274-289` 和 `packages/ui/src/composables/model/useFunctionModelManager.ts:71-83`

**§4.8 复用 `createApplyImprovementHandler` 工厂方法**
- `packages/web/src/App.vue` 和 `packages/extension/src/App.vue` 中的 `handleApplyImprovement` 手动实现替换为 `evaluationHandler.createApplyImprovementHandler(promptPanelRef)`
- 消除代码重复，统一行为逻辑，便于后续维护
- 见 `packages/web/src/App.vue:1706-1707` 和 `packages/extension/src/App.vue:1706-1707`

**§4.4 中文变量名回退支持**
- `packages/ui/src/components/context-mode/ContextUserWorkspace.vue` 中的变量扫描正则从 `/\{\{(\w+)\}\}/g` 改为 `/\{\{([^{}]+)\}\}/g`
- `\w` 仅匹配 ASCII 字母数字，无法匹配中文；改用 `[^{}]+` 匹配任意非花括号字符，支持中文等 Unicode 变量名
- 增加 `.trim()` 处理和空值检查，支持 `{{ 变量名 }}` 带空格的写法
- 见 `packages/ui/src/components/context-mode/ContextUserWorkspace.vue:406-420`

**§4.5 单例模式多宿主问题**
- 经评估，当前架构下 Web/Extension/Desktop 各自独立进程/页面，不会出现同一页面多宿主的情况
- 在 `useFunctionModelManager.ts` 中添加了详细注释，说明单例模式的适用场景和架构约束
- 若未来需要多宿主支持，可改用 `resetFunctionModelManagerSingleton()` 重置或改为 keyed 单例
- 见 `packages/ui/src/composables/model/useFunctionModelManager.ts:39-55`

**§4.9 UI 包导出变更影响**
- 经检查，`ModelSelectUI` 和 `BasicTestMode` 在整个 `packages` 目录下无任何使用
- 这些组件已被删除，移除导出是正确的清理行为，无外部依赖问题

## 9. 总体结论

评估功能的主链路已经形成"**core 服务 + 模板策略 + UI 状态机 + 详情/悬浮展示 + 改进建议闭环**"的完整体系，并通过 `useEvaluationHandler` 显著减少了业务层重复接线代码。

**主要成果**：
- 完整的多模式评估支持（basic/pro/image × 各子模式）
- 独立的评估模型配置能力
- 评估结果到迭代优化的闭环流程
- 良好的状态隔离（original/optimized/compare 独立）

**待改进项**：
- ~~**类型安全**：移除 `as any`，完善类型定义（§4.6）~~ ✅ 已修复
- ~~**解析鲁棒性**：优化 JSON 提取策略，规范化 boolean 字段（§4.1、§4.2）~~ ✅ 已修复
- ~~**代码复用**：复用工厂方法（§4.8）~~ ✅ 已修复
- ~~**边界兼容**：支持中文变量名回退扫描（§4.4）~~ ✅ 已修复
- ~~**架构约束**：单例模式多宿主问题（§4.5）~~ ✅ 已评估（当前架构无影响）
- ~~**导出变更**：确认外部依赖影响（§4.9）~~ ✅ 已确认（无外部依赖）
- **代码质量**：拆分过大文件（§4.7）⏸️ 延后处理
- ~~**交互一致性**：优化面板打开策略（§4.3）~~ ⏭️ 不修复（计划移除详情面板）
