# 架构迁移指导：统一 Session Store 与 Workspace 架构（2025-01-08）

> 本文整合：
> - `docs/workspace/session-store-testresults-bug-fix-2025-01-08.md`（Bug 修复记录）
> - `docs/workspace/workspace-architecture-comparison-2025-01-08.md`（架构对比分析）
>
> 目标：给出**可执行、可回滚、分阶段**的迁移路线图，最终统一到 **方案 C：Store + Operations**。
> 注意：本文仅做方案设计与路线图，不执行具体迁移。

---

## 0. 执行摘要（Executive Summary）

- **P0 Bug 根因**：Basic 模式组件在 `<script setup>` 中访问 `ComputedRef` 时遗漏 `.value`（例如 `logic.testResults?.originalResult`），导致派生布尔值恒为 `false`，测试完成后 UI 回退到“暂无内容”。同时存在 computed getter 返回临时对象的隐患（破坏依赖追踪）。
- **短期策略（1–2 周）**：建立团队规则与护栏（lint/tsc/测试），并以“降低 `.value` 遗漏概率”为第一目标，避免再出现同类 P0。
- **中期策略（2–5 周）**：以 Basic 模式为试点，引入 **Operations 层**（副作用/流程逻辑），让组件**直接消费 Pinia Store（单一真源）**，减少“Logic 层再包装一层 ref/computed”。
- **长期策略（1–2 月）**：三种模式统一到 **Store + Operations**；删除废弃 Logic 层；优化流式 token 更新的性能路径。

---

## 1. 问题发现与根因分析（来自文档 1）

### 1.1 症状与复现
- Basic 模式测试执行时：流式阶段可见内容；测试完成后结果区域回到“暂无内容”。
- Session Store 的 `testResults` 数据实际存在，但 UI 不显示。

复现（示例）：
1) 访问 `/#/basic/system`  
2) 生成优化提示词  
3) 点击“测试”  
4) 流式阶段显示；完成后消失

### 1.2 排查结论
1) **“数据被清空”不是主因**：store 中 `testResults` 值正确。
2) **computed 返回临时对象是隐患**：当 `testResults` 为 `null` 时返回新对象，会破坏依赖追踪（尤其在引用比较/缓存/派生计算中）。
3) **真正根因（触发 P0）**：组件在 `<script setup>` 内把 `ComputedRef` 当成普通对象访问，遗漏 `.value`：

```ts
// 错误：logic.testResults 是 ComputedRef<TestResults | null>
const hasOriginalResult = computed(() => !!logic.testResults?.originalResult)

// 正确
const hasOriginalResult = computed(() => !!logic.testResults.value?.originalResult)
```

### 1.3 经验教训（可迁移的规则）
- `<template>` 中 ref 会自动解包；但在 `<script setup>` 的 JS 表达式中，**ref/computed 仍需 `.value`（或 `unref()`/`toValue()`）**。
- “对象属性里的 ref/computed”非常容易被误当作普通值使用。
- TypeScript 并不总能拦住这类错误（常见原因：`any`/宽泛类型、推断丢失、间接层返回类型不透明）。

---

## 2. 三种模式架构对比（来自文档 2）

### 2.1 Basic 模式（Store → Logic → Component）
```
Component (BasicSystem/UserWorkspace)
  ↓
useBasicWorkspaceLogic（状态代理 + 过程态 + 业务逻辑）
  ↓
Pinia Session Store（持久化字段，单一真源）
```

特点：
- 优点：system/user 复用；逻辑集中。
- 缺点：Logic 层返回“对象属性中的 ComputedRef/Ref”，组件易漏 `.value`；可能引入双向 computed 与隐性写入链。

### 2.2 Context 模式（Tester composable → Component）
```
Component (Context workspace)
  ↓
Tester composable（reactive 状态树 + 流程逻辑）
  ↓
（部分）Session/Preference 持久化
```

特点：
- 优点：reactive 状态树消费体验好；流式/过程态组织方便。
- 缺点：容易“再长成一个 store”；与 Basic/Image 风格不统一。

### 2.3 Image 模式（Store 直连 → Component）
```
Component (Image workspace)
  ↓
Pinia Session Store（state 包装，或可迁移到 ref 拆分）
```

特点：
- 优点：Pinia store proxy 访问体验好；单一真源清晰；最接近 Pinia 推荐范式。
- 缺点：业务操作若不抽离，组件会膨胀（可通过 Operations 解决）。

---

## 3. 统一方案评估（综合两个文档）

> 统一目标：减少“脚本里 `.value` 漏写”这类高概率事故；让数据流更接近 Vue 3/Pinia 官方推荐的**单向数据流**与**单一真源**。

### 3.1 方案 A：快速止血（toRefs/解包技巧）
核心思路：在 Logic 层将“对象属性中的 ref/computed”扁平化，降低漏 `.value` 的概率。

优点：
- 改动小、见效快；适合 1–2 周的止血窗口。

缺点：
- 本质是“语法层规避”，不解决“间接层膨胀/双向 computed/边界不清”的结构性问题。
- 仍可能出现脚本里派生 computed 访问遗漏 `.value`。

适用结论：**短期可用，但不作为最终形态**。

### 3.2 方案 B：保留 Logic，但返回更安全的 ViewModel
核心思路：把 `hasOriginalResult` 等派生值放回 composable 内，组件尽量不要在脚本里再“二次派生”复杂 ref 树。

优点：
- 改动成本中等；复用价值保留；能显著降低踩坑概率。

缺点：
- 仍保留一层自定义 ViewModel API；长期可能继续膨胀。

适用结论：**作为中期过渡方案可接受**。

### 3.3 方案 C：Store + Operations（长期推荐）
核心思路：
- **Store**：只管理状态与最小同步动作（单一真源，可持久化字段）
- **Operations composable**：只负责异步流程/副作用（测试、优化、迭代、历史加载），通过 store actions 写入状态
- **Component**：直接消费 store（必要时 `storeToRefs`），少量 UI 派生 computed

优点：
- 符合 Vue 3/Pinia 推荐：单向数据流、职责清晰、可测试性强、长期维护成本最低。
- 最大限度避免“Logic 层返回对象里塞 ref/computed”的不确定性。

缺点：
- 初期迁移成本与协调成本更高，需要路线图与护栏。

适用结论：**最终目标方案**。

---

## 4. 长期目标：方案 C（Store + Operations）的完整设计

### 4.1 目标架构图（目标态）

```
┌──────────────────────────────────────────────────────┐
│ Component (Workspace)                                │
│  - 直接消费 Pinia store（必要时 storeToRefs）         │
│  - 少量 UI 派生 computed（或抽到 derived composable） │
│  - 触发 ops.handle*                                  │
└──────────────────────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────┐
│ Operations composable（副作用/流程）                  │
│  - handleOptimize / handleIterate / handleTest        │
│  - 负责调用 service、处理流式 token、异常与 toast     │
│  - 通过 store actions 写入状态                        │
└──────────────────────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────┐
│ Pinia Session Store（单一真源 + 持久化字段）           │
│  - state: prompt/optimizedPrompt/testResults/...       │
│  - actions: updatePrompt/updateTestResults/...         │
│  - saveSession/restoreSession（PreferenceService）     │
└──────────────────────────────────────────────────────┘
```

### 4.2 责任边界（强约束）
- Store 不做：网络调用、复杂流程编排、UI toast、token 拼接策略选择。
- Operations 不做：持久化实现细节（除非调用 store.saveSession）、跨模式路由选择。
- Component 不做：长流程编排（除了 orchestrate 级别的组合），避免堆积业务逻辑。

### 4.3 组件消费规则（必须执行）
1) **优先直接访问 Pinia store proxy 属性**（避免解构导致响应性丢失）。
2) 需要解构时：
   - store：只用 `storeToRefs(store)`
   - 普通 composable 返回：返回 ref 本身，消费侧用 `unref()`/`.value`
3) `<script setup>` 中写派生时：
   - 推荐：`computed(() => !!unref(testResults)?.originalResult)`
   - 或显式：`testResults.value?.originalResult`
4) 禁止：computed getter 返回“临时默认对象”来伪装非空；应返回 `null`，由 UI 做 fallback。
5) 禁止：同一字段存在两条写入链（`watch` 同步 + computed setter 同步）。

### 4.4 Operations API 设计建议（Basic 例）
> 仅定义接口/职责，不落地具体实现细节（由 Phase 2 执行）。

```ts
export interface UseBasicWorkspaceOperationsOptions {
  services: Ref<AppServices | null>
  sessionStore: BasicSessionStore
  optimizationMode: 'system' | 'user'
  promptRecordType: PromptRecordType
}

export function useBasicWorkspaceOperations(options: UseBasicWorkspaceOperationsOptions) {
  // 过程态（可返回给组件）
  const isOptimizing = ref(false)
  const isTestingOriginal = ref(false)
  const isTestingOptimized = ref(false)

  // actions（返回给组件绑定按钮事件）
  const handleOptimize = async () => {}
  const handleIterate = async (_payload: IteratePayload) => {}
  const handleTest = async (_testVariables?: Record<string, string>) => {}

  return {
    isOptimizing,
    isTestingOriginal,
    isTestingOptimized,
    handleOptimize,
    handleIterate,
    handleTest
  }
}
```

---

## 5. 分阶段迁移路线图（近期 → 中期 → 长期）

> 时间为预估（以 1 个小团队为参照）；每阶段都必须具备可回滚策略。

### Phase 1：基础设施准备（1–2 周）

**目标与产出**
- 统一“组件消费规则”与编码规范（写入文档 + code review checklist）。
- 建立护栏：`vue-tsc`、ESLint 规则、关键路径测试用例。
- 提供可复用的 composable 模板/示例（Operations 模板、derived 模板）。
- 产出迁移 checklist（Phase 2–5 使用）。

**具体步骤（不执行迁移，仅准备）**
1) 新增规范文档：组件消费规则、禁止模式、推荐模式。
2) ESLint 规则建议（按现有 ESLint 体系适配）：
   - 强制：禁止直接解构 store（要求 `storeToRefs`）
   - 强制：禁止 computed getter 返回临时对象（代码评审 + 规则/约定）
   - 建议：增加对 `any`/宽泛类型的限制（减少 TS “漏网”）
3) CI/本地脚本：将 `pnpm -F @prompt-optimizer/ui test`、`pnpm -F @prompt-optimizer/ui build`、`pnpm -F @prompt-optimizer/web build` 纳入关键检查。
4) 模板与示例：
   - `useXxxOperations` 模板（异步流程/副作用）
   - `useXxxDerived` 模板（派生状态聚合，可选）
5) 迁移 checklist 草案（见 §6）。

**风险点**
- 护栏过严导致迁移期阻塞：建议先“warning → error”渐进式。
- ESLint/tsc 配置差异：需要与现有工具链兼容。

**验收标准**
- 团队共识文档落地（可评审）。
- 关键命令在本地与 CI 可稳定运行。
- 提供可复制的 Operations 示例（至少覆盖 Basic 测试/优化其中一个流程的接口设计）。

**回滚策略**
- Phase 1 仅新增文档与工具配置；如引入阻塞，可降级为 warning 或局部关闭规则。

**时间预估**
- 3–5 个工作日（视工具链调整复杂度）。

---

### Phase 2：Basic 模式迁移（2–3 周）

**目标与产出**
- Basic 模式从“Store → Logic → Component”迁移到“Store + Operations”。
- 清晰拆分：状态（store）与流程（operations）。
- 消灭“Logic 层返回对象属性 ComputedRef”导致的脚本消费陷阱。

**设计要点**
1) Store 结构
   - 现有 Basic store 已迁移为“独立 ref”形态（无需强制再改结构）。
   - 只在确有必要时调整：例如为 token streaming 增加更细粒度 action（`appendOriginalToken` 等）。
2) Operations 接口
   - `useBasicWorkspaceOperations({ services, sessionStore, optimizationMode, promptRecordType })`
   - 过程态由 operations 管理（`isTestingOriginal` 等），可返回给组件。
3) 组件层
   - 组件直接使用 store proxy 或 `storeToRefs`，避免中间层包装。
   - UI 派生 computed 要么直接基于 store，要么抽到 `useBasicWorkspaceDerived`（可选）。

**迁移步骤（不执行，仅说明）**
1) 新增 `useBasicWorkspaceOperations.ts`（与旧 `useBasicWorkspaceLogic.ts` 并存）。
2) 在 BasicSystem/UserWorkspace：
   - 将按钮事件从 `logic.handle*` 切换为 `ops.handle*`（可通过 feature flag 或分支切换）。
   - 状态读取从 `logic.xxx` 切换为 `session.xxx`（必要时 `storeToRefs(session)`）。
3) 双跑验证：保留旧逻辑路径以便回滚。
4) 完成后：收敛/删除 `useBasicWorkspaceLogic.ts` 或仅保留为薄适配层（Phase 5 删除）。

**回滚方案**
- 保留旧 `useBasicWorkspaceLogic` 入口与组件绑定方式；若出现回归，切回旧入口（feature flag / revert commit）。

**验收标准（必须可量化）**
- 手工验收：`/#/basic/system` 与 `/#/basic/user`
  - 测试：流式显示 + 完成后结果不消失
  - 刷新后 restore 正常（若该模式要求持久化）
  - 模式切换不互相污染（单一真源）
- 自动化：
  - `pnpm -F @prompt-optimizer/ui test` 通过
  - `pnpm -F @prompt-optimizer/ui build` 通过
  - 新增/更新至少 1 个覆盖“测试结果展示”的单元测试（防回归）

**风险点**
- 同字段双写（watch + action）导致覆盖：需要迁移时明确“唯一写入路径”。
- token 更新频率高：需避免不必要的深 watcher 或大量对象拷贝（Phase 5 处理）。

**时间预估**
- 8–12 个工作日（含回归验证与测试补齐）。

---

### Phase 3：Context 模式迁移（1–2 周）

**目标与产出**
- 将 Context 模式从“Tester reactive 状态树”为主的形态，对齐到“Store + Operations”。
- 保留 Tester composable 的优势（过程态组织/流式处理），但明确其边界：它应成为 Operations/内部实现，而不是第二套 store。

**特殊考虑（reactive 状态树）**
- reactive 状态树适合过程态与临时态，但持久化字段应落到 store（单一真源）。
- 将 Tester 的“最终结果写入”统一通过 store action 完成，避免状态分裂。

**整合方案建议**
1) 将现有 Tester composable 拆分：
   - `useContextWorkspaceOperations`：对外暴露 handleTest/handleOptimize 等
   - `useConversationTester`（内部实现，可保留 reactive 状态树）
2) 组件直接消费 Context session store（必要时 `storeToRefs`）。
3) 将“派生状态（hasOriginalResult 等）”统一定义：
   - 要么在组件 computed（基于 store）
   - 要么抽出 derived composable（供多组件复用）

**回滚策略**
- 保留原 Tester 入口；逐页面/逐功能开关迁移（A/B 对照）。

**验收标准**
- Context 模式关键流程（优化/测试/评估/持久化）通过回归用例。
- 不出现 store 与 reactive 树“互相覆盖/不同步”。

**时间预估**
- 5–8 个工作日。

---

### Phase 4：Image 模式对齐（1 周）

**目标与产出**
- Image 模式已接近“Store 直连”，主要工作是对齐 Operations 规范与命名，形成统一开发体验。
- 保留独立 composables（如 `useImageGeneration` 等）作为 operations 的内部实现或依赖。

**对齐步骤（不执行，仅说明）**
1) 引入 `useImageWorkspaceOperations`（统一 handleGenerate/handleIterate/handleTest 等命名风格）。
2) 组件消费统一：store（状态）+ ops（流程）。
3) 明确哪些字段持久化、哪些是过程态（避免把临时态写入 session）。

**验收标准**
- Image 两个子模式（text2image/image2image）行为一致；模式切换不互相污染。
- 构建与测试通过。

**时间预估**
- 3–5 个工作日。

---

### Phase 5：清理和优化（1 周）

**目标与产出**
- 删除废弃 Logic 层与过时同步 watch。
- 清理双向 computed，收敛写入路径。
- 性能优化：流式 token 写入减少对象分配与深层 watch 成本。

**清理项**
- 删除/替换：`useBasicWorkspaceLogic.ts`（或降级为薄适配层后再移除）。
- 删除：仅为旧架构存在的同步 watch（避免双写）。
- 文档更新：将“最终最佳实践”写入团队规范与 README/开发指南。

**性能优化建议（token streaming）**
- 优先在 store 内提供更细粒度 action：
  - `appendOriginalResultToken(token)` / `appendOptimizedResultToken(token)`
  - 减少 `testResults = { ...testResults, field: field + token }` 的对象拷贝
- 避免不必要的 `deep: true` watch（能用显式 action 则不用 watch）。

**验收标准**
- 不存在“旧 Logic 层仍被引用”的死代码。
- 性能指标：长文本流式测试时 UI 卡顿明显降低（主观 + 简易性能采样）。
- 关键命令通过：build/test。

**回滚策略**
- 清理阶段建议“分 PR”执行，确保每步可 revert；避免大范围一次性删除。

**时间预估**
- 3–5 个工作日。

---

## 6. 迁移 Checklist（建议模板）

> 每迁移一个 workspace/模式，按此 checklist 执行。

**设计检查**
- [ ] store 是否为单一真源（持久化字段不分叉）？
- [ ] 是否存在双写链（watch + action / computed setter + action）？
- [ ] 是否存在 computed getter 返回临时对象？
- [ ] Operations 是否只负责流程、副作用，不直接持有持久化状态？

**组件消费检查**
- [ ] 是否直接消费 store proxy 或 `storeToRefs`？（禁止裸解构 store）
- [ ] `<script setup>` 内所有 ref/computed 是否通过 `.value`/`unref()` 访问？
- [ ] 派生状态是否尽量基于 store，而不是基于“对象属性里的 ref”？

**回归检查**
- [ ] 测试流式显示与完成后保持显示
- [ ] 刷新后 restore 行为正确（若该模式要求）
- [ ] 模式切换不污染
- [ ] `pnpm -F @prompt-optimizer/ui test` / `build` 通过

---

## 7. 附录

### 7.1 新旧架构对比图（简化）

**旧（高风险点：对象属性 ref）**
```
store → useBasicWorkspaceLogic (returns { testResults: ComputedRef }) → component
                                     ↑
                                容易漏 .value
```

**新（目标态）**
```
component → operations → store (single source of truth)
        ↘︎ (read)  ↗︎ (write)
```

### 7.2 组件消费规则速查表

| 场景 | 推荐写法 | 不推荐写法 | 原因 |
|---|---|---|---|
| 读取 store 字段 | `session.testResults` | `const { testResults } = session` | 裸解构会丢响应式 |
| 解构 store 字段 | `const { testResults } = storeToRefs(session)` | `const { testResults } = session` | Pinia 推荐 |
| 脚本里读取 Ref | `unref(testResults)?.x` / `testResults.value?.x` | `testResults?.x` | `<script setup>` 不会按你期望“自动解包对象属性 ref” |
| computed 默认值 | UI 层做 fallback | getter 返回新对象 | 临时对象破坏追踪/缓存 |

### 7.3 常见陷阱与解决方案
- **陷阱：ComputedRef 当对象访问** → 统一用 `unref()`/`.value`，或把派生值放到 composable 内返回。
- **陷阱：store 裸解构导致不更新** → 统一 `storeToRefs`。
- **陷阱：deep watch + 大对象频繁更新** → 用 store action 细粒度写入（append token）。
- **陷阱：双向 computed + watch 双写** → 确定唯一写入路径，删除多余同步。

### 7.4 参考资料
- Vue 3：Reactivity Fundamentals：https://vuejs.org/guide/essentials/reactivity-fundamentals.html
- Vue 3：Composables：https://vuejs.org/guide/reusability/composables.html
- Pinia：Core Concepts / storeToRefs：https://pinia.vuejs.org/core-concepts/

