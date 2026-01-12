# 三种模式架构对比与统一方案

**日期**: 2025-01-08
**分支**: `hapi-var-extract`
**目标**: 对齐 Basic、Context、Image 三种模式的开发体验

---

## 📊 三种模式的架构差异

### 模式 1: Basic 模式（使用 Logic 层）

**架构图**:
```
┌─────────────────────────────────────────────────────────────┐
│              BasicSystemWorkspace.vue                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              useBasicWorkspaceLogic.ts                       │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 1. 状态代理（Session Store 的包装）                  │    │
│  │    const testResults = computed({                   │    │
│  │      get: () => sessionStore.testResults,           │    │
│  │      set: (value) => sessionStore.updateTestResults(value)│
│  │    })                                               │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │ 2. 过程态管理                                       │    │
│  │    const isOptimizing = ref(false)                  │    │
│  │    const isTestingOriginal = ref(false)             │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │ 3. 业务逻辑                                         │    │
│  │    const handleOptimize = async () => {...}         │    │
│  │    const handleTest = async () => {...}             │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  return {                                                    │
│    testResults,  // ComputedRef<TestResults | null>        │
│    isOptimizing,   // Ref<boolean>                         │
│    handleOptimize  // Function                              │
│  }                                                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              useBasicSystemSession.ts                        │
│            (Pinia Store - 持久化状态)                        │
└─────────────────────────────────────────────────────────────┘
```

**组件中使用**:
```typescript
<script setup>
const logic = useBasicWorkspaceLogic({
  sessionStore,
  services,
  optimizationMode: 'system'
})

// ❌ 问题：必须使用 .value 访问
const hasOriginalResult = computed(() =>
  !!logic.testResults.value?.originalResult
)

// ❌ 需要手动解包传递给子组件
const unwrappedLogicProps = computed(() => ({
  testResultsOriginalResult: logic.testResults.value?.originalResult || '',
  isOptimizing: logic.isOptimizing.value
}))
</script>

<template>
  <TestResultPanel
    :originalResult="unwrappedLogicProps.testResultsOriginalResult"
  />
</template>
```

**特点**:
- ✅ 代码复用：BasicSystem 和 BasicUser 共享 Logic 层
- ✅ 统一业务逻辑：优化、迭代、测试、版本管理
- ❌ 需要 `.value` 解包对象属性
- ❌ 双向 computed 违背单向数据流
- ❌ TypeScript 无法捕获 `.value` 缺失

---

### 模式 2: Context 模式（使用 Tester Composable）

**架构图**:
```
┌─────────────────────────────────────────────────────────────┐
│              ContextSystemWorkspace.vue                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              useConversationTester.ts                        │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ const state = reactive({                            │    │
│  │   testResults: {                                    │    │
│  │     originalResult: '',                             │    │
│  │     optimizedResult: '',                            │    │
│  │     isTestingOriginal: false,                       │    │
│  │     isTestingOptimized: false,                      │    │
│  │   },                                                │    │
│  │   executeTest: async (isCompareMode) => {...}       │    │
│  │ })                                                  │    │
│  │                                                      │    │
│  │ return state  // reactive 对象                       │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              useProMultiSession.ts                           │
│            (Pinia Store - 持久化状态)                        │
│                                                              │
│  ⚠️ 需要 watch 同步 Tester → Session Store                 │
│  watch(                                                     │
│    () => conversationTester.testResults,                   │
│    (stable) => {                                           │
│      session.updateTestResults(stable)                      │
│    }                                                        │
│  )                                                          │
└─────────────────────────────────────────────────────────────┘
```

**组件中使用**:
```typescript
<script setup>
const conversationTester = useConversationTester(
  services,
  modelSelection.selectedTestModelKey,
  optimizationContext,
  optimizationContextToolsRef,
  variableManager
)

// ✅ 无需 .value，reactive 自动解包
const hasOriginalResult = computed(() =>
  !!conversationTester.testResults.originalResult
)

// ✅ 直接传递给子组件
</script>

<template>
  <TestResultPanel
    :originalResult="conversationTester.testResults.originalResult"
    :isTesting="conversationTester.testResults.isTestingOriginal"
  />
</template>
```

**特点**:
- ✅ 无需 `.value`，reactive 自动解包
- ✅ 代码简洁清晰
- ✅ TypeScript 类型检查更准确
- ❌ 需要手动 watch 同步到 Session Store
- ❌ 状态管理分散在多个地方
- ❌ 数据流不清晰（Tester ↔️ Session 双向同步）

---

### 模式 3: Image 模式（直接使用 Store）

**架构图**:
```
┌─────────────────────────────────────────────────────────────┐
│              ImageText2ImageWorkspace.vue                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ├────────────────────────────────┐
                              ▼                                ▼
┌──────────────────────────┐  ┌──────────────────────────────┐
│  useImageText2ImageSession│  │  useImageGeneration          │
│    (Pinia Store)          │  │    (Composable)              │
│                          │  │                              │
│  - originalPrompt        │  │  - imageModels: Ref(...)     │
│  - optimizedPrompt       │  │  - generating: Ref(...)      │
│  - selectedModelKey      │  │  - generate: Function        │
│  - testResults           │  │                              │
└──────────────────────────┘  └──────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│  组件内定义 computed 双向绑定                                  │
│                                                              │
│  const originalPrompt = computed<string>({                   │
│    get: () => session.originalPrompt || '',                  │
│    set: (value) => session.updatePrompt(value || '')         │
│  })                                                          │
│                                                              │
│  const optimizedPrompt = computed<string>({                  │
│    get: () => session.optimizedPrompt || '',                 │
│    set: (value) => {                                         │
│      session.updateOptimizedResult({...})                    │
│    }                                                         │
│  })                                                          │
└─────────────────────────────────────────────────────────────┘
```

**组件中使用**:
```typescript
<script setup>
const session = useImageText2ImageSession()

// ❌ 组件内定义大量双向 computed
const originalPrompt = computed<string>({
  get: () => session.originalPrompt || '',
  set: (value) => session.updatePrompt(value || '')
})

const optimizedPrompt = computed<string>({
  get: () => session.optimizedPrompt || '',
  set: (value) => {
    session.updateOptimizedResult({
      optimizedPrompt: value || '',
      reasoning: session.reasoning || '',
      chainId: session.chainId || '',
      versionId: session.versionId || ''
    })
  }
})

const {
  imageModels,
  generating: isGenerating,
  result: imageResult,
  generate: generateImage
} = useImageGeneration()
</script>

<template>
  <PromptPanel
    v-model="originalPrompt"
    v-model:optimized="optimizedPrompt"
  />
</template>
```

**特点**:
- ✅ 直接使用 Store，数据流清晰
- ✅ 业务逻辑分离到专门 composables
- ❌ 组件内定义大量 computed 样板代码
- ❌ 双向 computed 违背单向数据流
- ❌ 复杂的更新逻辑（需要手动传递多个字段）

---

## 🔍 深度对比分析

### 维度 1: 状态管理

| 方面 | Basic 模式 | Context 模式 | Image 模式 |
|------|-----------|-------------|-----------|
| **持久化状态** | Session Store | Session Store | Session Store |
| **过程态** | Logic 层 ref | Tester reactive | 组件内 ref |
| **派生状态** | 组件内 computed | 组件内 computed | 组件内 computed |
| **状态同步** | Logic 代理 Store | watch 双向同步 | 直接访问 Store |

**问题**:
- ❌ 三种模式的状态管理策略完全不同
- ❌ Context 模式需要手动 watch 同步，容易出错
- ❌ Image 模式的复杂更新逻辑散落在组件内

---

### 维度 2: 数据流清晰度

| 方面 | Basic 模式 | Context 模式 | Image 模式 |
|------|-----------|-------------|-----------|
| **读取数据** | `logic.testResults.value` | `tester.testResults` | `session.xxx` |
| **更新数据** | `logic.testResults.value = ...` | `tester.testResults.xxx = ...` | `session.updateXxx()` |
| **数据流向** | 双向 computed | 双向（Tester ↔️ Store） | 双向 computed |

**问题**:
- ❌ 三种模式都使用了双向绑定，违背 Vue 3 单向数据流原则
- ❌ Context 模式的数据同步逻辑最复杂

---

### 维度 3: 开发体验

| 方面 | Basic 模式 | Context 模式 | Image 模式 |
|------|-----------|-------------|-----------|
| **是否需要 .value** | 是（对象属性） | 否（reactive） | 否（顶层 ref） |
| **代码简洁度** | 中 | 高 | 低（大量 computed） |
| **类型安全** | ⚠️ 运行时错误 | ✅ 编译时检查 | ✅ 编译时检查 |
| **样板代码** | 中（解包逻辑） | 少 | 多（双向 computed） |
| **可测试性** | 中 | 高 | 低（依赖组件） |

**结论**: Context 模式的开发体验最好

---

### 维度 4: 架构一致性

| 方面 | Basic 模式 | Context 模式 | Image 模式 |
|------|-----------|-------------|-----------|
| **中间层** | Logic 层 | Tester 层 | 无 |
| **状态包装** | ComputedRef | Reactive | 直接 Ref |
| **代码复用** | ✅ 高（System/User 共享） | ✅ 高（System/User 共享） | ❌ 低（各自独立） |
| **学习曲线** | 陡峭（理解 Logic 层） | 平坦 | 平坦 |

**问题**:
- ❌ Basic 模式的 Logic 层增加了理解成本
- ❌ Image 模式缺少代码复用

---

## 💡 统一方案建议

### 方案 A: 统一使用 Context 模式的 Reactive 架构 ⭐️⭐️⭐️⭐️⭐️

**核心思路**: 所有模式都使用 `reactive` 对象，不使用 `computed` 双向绑定

**架构设计**:
```typescript
// ✅ 统一的 Workspace Composable
export function useWorkspace(options: {
  mode: 'basic-system' | 'basic-user' | 'context-system' | 'context-user' | 'image-text2image'
}) {
  const sessionStore = useSessionStore(options.mode)
  const toast = useToast()
  const { t } = useI18n()

  // ✅ 使用 reactive 管理所有状态（自动解包，无需 .value）
  const state = reactive({
    // 持久化状态代理
    prompt: sessionStore.prompt,
    optimizedPrompt: sessionStore.optimizedPrompt,
    testResults: sessionStore.testResults,

    // 过程态（不持久化）
    isOptimizing: false,
    isTestingOriginal: false,
    isTestingOptimized: false,

    // 历史管理（不持久化）
    currentVersions: [],
    currentChainId: '',
    currentVersionId: ''
  })

  // ✅ 业务逻辑方法
  const handleOptimize = async () => {
    state.isOptimizing = true
    try {
      // 业务逻辑...

      // ✅ 单向更新：直接修改 state，watch 同步到 store
      state.optimizedPrompt = newPrompt

      sessionStore.updateOptimizedResult({
        optimizedPrompt: newPrompt
      })
    } finally {
      state.isOptimizing = false
    }
  }

  const handleTest = async () => {
    // ...
  }

  // ✅ 自动同步 state → sessionStore
  watch(
    () => state.optimizedPrompt,
    (value) => {
      sessionStore.updateOptimizedResult({ optimizedPrompt: value })
    }
  )

  // ✅ 返回 reactive 对象（自动解包，无需 .value）
  return state
}
```

**组件中使用**:
```typescript
<script setup>
const workspace = useWorkspace({ mode: 'basic-system' })

// ✅ 无需 .value
const hasOriginalResult = computed(() =>
  !!workspace.testResults.originalResult
)

// ✅ 直接调用方法
const handleOptimize = () => workspace.handleOptimize()
</script>

<template>
  <TestResultPanel
    :originalResult="workspace.testResults.originalResult"
    :isTesting="workspace.testResults.isTestingOriginal"
  />
</template>
```

**优点**:
- ✅ 统一架构，所有模式一致
- ✅ 无需 `.value`，开发体验最佳
- ✅ 代码简洁清晰
- ✅ 类型安全
- ✅ 符合 Vue 3 单向数据流

**缺点**:
- ⚠️ 需要重构所有模式
- ⚠️ 需要手动 watch 同步状态

---

### 方案 B: 统一使用 Basic 模式的 Logic 层 + toRefs ⭐️⭐️⭐️

**核心思路**: 保留 Logic 层，但使用 `toRefs` 自动解包

**架构设计**:
```typescript
export function useWorkspaceLogic(options: { mode: string }) {
  const sessionStore = useSessionStore(options.mode)

  // 过程态
  const isOptimizing = ref(false)
  const isTestingOriginal = ref(false)

  // 状态代理
  const testResults = computed({
    get: () => sessionStore.testResults,
    set: (value) => sessionStore.updateTestResults(value)
  })

  // 业务逻辑
  const handleTest = async () => {
    // ...
  }

  // ✅ 使用 toRefs 自动解包
  return {
    ...toRefs({
      testResults,
      isOptimizing,
      isTestingOriginal
    }),
    handleTest
  }
}
```

**组件中使用**:
```typescript
<script setup>
const workspace = useWorkspaceLogic({ mode: 'basic-system' })

// ✅ 无需 .value
const hasOriginalResult = computed(() =>
  !!workspace.testResults?.originalResult
)
</script>
```

**优点**:
- ✅ 最小改动
- ✅ 保持现有架构
- ✅ 无需 `.value`

**缺点**:
- ⚠️ 仍然使用双向 computed
- ⚠️ Logic 层仍是间接层

---

### 方案 C: 统一移除中间层，直接使用 Store ⭐️⭐️⭐️⭐

**核心思路**: 所有模式都直接使用 Store，业务逻辑分离到 Operations Composable

**架构设计**:
```typescript
// ✅ Store: 只管理状态
const sessionStore = useSessionStore('basic-system')
const { prompt, testResults } = storeToRefs(sessionStore)

// ✅ Operations: 只包含业务逻辑
const { handleOptimize, handleTest } = useWorkspaceOperations({
  sessionStore,
  services
})

// ✅ 派生状态：组件内定义
const hasOriginalResult = computed(() =>
  !!testResults.value?.originalResult
)
```

**组件中使用**:
```typescript
<script setup>
const sessionStore = useSessionStore('basic-system')
const { prompt, testResults, optimizedPrompt } = storeToRefs(sessionStore)

const { handleOptimize, handleTest } = useWorkspaceOperations({
  sessionStore,
  services
})

// 派生状态
const hasOriginalResult = computed(() =>
  !!testResults.value?.originalResult
)
</script>

<template>
  <TestResultPanel
    :originalResult="testResults.originalResult"
    @test="handleTest"
  />
</template>
```

**优点**:
- ✅ 符合 Vue 3 最佳实践
- ✅ 单向数据流
- ✅ 职责清晰分离
- ✅ 易于测试

**缺点**:
- ⚠️ 需要重构所有模式
- ⚠️ 组件内需要定义 computed（但可以接受）

---

## 📊 方案对比

| 维度 | 方案 A (Reactive) | 方案 B (Logic + toRefs) | 方案 C (Store + Operations) |
|------|------------------|------------------------|----------------------------|
| **改动成本** | 大 | 中 | 大 |
| **开发体验** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **代码简洁度** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **类型安全** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **数据流清晰度** | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **符合 Vue 3 规范** | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **维护成本** | 低 | 中 | 低 |
| **推荐指数** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

---

## 🎯 最终建议

### 短期（1-2周内）: 快速对齐

**目标**: 统一开发体验，减少类似 bug

**实施方案**: **方案 B（Logic + toRefs）**

**理由**:
- ✅ 改动成本最小
- ✅ 立即解决 `.value` 问题
- ✅ 保持现有架构
- ✅ 无需大规模重构

**实施步骤**:
1. 修改 `useBasicWorkspaceLogic.ts`，使用 `toRefs` 自动解包
2. 修改 Context 和 Image 模式，创建统一的 Logic 层
3. 更新所有组件，移除 `.value` 访问
4. 添加 ESLint 规则，禁止直接访问 computed 对象属性

---

### 长期（1-2个月内）: 架构重构

**目标**: 符合 Vue 3 最佳实践，提升代码质量

**实施方案**: **方案 C（Store + Operations）**

**理由**:
- ✅ 符合 Vue 3 单向数据流原则
- ✅ 职责清晰分离（状态 vs 业务逻辑）
- ✅ 易于测试和维护
- ✅ 长期来看是最佳实践

**实施步骤**:
1. 重构 Basic 模式，移除 Logic 层
2. 创建 `useWorkspaceOperations` composable
3. 组件直接使用 Store + Operations
4. 同步重构 Context 和 Image 模式
5. 更新文档和开发规范

---

## 📝 行动计划

### Phase 1: 紧急修复（已完成 ✅）
- [x] 修复 Basic 模式的 `.value` 缺失问题
- [x] 验证所有模式功能正常

### Phase 2: 短期对齐（1-2周）
- [ ] 修改 `useBasicWorkspaceLogic.ts` 使用 `toRefs`
- [ ] 为 Context 和 Image 创建统一的 Logic 层
- [ ] 更新所有组件移除 `.value`
- [ ] 添加 ESLint 规则
- [ ] 更新文档

### Phase 3: 长期重构（1-2月）
- [ ] 设计新的统一架构
- [ ] 创建 `useWorkspaceOperations` composable
- [ ] 重构 Basic 模式
- [ ] 重构 Context 模式
- [ ] 重构 Image 模式
- [ ] 全面测试
- [ ] 更新文档和规范

---

## 🔗 相关文档

- [Session Store 测试结果 Bug 修复记录](./session-store-testresults-bug-fix-2025-01-08.md)
- [Vue 3 官方文档 - Reactivity Fundamentals](https://vuejs.org/guide/essentials/reactivity-fundamentals.html)
- [Vue 3 Style Guide](https://vuejs.org/style-guide/)

---

**文档维护**: 随着重构进展更新此文档
