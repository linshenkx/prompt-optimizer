# 代码审查报告：新增提示词评估类型（prompt-only / prompt-iterate）

日期：2025-12-20  
分支：`develop`  
基线提交：`390545b`（工作区存在未提交变更）  

## 1. 范围与目标

本次审查覆盖当前工作区代码变更（未提交），核心目标是：

- 在“评估（Evaluation）”能力中新增两类评估：
  - `prompt-only`：仅根据提示词本身评估质量，不依赖测试结果
  - `prompt-iterate`：在“迭代需求（iterationNote）”背景下评估提示词改进程度
- 在 UI 中新增「分析」入口与评分徽章展示，并通过 `provide/inject` 共享评估上下文，减少多层组件传递评估 props。

> 备注：本报告聚焦功能一致性、正确性与可维护性；不包含运行时验证（未执行 pnpm 指令）。

## 1.1 更新说明（重要）

- 第 4 节为“问题清单（含风险）”，记录审查时发现的缺陷与建议。
- 由于后续已有代码修复/解释补充，本报告新增第 8 节“修复状态（更新记录）”。
- 若第 4 节的“建议/风险”与第 8 节内容存在冲突，请以第 8 节的“当前实现状态”为准，并据此做回归验证。

## 2. 变更摘要（按模块）

### 2.1 Core：评估类型、校验、上下文构建

- 扩展评估类型联合：`EvaluationType` 增加 `prompt-only`、`prompt-iterate`（`packages/core/src/services/evaluation/types.ts:14`）。
- 新增请求类型：
  - `PromptOnlyEvaluationRequest`：要求 `optimizedPrompt`，不要求 `testResult`（`packages/core/src/services/evaluation/types.ts:145`）
  - `PromptIterateEvaluationRequest`：要求 `optimizedPrompt` + `iterateRequirement`（`packages/core/src/services/evaluation/types.ts:156`）
- `EvaluationService.validateRequest()` 增加上述两种类型的字段校验（`packages/core/src/services/evaluation/service.ts:159`）。
- `EvaluationService.buildTemplateContext()` 为上述两种类型注入模板上下文：
  - prompt-only：`optimizedPrompt`
  - prompt-iterate：`optimizedPrompt` + `iterateRequirement`（`packages/core/src/services/evaluation/service.ts:270`）。
- 多处错误文案由中文改为英文（例如校验/解析错误）（`packages/core/src/services/evaluation/service.ts:160`、`packages/core/src/services/evaluation/service.ts:385`）。

### 2.2 Core：内置模板注册

新增内置评估模板（basic/pro × system/user × zh/en × prompt-only/prompt-iterate），并注册到默认模板集合：

- 导出聚合：`packages/core/src/services/template/default-templates/evaluation/index.ts`
- 静态模板集合：`packages/core/src/services/template/default-templates/index.ts`
- 模板示例：
  - `evaluation-basic-system-prompt-only`（`packages/core/src/services/template/default-templates/evaluation/basic/system/evaluation-prompt-only.ts`）
  - `evaluation-pro-system-prompt-iterate`（`packages/core/src/services/template/default-templates/evaluation/pro/system/evaluation-prompt-iterate.ts`）

注意：`TemplateManager.getBuiltinTemplates()` 会根据“当前语言”选择模板集合（`packages/core/src/services/template/manager.ts:208`），因此模板 **ID 必须在不同语言集合中一致**；目前 en 文件的 `id` 与 zh 文件一致（例如 `evaluation-basic-system-original`），符合该机制。

### 2.3 Core：单元测试

- 新增 `packages/core/tests/unit/evaluation/service.test.ts`，覆盖：
  - `prompt-only/prompt-iterate` 校验规则（包括不要求 `testResult`、`iterateRequirement` 必填）
  - 模板 ID 生成与模板拉取是否按预期发生
  - `evaluateStream` 回调路径（`packages/core/tests/unit/evaluation/service.test.ts:73`）。

### 2.4 UI：评估 composable 扩展与上下文注入

- `useEvaluation`：
  - 扩展状态 `state['prompt-only']`、`state['prompt-iterate']`
  - 新增计算属性（分数/等级/是否评估中/是否有结果）
  - 新增方法 `evaluatePromptOnly()`、`evaluatePromptIterate()`
  - `executeEvaluation()` 的 request 类型由联合改为 `EvaluationRequest`（`packages/ui/src/composables/prompt/useEvaluation.ts:375`）。
- 新增评估上下文：
  - `provideEvaluation()` / `useEvaluationContext()` / `useEvaluationContextOptional()`（`packages/ui/src/composables/prompt/useEvaluationContext.ts:28`）。
- `PromptOptimizerApp` 提供上下文：
  - `provideEvaluation(evaluation)`（`packages/ui/src/components/app-layout/PromptOptimizerApp.vue:993`）。
- i18n 增加文案：
  - `prompt.analyze`
  - `prompt.error.noOptimizedPrompt`（`packages/ui/src/i18n/locales/zh-CN.ts:1131`、`packages/ui/src/i18n/locales/en-US.ts:1163`）。

### 2.5 UI：PromptPanel 增加“分析入口”与评分徽章

- `PromptPanel`：
  - 通过 `useEvaluationContextOptional()` 读取上下文（`packages/ui/src/components/PromptPanel.vue:358`）。
  - 计算评估类型：若当前版本存在 `iterationNote`，使用 `prompt-iterate`，否则 `prompt-only`（`packages/ui/src/components/PromptPanel.vue:371`）。
  - 入口 UI：
    - 若有结果或正在评估：展示 `EvaluationScoreBadge`
    - 否则：展示「分析」按钮（`packages/ui/src/components/PromptPanel.vue:122`）。
  - 点击「分析」：
    - 若 `optimizedPrompt` 为空，toast `prompt.error.noOptimizedPrompt`
    - 否则按是否有 `iterationNote` 调用 `evaluation.evaluatePromptOnly/Iterate`（`packages/ui/src/components/PromptPanel.vue:489`）。

## 3. 关键链路梳理（用于定位问题）

### 3.1 Core 评估执行链路

1) UI 组装 `EvaluationRequest`  
2) `EvaluationService.validateRequest()` 校验必要字段  
3) 根据 `mode` + `type` 组装模板 ID：`evaluation-{functionMode}-{subMode}-{type}`（`packages/core/src/services/evaluation/service.ts:263`）  
4) `TemplateManager.getTemplate(id)`：按语言选择内置模板集合，并用相同的 `id` 查找（`packages/core/src/services/template/manager.ts:208`）  
5) `buildTemplateContext()` 注入字段（`optimizedPrompt` / `iterateRequirement` 等）  
6) 调用 LLM（stream 或非 stream）  
7) `parseEvaluationResult()` → `normalizeEvaluationResponse()` 规范化输出（`packages/core/src/services/evaluation/service.ts:331`）。

### 3.2 UI 展示链路（新类型）

- `PromptOptimizerApp`：统一持有 `evaluation` 实例，并通过 `provideEvaluation()` 注入  
- `PromptPanel`：直接通过 `inject` 调用评估方法并展示结果徽章  
- `EvaluationPanel`：仍由顶层统一展示（依赖 `evaluation.state.activeDetailType`、`evaluation.activeResult` 等）。

## 3.3 设计说明：为什么“不同模式格式不同”不必导致“多套评估实例”

不同模式（basic/pro、system/user）在“优化对象形态、评估维度、上下文信息”上确实可能不同，但在当前架构下，这些差异主要由“请求参数 + 模板选择 + 上下文注入”解决，不必通过“每个 Workspace 各自一套 evaluation 实例”解决。

- **模板选择天然区分模式**：Core 通过 `evaluation-{functionMode}-{subMode}-{type}` 生成模板 ID，不同模式会命中不同模板（`packages/core/src/services/evaluation/service.ts:263`）。
- **上下文差异通过 `proContext` 注入**：Pro-System 需要多消息上下文，Pro-User 需要变量解析上下文。当前通过 `provideProContext()` 在 Workspace 提供，并在 `PromptPanel` 评估时读取注入（`packages/ui/src/components/context-mode/ContextSystemWorkspace.vue:420`、`packages/ui/src/components/PromptPanel.vue:363`、`packages/ui/src/components/PromptPanel.vue:489`）。
- **输出结构被统一规范化**：模板可返回不同 `dimensions[]`，但最终都会被规范化为统一的 `EvaluationResponse` 结构，UI 可复用同一渲染组件（`packages/core/src/services/evaluation/service.ts:394`、`packages/core/src/services/evaluation/types.ts:206`）。

结论：建议“全局一套 evaluation（App-level）+ provide/inject”，用 `mode/proContext/type` 适配不同模式差异；这样能避免 Context 模式出现“双套评估状态/双面板”的割裂问题（见第 9 节）。

## 4. 主要问题与风险（按优先级）

### P0：评估面板“重新评估”对新类型无效（功能缺口）

**状态**：✅ 已修复（见第 8 节“P0-1”）

**现象**
- 在 `EvaluationPanel` 中触发 “重新评估（re-evaluate）” 时，若当前详情类型为 `prompt-only` 或 `prompt-iterate`，不会重新发起请求。

**原因定位**
- `handleReEvaluate()` 读取 `evaluation.state.activeDetailType` 并调用 `handleEvaluate(currentType)`（`packages/ui/src/composables/prompt/useEvaluationHandler.ts:220`）。
- 但 `handleEvaluate(type)` 只处理 `original/optimized/compare` 三种类型（`packages/ui/src/composables/prompt/useEvaluationHandler.ts:183`），对新类型没有分支，等同于“无操作返回”。

**影响**
- 用户从详情面板复评新类型无响应，体验不一致；
- 若未来 `EvaluationScoreBadge` 也依赖 `EvaluationPanel` 复评链路，问题将进一步扩大。

**建议**
- 在 `useEvaluationHandler.handleEvaluate()` 增加对 `prompt-only/prompt-iterate` 的分支，并考虑从状态或上下文中取得 `iterateRequirement`（或由 UI 提供）。

---

### P0：Context 模式下 “@analyze” 监听与 proContext 传递存在不一致/死代码

**状态**：✅ 已修复（见第 8 节“P0-2”）

**现象**
- `ContextSystemWorkspace` 与 `ContextUserWorkspace` 监听 `@analyze="handleAnalyze"`，并在 `handleAnalyze` 中调用 `evaluation.evaluatePromptOnly/Iterate` 且传入 `proContext`（`packages/ui/src/components/context-mode/ContextSystemWorkspace.vue:518`、`packages/ui/src/components/context-mode/ContextUserWorkspace.vue:769`）。
- 但 `PromptPanel` 并未定义/emit `analyze` 事件（`packages/ui/src/components/PromptPanel.vue:413`），点击「分析」走的是 `handleEvaluate()` 直接调用 `evaluation.evaluatePromptOnly/Iterate`，且未传 `proContext`（`packages/ui/src/components/PromptPanel.vue:489`）。

**影响**
- `@analyze` 监听逻辑大概率不会触发，成为“死代码”；
- Pro 模式模板对 `proContext` 依赖较强（尤其 `pro-system` 场景，用于多消息上下文理解），未传会降低评估质量。

**建议（历史记录）**
- 原建议为“事件驱动”或“上下文直连”二选一避免双轨；当前实现已选择“上下文直连”，并通过 `provide/inject` 共享 `proContext`（见第 8 节“P0-2”）。

---

### P0：新类型评估结果可能与当前展示内容不一致（旧分数残留风险）

**状态**：✅ 已修复（见第 8 节“P0-3”）

**现象**
- `PromptPanel` 徽章展示基于 `evaluation.state['prompt-only'|'prompt-iterate']` 是否已有结果（`packages/ui/src/components/PromptPanel.vue:399`）。
- 当切换版本/切换消息/替换 `optimizedPrompt` 时，如果没有明确清理对应评估状态，徽章可能展示上一条内容的分数与详情。

**当前已有防护**
- 顶层仅对 `optimizer.optimizedPrompt` 做了 watch 并清理 `prompt-only/prompt-iterate`（`packages/ui/src/components/app-layout/PromptOptimizerApp.vue:1340`）。

**风险点**
- Context 模式下 `PromptPanel` 的 `optimizedPrompt` 来自 `displayAdapter.displayedOptimizedPrompt`（`packages/ui/src/components/context-mode/ContextSystemWorkspace.vue:102`），不一定会触发上述 watch；
- 即使触发，`PromptPanel` 内部也没有基于 `currentVersionId` 或 `selectedMessage` 的精确清理逻辑。

**建议**
- 在 `PromptPanel` 内部针对 `optimizedPrompt`、`currentVersionId`、`versions`（或等价“内容标识”）做 watch，主动清空对应评估状态，确保“内容-评估结果”一致性。

---

### P1：模板输出字段与服务规范化逻辑不一致（isOptimizedBetter 被丢弃）

**现象**
- `prompt-only/prompt-iterate` 模板输出 JSON 中包含 `"isOptimizedBetter"`（例如 `packages/core/src/services/template/default-templates/evaluation/basic/system/evaluation-prompt-only.ts`）。
- 但 `normalizeEvaluationResponse()` 仅在 `type === 'compare'` 时才会把 `isOptimizedBetter` 写入响应（`packages/core/src/services/evaluation/service.ts:468`）。

**影响**
- 模板 token 成本增加但信息被丢弃；
- 易产生误导：模板要求输出 true/false，但 UI/服务端并不消费该字段。

**建议**
- 明确语义：若希望 prompt-only/prompt-iterate 也保留该字段，扩展响应结构与 UI 展示；若不需要，应移除模板中的字段要求（更省 token、更一致）。

---

### P1：错误文案从中文切换为英文，可能造成中文界面体验割裂

**现象**
- Core 抛出的校验/解析错误信息改为英文（`packages/core/src/services/evaluation/service.ts:160` 等）。
- UI toast 使用 `getErrorMessage(error)` 透传（`packages/ui/src/composables/prompt/useEvaluation.ts:410`），在中文界面下可能显示英文错误。

**影响**
- 用户体验与 i18n 文案体系不一致；
- 单测已锁定英文字符串，后续想恢复中文会引入测试修改成本（`packages/core/tests/unit/evaluation/service.test.ts:100`）。

**建议**
- 若希望 i18n 统一：考虑在 UI 层将错误映射到本地化 key（按 error class / error code），而不是依赖错误 message 文案。

---

### P2：PromptPanel emit 声明存在冗余/误导

**现象**
- `PromptPanel` 的 `defineEmits` 新增了 `"apply-improvement"`，但注释中提到“评估相关事件（evaluate 和 show-evaluation-detail 已通过 inject 处理）”（`packages/ui/src/components/PromptPanel.vue:431`）。
- 同时 workspace 中仍出现 `@analyze` 监听（见 P0），但 `PromptPanel` 并未 emit。

**影响**
- 组件接口不清晰，调用方难以判断哪些事件仍有效；
- 容易引入更多“监听了但永远不触发”的事件绑定。

**建议**
- 统一组件契约：对外只保留必要事件（例如 `apply-improvement`），其余通过 context 内部处理即可。

## 5. 测试与回归关注点

### 已覆盖
- Core `EvaluationService` 对新类型的校验、模板 ID 生成、`evaluateStream` 回调路径已有单测（`packages/core/tests/unit/evaluation/service.test.ts:73`）。

### 建议补充（可选）
- UI 层至少做一次“切换版本/切换消息后徽章不残留”的用例验证（手测即可，或后续补 e2e/组件测试）。
- Pro 模式下确认 `proContext` 在 prompt-only/prompt-iterate 评估中确实被带入，且模板渲染符合预期。

## 6. 建议行动清单（可直接转为 TODO）

1) `useEvaluationHandler.handleEvaluate()` 支持 `prompt-only/prompt-iterate`，确保 `EvaluationPanel` 的 re-evaluate 可用。  
2) 统一“分析”入口架构：删除死代码或补齐 `PromptPanel` 的 `analyze` emit，并确保 Pro 场景传递 `proContext`。  
3) 在 `PromptPanel` 内增加内容变更触发的 `clearResult('prompt-only'|'prompt-iterate')`，避免旧分数残留。  
4) 明确并统一 `isOptimizedBetter` 的语义（模板/服务/前端三方一致）。  
5) 如需 i18n 统一，考虑“错误码/错误类型 → 文案 key”的映射策略，减少对英文 message 的依赖。  

## 7. 附录：文件变更清单

### 已修改（M）
- `packages/core/src/services/evaluation/service.ts`
- `packages/core/src/services/evaluation/types.ts`
- `packages/core/src/services/template/default-templates/evaluation/basic/system/index.ts`
- `packages/core/src/services/template/default-templates/evaluation/basic/user/index.ts`
- `packages/core/src/services/template/default-templates/evaluation/index.ts`
- `packages/core/src/services/template/default-templates/evaluation/pro/system/index.ts`
- `packages/core/src/services/template/default-templates/evaluation/pro/user/index.ts`
- `packages/core/src/services/template/default-templates/index.ts`
- `packages/ui/src/components/PromptPanel.vue`
- `packages/ui/src/components/app-layout/PromptOptimizerApp.vue`
- `packages/ui/src/components/basic-mode/BasicModeWorkspace.vue`
- `packages/ui/src/components/context-mode/ContextSystemWorkspace.vue`
- `packages/ui/src/components/context-mode/ContextUserWorkspace.vue`
- `packages/ui/src/composables/prompt/index.ts`
- `packages/ui/src/composables/prompt/useEvaluation.ts`
- `packages/ui/src/composables/prompt/useEvaluationHandler.ts`
- `packages/ui/src/i18n/locales/en-US.ts`
- `packages/ui/src/i18n/locales/zh-CN.ts`
- `packages/ui/src/i18n/locales/zh-TW.ts`

### 新增（??）
- `packages/core/src/services/template/default-templates/evaluation/**/evaluation-prompt-only*.ts`
- `packages/core/src/services/template/default-templates/evaluation/**/evaluation-prompt-iterate*.ts`
- `packages/core/tests/unit/evaluation/service.test.ts`
- `packages/ui/src/composables/prompt/useEvaluationContext.ts`
- `packages/ui/src/composables/prompt/useProContext.ts`

---

## 8. 修复状态（2025-12-20 更新）

### ✅ P0-1：handleReEvaluate 支持新类型（已修复）

**修复内容**
- 在 `useEvaluationHandler.ts` 的 `handleEvaluate()` 中添加了对 `prompt-only` 和 `prompt-iterate` 类型的处理分支
- 在 `UseEvaluationHandlerOptions` 中新增 `currentIterateRequirement` 可选参数，用于 `prompt-iterate` 类型的重新评估
- 在 `PromptOptimizerApp.vue` 中计算 `currentIterateRequirement`（从当前版本的 `iterationNote` 获取）并传递给 evaluationHandler

**涉及文件**
- `packages/ui/src/composables/prompt/useEvaluationHandler.ts`
- `packages/ui/src/components/app-layout/PromptOptimizerApp.vue`

---

### ✅ P0-2：proContext 注入机制与死代码清理（已修复）

**修复方案**
选择了"上下文直连"路径：通过 `provide/inject` 共享 `proContext`，而非事件驱动。

**修复内容**
1. 新增 `useProContext.ts`，提供 `provideProContext()` 和 `useProContextOptional()` 方法
2. 在 `ContextSystemWorkspace.vue` 和 `ContextUserWorkspace.vue` 中调用 `provideProContext(proContext)`
3. 在 `PromptPanel.vue` 中调用 `useProContextOptional()` 获取 proContext，并在评估调用时传入
4. 移除了 workspace 中的 `@analyze` 监听和 `handleAnalyze` 函数（死代码清理）
5. 将 `@analyze` 替换为 `@apply-improvement`（用于应用改进建议）

**涉及文件**
- `packages/ui/src/composables/prompt/useProContext.ts`（新增）
- `packages/ui/src/composables/prompt/index.ts`
- `packages/ui/src/components/PromptPanel.vue`
- `packages/ui/src/components/context-mode/ContextSystemWorkspace.vue`
- `packages/ui/src/components/context-mode/ContextUserWorkspace.vue`

---

### ✅ P0-3：内容变更清除评估结果（已修复）

**修复内容**
- 在 `PromptPanel.vue` 中新增 watch，监听 `optimizedPrompt` 和 `currentVersionId` 的变化
- 当内容或版本变化时，自动清除 `prompt-only` 和 `prompt-iterate` 评估结果
- 避免切换版本/消息后旧分数残留的问题

**涉及文件**
- `packages/ui/src/components/PromptPanel.vue`

---

### 📋 P1-1：isOptimizedBetter 字段语义（设计决策）

**决策**
保持当前行为，作为已知的设计取舍：
- `prompt-only` 和 `prompt-iterate` 模板中仍输出 `isOptimizedBetter` 字段
- 服务端 `normalizeEvaluationResponse()` 仅在 `compare` 类型时保留该字段
- 前端不消费新类型的 `isOptimizedBetter`

**理由**
- 新类型的语义是"评估单个提示词质量"，`isOptimizedBetter` 字段在此场景下意义有限
- 模板中保留该字段可作为 LLM 输出的校验锚点，不影响功能正确性
- 若后续需要展示，可在服务端和前端同步扩展

---

### 📋 P1-2：错误文案语言（设计决策）

**决策**
保持 Core 层错误使用英文，在 UI 层进行本地化映射（未来改进方向）：
- 当前 Core 层的校验/解析错误使用英文，便于日志分析和问题定位
- UI 层通过 `getErrorMessage(error)` 透传，中文界面下可能显示英文错误
- 这是一个可接受的临时状态，不影响核心功能

**未来改进方向**
- 在 UI 层实现"错误码 → i18n key"的映射机制
- 根据错误类型或错误码选择对应的本地化文案
- 保持 Core 层错误信息稳定，避免因文案变更导致测试频繁修改

---

### ✅ P2：PromptPanel emit 声明清理（随 P0-2 一并解决）

- 移除了 workspace 中的 `@analyze` 监听
- `PromptPanel` 对外只保留必要事件：`iterate`、`switchVersion`、`save-favorite`、`apply-improvement` 等
- 评估相关逻辑通过 `provide/inject` 内部处理，无需对外暴露

## 9. 现存问题与建议（给后续 AI 的处理指南）

本节聚焦"截至当前代码状态仍存在的问题"（以代码为准），用于指导后续 AI 做收敛与修复。

### ✅ P0：Context 模式存在"双套 evaluation 实例 + 双面板"（已修复）

**原始问题**
- App 顶层已提供全局评估上下文，但 ContextSystem/ContextUser 两个 Workspace 各自创建独立 `evaluationHandler` 并渲染本地 `EvaluationPanel`，导致状态不同步。

**修复方案**（已实施）
采纳了"全局一套 evaluation + 顶层唯一 EvaluationPanel"方案：

1. **修改 `useEvaluationHandler.ts`**：新增 `externalEvaluation` 可选参数（第 57 行、第 183-188 行），允许传入外部 evaluation 实例
2. **移除 Workspace 内的 `<EvaluationPanel>`**：
   - `ContextSystemWorkspace.vue:212` - 仅保留注释说明
   - `ContextUserWorkspace.vue:247` - 仅保留注释说明
3. **Workspace 使用全局 evaluation**：
   - `ContextSystemWorkspace.vue:417` - `const globalEvaluation = useEvaluationContext()`
   - `ContextSystemWorkspace.vue:446` - `externalEvaluation: globalEvaluation`
   - `ContextUserWorkspace.vue:523` - `const globalEvaluation = useEvaluationContext()`
   - `ContextUserWorkspace.vue:552` - `externalEvaluation: globalEvaluation`

**验证方式**
- 在 context-mode 目录搜索 `<EvaluationPanel` 应无匹配
- 搜索 `externalEvaluation` 应能找到两个 Workspace 的使用

---

### ✅ P1：Context Workspaces 的 `prompt-iterate` re-evaluate 缺少 `iterateRequirement`（已修复）

**原始问题**
- Workspace 内部的 `useEvaluationHandler()` 未传 `currentIterateRequirement`，可能导致 `prompt-iterate` 的 re-evaluate 校验失败。

**修复方案**（已实施）
- 在两个 Workspace 中新增 `currentIterateRequirement` 计算属性：
  - `ContextSystemWorkspace.vue:425-432` - 从 `displayAdapter.displayedVersions / displayedCurrentVersionId` 获取（确保与 UI“当前显示版本”一致）
  - `ContextUserWorkspace.vue:531-538` - 从 `contextUserOptimization.currentVersions` 获取
- 将其传入 `useEvaluationHandler`：
  - `ContextSystemWorkspace.vue:445` - `currentIterateRequirement,`
  - `ContextUserWorkspace.vue:551` - `currentIterateRequirement,`

---

### ✅ P1：应用改进建议仅负责“打开迭代弹窗 + 预填文本”，不依赖预选模板（已修复）

**背景/场景**
- 用户在评估详情点击“应用改进建议”，预期行为是：直接打开迭代弹窗，并把建议文本放进输入框；模板在弹窗内再选择（不同模式可选模板不同）。

**修复方案**（已实施）
- `PromptPanel.vue` 的迭代弹窗内已包含 `TemplateSelect`（可在弹窗内选择模板）。
- `PromptPanel.vue` 的 `handleIterate()` 不再要求 `selectedIterateTemplate` 已预选；直接打开弹窗。
- `PromptPanel.vue` 暴露 `openIterateDialog(input?)`：用于“应用改进建议”路径预填充输入并打开弹窗。

**验证方式**
- 不预选迭代模板，点击“继续优化”按钮：应能打开迭代弹窗并在弹窗内选择模板。
- 从评估详情点击“应用改进建议”：应打开迭代弹窗并预填建议文本；未选择模板时点击确认应提示“请先选择迭代提示词”（允许）。

---

### ✅ P1：模式/子模式切换时关闭并清理评估状态（已修复）

**背景/场景**
- “评估”永远针对当前显示内容；当切换功能模式（basic/pro/image）或切换子模式（system/user 等）时，旧的评估详情和分数不应残留。

**修复方案**（已实施）
- `PromptOptimizerApp.vue` 在以下入口统一执行：
  - `evaluation.closePanel()`（关闭详情面板）
  - `evaluation.clearAllResults()`（清空所有评估结果）
- 覆盖：
  - 功能模式切换 `handleModeSelect(...)`
  - Context 子模式切换 watch（`contextManagement.contextMode`）
  - 子模式切换处理器：`handleBasicSubModeChange(...)` / `handleProSubModeChange(...)` / `handleImageSubModeChange(...)`

**验证方式**
- 任意模式下完成评估后切换模式/子模式：评估面板应关闭，评分徽章/详情应清空。

---

### 📋 P2：已知取舍（非阻塞，列入优化 backlog）

- **`isOptimizedBetter` 在 prompt-only/prompt-iterate 中不落库**：模板要求输出该字段但服务端只在 compare 保留；建议要么删模板字段节省 token，要么扩展服务与 UI 一致消费（`packages/core/src/services/evaluation/service.ts:468`）。
- **错误文案语言不统一**：Core 报错英文，UI 透传英文；后续可引入"错误类型/错误码 → i18n key"的映射（`packages/core/src/services/evaluation/service.ts:159`、`packages/ui/src/composables/prompt/useEvaluation.ts:410`）。

---

### ✅ P0：全局 EvaluationPanel 在 Context 模式下的 re-evaluate / apply-improvement 逻辑仍可能不正确（已修复）

> 该问题是"全局面板事件处理器绑定到基础模式数据源"导致的模式耦合。尽管 Context Workspace 已通过 `externalEvaluation` 复用了全局 evaluation，并移除了本地面板，但 App 顶层面板的交互仍需要进一步解耦。

**代码事实**
- App 顶层唯一 `EvaluationPanel` 的 `@re-evaluate` 绑定到 `handleReEvaluate`（`packages/ui/src/components/app-layout/PromptOptimizerApp.vue:583`），其实现来自 App 内部的 `evaluationHandler.handleReEvaluate()`，而该 handler 使用的数据源是 `optimizer.prompt/optimizer.optimizedPrompt/testResults`（即基础模式优化器与测试结果）。
- 在 Context 模式中，评估请求通常由 `PromptPanel` 直接使用 inject 到的全局 `evaluation` 发起，内容来源是 Context Workspace 传入的 `originalPrompt/optimizedPrompt` props（`packages/ui/src/components/PromptPanel.vue:489`）。
- 因此，当用户在 Context 模式下打开评估详情并点击"重新评估"，可能会用基础模式的数据重新评估，覆盖 Context 的评估结果。

**修复方案**（已实施）

本次采用“方案 B：Provider（数据源提供者）路由”，核心原则是：
- **重新评估使用最新状态**（当前工作区/当前内容），不保存/重放 lastRequest。
- 全局 `EvaluationPanel` 只做 UI，不再绑定到基础模式数据源；其事件路由到“当前活跃 Workspace”执行。

1. **`useEvaluationHandler.ts` 调整 handleReEvaluate 语义**：
   - 改为始终使用当前业务状态重新组装请求并执行一次评估（不依赖 lastRequest）。

2. **Context Workspaces 暴露 Provider 能力（defineExpose）**：
   - `reEvaluateActive()`：内部调用 `evaluationHandler.handleReEvaluate()`，使用当前 Workspace 的数据源（original/optimized/proContext/iterateRequirement 等）重新评估。
   - `openIterateDialog()`：内部转发到 `PromptPanel` 的 `openIterateDialog`，用于应用改进建议时打开迭代弹窗。

3. **`PromptOptimizerApp.vue` 全局面板事件路由**：
   - `@re-evaluate`：根据 `functionMode/contextMode` 选择 `systemWorkspaceRef/userWorkspaceRef`（Context）或使用基础模式 handler，调用对应 provider 的 `reEvaluateActive()`。
   - `@apply-improvement`：在 Context 模式下调用对应 Workspace 的 `openIterateDialog(improvement)`；基础模式继续走 `basicModeWorkspaceRef`。

**验证方式**
- Context 模式下执行评估后，在全局 `EvaluationPanel` 点击“重新评估”，应重新评估当前选中消息/当前变量提示词（而非基础模式 optimizer 的数据）。
- Context 模式下在全局 `EvaluationPanel` 点击“应用改进”，应打开当前 Workspace 的迭代弹窗并预填改进建议。

---

### ✅ P2：EvaluationPanel 标题未覆盖新类型（已修复）

**原始问题**
- `EvaluationPanel.vue` 标题 switch 只覆盖 `original/optimized/compare`，`prompt-only/prompt-iterate` 会落到 `evaluation.title.default`（`packages/ui/src/components/evaluation/EvaluationPanel.vue:185`）。

**修复方案**（已实施）

1. **`EvaluationPanel.vue` 添加新类型的 case**（第 188-191 行）：
   ```typescript
   case 'prompt-only':
     return t('evaluation.title.promptOnly')
   case 'prompt-iterate':
     return t('evaluation.title.promptIterate')
   ```

2. **添加 i18n 标题**：
   - `zh-CN.ts` - `promptOnly: "提示词质量分析"`, `promptIterate: "迭代优化分析"`
   - `en-US.ts` - `promptOnly: "Prompt Quality Analysis"`, `promptIterate: "Iteration Optimization Analysis"`
   - `zh-TW.ts` - `promptOnly: "提示詞品質分析"`, `promptIterate: "迭代優化分析"`

## 10. 使用与设计说明（面向后续维护）

### 10.1 “基础模式（basic）”怎么用（与评估关联）

典型流程（单提示词优化）：
1) 输入 `originalPrompt`（原始提示词）  
2) 点击“优化”得到 `optimizedPrompt`（当前显示版本）  
3) （可选）在测试区运行测试得到 `testResult`（用于 original/optimized/compare 三类评估）  
4) 点击“分析”执行 `prompt-only` 或 `prompt-iterate`（不依赖测试结果）  
5) 在评估详情中点击“重新评估”会对“当前显示的内容 + 当前模式参数”再评估一次

这里的关键约束：**`originalPrompt` 在产品定义中始终存在**（用于对齐原始需求，避免意图偏离），因此 Core 层校验 `originalPrompt` 不能为空是合理的，不需要为所谓“仅提示词独立评估”放宽。

### 10.2 为什么 Context 模式的 Context 不一样

Context 模式（pro）本质上不是“单提示词”，而是“带上下文的目标对象”：
- **Pro-System**：目标是对话中的某条 message（system/user/assistant/tool），`proContext` 会携带“目标 message + 全对话消息列表”，便于模型理解上下文语义。
- **Pro-User**：目标是“带变量的提示词”，`proContext` 会携带变量解析信息（raw/resolved/variables），便于评估时知道占位符如何被填充。

因此：
- 同一个 `EvaluationType`（比如 `prompt-only`）在不同子模式下“模板与上下文输入”可能不同；
- 但服务端输出仍应通过 `EvaluationResponse` 规范化，保持 UI 展示一致（分数/建议/原因等）。

### 10.3 重新评估（re-evaluate）为什么只需要“当前状态”，不需要 lastRequest

“重新评估”的产品语义是：**再执行一次评估**，且评估对象永远是“当前 UI 正在展示的版本”。

因此实现上只需要两类信息：
- “要评估哪种类型”：来自当前打开的详情类型 `evaluation.state.activeDetailType`
- “要评估的输入数据”：来自当前业务状态（当前 prompt / 当前版本 / 当前 proContext / 当前 iterateRequirement 等）

之前的 `lastRequest` 方案容易引入“旧状态回放”与跨模式污染；当前实现已移除 `lastRequest`，并把 re-evaluate 变成“以当前状态重建请求并执行”，更符合产品定义。

### 10.4 全局评估面板的设计取舍：方案 B（Provider 路由） vs 每个模式自带面板

本次已落地的是 **方案 B：全局唯一 `EvaluationPanel` + Provider 路由**：
- 优点：UI 一致、状态唯一（避免双套 evaluation）、跨组件更易共享（`provide/inject`）。
- 风险：顶层需要知道“当前活跃 workspace”，并在能力缺失时按“异常 bug”处理（避免 silently fallback 用错数据源）。

备选方案（回退）：每个模式各自渲染一个 `EvaluationPanel`。
- 优点：数据源天然就近，路由简单。
- 缺点：容易出现“双面板/双状态”，并带来更多模式分支与同步问题。

当前结论：在现有 UI 架构下，**优先保持方案 B**；若未来 Provider 接口进一步膨胀或难以维护，再考虑回退为“各模式自带面板”，但需要严格避免重复 evaluation 实例。
