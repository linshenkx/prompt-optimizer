# ContextUserWorkspace 独立性深度分析

## 📋 分析目标

检查 ContextUserWorkspace 的 composables 是否足够独立，是否有逻辑和其他模式的 composables 复用或在 App.vue 里面。

## 🔍 当前架构分析

### 1. ContextUserWorkspace 的依赖关系

**组件内部使用的 Composable**:
```typescript
import { useTemporaryVariables } from "../../composables/variable/useTemporaryVariables"

const tempVarsManager = useTemporaryVariables()
```

**通过 App.vue 依赖的逻辑**:
```typescript
// App.vue 中
const optimizer = usePromptOptimizer(...)      // ❌ 共享
const promptTester = usePromptTester(...)      // ❌ 共享

// ContextUserWorkspace 通过 props 和 events 使用
<ContextUserWorkspace
    :prompt="optimizer.prompt"                  // ❌ 依赖全局 optimizer
    :optimized-prompt="optimizer.optimizedPrompt"
    :is-optimizing="optimizer.isOptimizing"
    :is-iterating="optimizer.isIterating"
    :versions="optimizer.currentVersions"
    :current-version-id="optimizer.currentVersionId"
    @optimize="handleOptimizePrompt"            // ❌ 触发全局 optimizer
    @iterate="handleIteratePrompt"
    @test="handleTestAreaTest"                  // ❌ 使用全局 promptTester
/>
```

### 2. 基础模式的依赖关系

**基础模式同样依赖**:
```typescript
// App.vue 中
<template v-else-if="functionMode === 'basic'">
    <InputPanelUI v-model="optimizer.prompt" />     // ❌ 共享 optimizer
    <PromptPanelUI
        :optimized-prompt="optimizer.optimizedPrompt"
        :is-optimizing="optimizer.isOptimizing"
    />
    <TestAreaPanel @test="handleTestAreaTest" />    // ❌ 共享 promptTester
</template>
```

### 3. ContextSystemWorkspace 的独立性（对比）

**完全独立的逻辑**:
```typescript
// ContextSystemWorkspace.vue 内部
const conversationOptimization = useConversationOptimization(...)  // ✅ 独立
const conversationTester = useConversationTester(...)              // ✅ 独立

const handleOptimizeClick = () => {
    conversationOptimization.optimizeMessage()  // ✅ 内部处理
}

const handleTestWithVariables = async () => {
    await conversationTester.executeTest(...)   // ✅ 内部处理
}
```

---

## ⚠️ 发现的问题

### 问题 1: 不对称的架构设计 ❌

| 功能 | 基础模式 | ContextUser | ContextSystem |
|------|---------|------------|---------------|
| 优化逻辑 | App.vue (optimizer) | App.vue (optimizer) | 组件内部 (conversationOptimization) ✅ |
| 测试逻辑 | App.vue (promptTester) | App.vue (promptTester) | 组件内部 (conversationTester) ✅ |
| 状态管理 | App.vue | App.vue | 组件内部 ✅ |

**问题**: ContextSystem 有独立的 composables，而 ContextUser 和基础模式共享 App.vue 的逻辑。

---

### 问题 2: 基础模式和 ContextUser 复用逻辑 ❌

**共享的 Composables**:
```typescript
// App.vue
const optimizer = usePromptOptimizer(...)   // 基础模式 + ContextUser 共享
const promptTester = usePromptTester(...)   // 基础模式 + ContextUser 共享
```

**共享的处理函数**:
```typescript
// 基础模式和 context-user 模式的测试处理函数
const handleTestAreaTest = async (testVariables?: Record<string, string>) => {
    // 调用基础测试器（只用于基础模式和 context-user）
    await promptTester.executeTest(
        optimizer.prompt,
        optimizer.optimizedPrompt,
        testContent.value,
        isCompareMode.value,
        testVariables
    )
}
```

**问题**:
- ContextUser 没有自己独立的优化和测试逻辑
- 与基础模式共享相同的 composables
- 不符合"ContextUser 应该独立"的预期

---

### 问题 3: usePromptTester 的定位混淆 ❌

**usePromptTester 的文档描述**:
```typescript
/**
 * 基础模式提示词测试 Composable
 *
 * 专门处理基础模式的提示词测试，支持：
 * - System prompt 测试
 * - User prompt 测试
 * - 变量注入
 * - 对比模式（原始 vs 优化）
 */
```

**实际使用**:
- ✅ 基础模式使用（符合定位）
- ❌ ContextUser 模式也使用（不符合定位）

**问题**: usePromptTester 声称是"基础模式专用"，却被 ContextUser 复用。

---

## 🎯 应该的架构

### 理想的独立架构

```
App.vue
├── 基础模式 (Basic Mode)
│   ├── usePromptOptimizer (全局)
│   └── usePromptTester (全局)
│
├── ContextSystemWorkspace (独立) ✅
│   ├── useConversationOptimization
│   └── useConversationTester
│
└── ContextUserWorkspace (应该独立) ❌
    ├── useContextUserOptimization (新建，独立)
    └── useContextUserTester (新建，独立)
```

### 建议的改进方案

#### 方案 1: 创建独立的 ContextUser Composables ⭐⭐⭐⭐⭐

**新增 Composables**:
```typescript
// packages/ui/src/composables/prompt/useContextUserOptimization.ts
export function useContextUserOptimization(
    services: Ref<AppServices | null>,
    optimizationMode: Ref<OptimizationMode>,
    selectedOptimizeModel: Ref<string>,
    selectedTemplate: Ref<Template | null>,
    selectedIterateTemplate: Ref<Template | null>
) {
    // 专门用于 ContextUser 的优化逻辑
    // 独立管理 prompt、optimizedPrompt、versions 等状态
}

// packages/ui/src/composables/prompt/useContextUserTester.ts
export function useContextUserTester(
    services: Ref<AppServices | null>,
    selectedTestModel: Ref<string>,
    optimizationMode: Ref<OptimizationMode>,
    variableManager: VariableManagerHooks | null
) {
    // 专门用于 ContextUser 的测试逻辑
    // 独立管理测试状态和结果
}
```

**ContextUserWorkspace 内部使用**:
```typescript
// ContextUserWorkspace.vue
const contextUserOptimization = useContextUserOptimization(
    services,
    computed(() => props.optimizationMode),
    computed(() => props.selectedOptimizeModel),
    computed(() => props.selectedTemplate),
    computed(() => props.selectedIterateTemplate)
)

const contextUserTester = useContextUserTester(
    services,
    computed(() => props.selectedTestModel),
    computed(() => props.optimizationMode),
    variableManager
)

// 内部处理优化
const handleOptimize = () => {
    contextUserOptimization.optimize()
}

// 内部处理测试
const handleTest = async (testVariables: Record<string, string>) => {
    await contextUserTester.executeTest(
        contextUserOptimization.prompt.value,
        contextUserOptimization.optimizedPrompt.value,
        testContent.value,
        isCompareMode.value,
        testVariables
    )
}
```

**优点**:
- ✅ ContextUser 完全独立，与 System 对称
- ✅ 不再依赖 App.vue 的全局状态
- ✅ 职责清晰，易于维护
- ✅ 可以为 ContextUser 定制特殊功能

**缺点**:
- ⚠️ 需要新增 2 个 composables
- ⚠️ 需要重构 ContextUserWorkspace 的 props/events
- ⚠️ 基础模式仍然使用旧的 optimizer/promptTester（保持不变）

---

#### 方案 2: 保持现状，但重命名以明确职责 ⭐⭐⭐

**重命名 Composables**:
```typescript
// usePromptOptimizer → useBasicPromptOptimizer
// usePromptTester → useBasicPromptTester
```

**更新文档**:
```typescript
/**
 * 基础模式和 ContextUser 模式共享的提示词优化器
 *
 * 用于：
 * - 基础模式：单条提示词优化
 * - ContextUser 模式：单条用户消息优化
 *
 * 不用于：
 * - ContextSystem 模式（使用 useConversationOptimization）
 */
```

**优点**:
- ✅ 无需新增代码
- ✅ 明确了共享关系

**缺点**:
- ❌ 没有解决根本问题（ContextUser 不够独立）
- ❌ 基础模式和 ContextUser 仍然耦合

---

#### 方案 3: ContextUser 继承基础模式的逻辑 ⭐⭐

**思路**: 将 ContextUser 视为基础模式的扩展版本

**优点**:
- ✅ 符合当前架构
- ✅ 无需改动

**缺点**:
- ❌ ContextUser 失去独立性
- ❌ 与 ContextSystem 的独立性不对称

---

## 📊 各方案对比

| 方案 | 独立性 | 对称性 | 实现成本 | 维护性 | 推荐度 |
|------|--------|--------|---------|--------|--------|
| 方案 1: 独立 Composables | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 方案 2: 重命名明确 | ⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| 方案 3: 保持现状 | ⭐ | ⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐ |

---

## 🚀 推荐方案：方案 1

### 理由

1. **架构对称性**: 让 ContextUser 和 ContextSystem 都拥有独立的 composables
2. **职责清晰**: 每个模式有自己专属的逻辑，不混淆
3. **易于扩展**: 未来可以为 ContextUser 添加特殊功能
4. **符合预期**: 你期望的"相互独立"

### 命名规范

按照现有的命名模式：

| 模式 | 优化 Composable | 测试 Composable | 说明 |
|------|----------------|----------------|------|
| **ContextSystem** | `useConversationOptimization` | `useConversationTester` | 处理"会话"（Conversation） |
| **ContextUser** | `useContextUserOptimization` | `useContextUserTester` | 处理"用户上下文"（User Context） |
| 基础模式 | `usePromptOptimizer` | `usePromptTester` | 保持不变 |

**命名原则**:
- ✅ **ContextSystem** 处理"会话"（Conversation），所以用 `useConversation*`
- ✅ **ContextUser** 处理"用户上下文"（User Context），所以用 `useContextUser*`
- ✅ 基础模式保持原有命名
- ✅ 保持一致性和可读性

### 实施步骤

1. 创建 `useContextUserOptimization.ts`
2. 创建 `useContextUserTester.ts`
3. 重构 `ContextUserWorkspace.vue` 使用新的 composables
4. 更新 `App.vue` 中 ContextUser 相关的逻辑
5. 保持基础模式使用原有的 `usePromptOptimizer` 和 `usePromptTester`

---

## 📝 总结

### 当前状态

- ❌ **ContextUser 不够独立**，依赖 App.vue 的全局状态
- ❌ **与基础模式复用逻辑**，composables 混淆
- ❌ **架构不对称**，ContextSystem 独立但 ContextUser 不独立

### 理想状态

- ✅ **ContextUser 完全独立**，拥有自己的 composables
- ✅ **架构对称**，System 和 User 都独立于基础模式
- ✅ **职责清晰**，每个模式有明确的边界

### 建议

**强烈推荐实施方案 1**，创建独立的 ContextUser composables，实现真正的独立性和架构对称性。
