# Architecture Migration Guide 详细分析

## 📋 文档概述

**文档名称**: `architecture-migration-guide.md`
**性质**: 长期规划文档（未执行）
**目标**: 将三种模式统一到 **Store + Operations** 架构

---

## 🎯 核心目标

### 要解决的问题
1. **P0 Bug 根因**: `logic.testResults?.originalResult` 遗漏 `.value`，导致 UI 显示问题
2. **架构不统一**: Basic/Context/Image 三种模式使用不同的状态管理模式
3. **响应式陷阱**: Logic 层返回"对象属性中的 ComputedRef"，容易被误用
4. **维护成本高**: 多种模式并存，代码风格不一致

### 理想架构（目标态）
```
Component (直接消费 store)
    ↓
Operations composable (副作用/流程逻辑)
    ↓
Pinia Session Store (单一真源)
```

---

## 📊 当前架构实际状态

### 1. Basic 模式（部分修复，未迁移）

#### 当前状态
```
BasicSystemWorkspace.vue / BasicUserWorkspace.vue
    ↓
useBasicWorkspaceLogic (状态代理 + 业务逻辑)  ← 仍在使用
    ↓
useBasicSystemSession / useBasicUserSession (Pinia Store)
```

#### 代码证据

**Logic 层仍在使用** (`packages/ui/src/composables/workspaces/useBasicWorkspaceLogic.ts`):
```typescript
// ✅ P0 Bug 已修复：testResults getter 不再返回临时对象
const testResults = computed<BasicSessionStore['testResults']>({
  get: () => {
    // 关键修复：始终返回 sessionStore.testResults（即使是 null）
    return sessionStore.testResults
  },
  set: (value) => {
    sessionStore.updateTestResults(value)
  }
})

// ❌ 但 Logic 层仍然返回大量 computed 包装
export function useBasicWorkspaceLogic(options) {
  return {
    // 状态代理（所有都是 ComputedRef）
    prompt,              // ComputedRef<string>
    optimizedPrompt,     // ComputedRef<string>
    testResults,         // ComputedRef<TestResults | null>
    testContent,         // ComputedRef<string>

    // 过程态
    isOptimizing,        // Ref<boolean>
    isTestingOriginal,   // Ref<boolean>

    // 业务方法
    handleOptimize,
    handleTest,
    handleIterate,
    // ...
  }
}
```

**组件消费方式** (`BasicSystemWorkspace.vue:323-365`):
```typescript
const logic = useBasicWorkspaceLogic({
  services,
  sessionStore: session,
  optimizationMode: 'system',
  promptRecordType: 'optimize'
})

// ✅ P0 Bug 已修复：组件中正确使用 .value
const hasOriginalResult = computed(() => !!logic.testResults.value?.originalResult)
const hasOptimizedResult = computed(() => !!logic.testResults.value?.optimizedResult)
```

#### 分析

**已完成的工作**:
- ✅ P0 Bug 已修复（组件中正确使用 `.value`）
- ✅ Logic 层的 `testResults` getter 不再返回临时对象
- ✅ Session Store 使用独立 ref（不再是 `state.xxx`）

**未完成的迁移**:
- ❌ Logic 层仍然存在（19KB，597 行代码）
- ❌ Logic 层仍然返回大量 ComputedRef 包装
- ❌ 组件仍然通过 `logic.xxx` 访问状态，而非直接访问 `session.xxx`
- ❌ 业务逻辑（handleOptimize/handleTest）仍在 Logic 层，未抽离为独立 Operations

**为什么没有迁移？**
1. **短期止血优先**: P0 Bug 已通过修复组件消费方式解决，不影响功能
2. **迁移成本高**: 需要重构组件 + 创建 Operations + 测试验证
3. **风险控制**: 当前架构虽不理想，但已稳定运行

---

### 2. Context 模式（Tester composable 主导）

#### 当前状态
```
ContextSystemWorkspace.vue
    ↓
useConversationTester (reactive 状态树 + 业务逻辑)
    ↓
部分数据写入 Session Store
```

#### 代码证据

**Tester composable** (`ContextSystemWorkspace.vue:461`):
```typescript
const conversationTester = useConversationTester(
  services,
  optimizationContext,
  // ... 其他参数
)
```

**Tester 内部使用 reactive 状态树**:
```typescript
// useConversationTester 内部（推测）
const state = reactive({
  testResults: null,
  isTestingOriginal: false,
  isTestingOptimized: false,
  // ... 大量临时状态
})
```

#### 分析

**问题**:
- ❌ Tester composable 既管理临时态，又管理持久化状态
- ❌ reactive 状态树与 Session Store 可能存在状态分裂
- ❌ 组件难以直接访问 Session Store（被 Tester 封装了）

**迁移指南建议**:
```typescript
// 目标架构
useContextWorkspaceOperations (对外接口)
    ↓
useConversationTester (内部实现，只管理临时态)
    ↓
Session Store (持久化状态的唯一真源)
```

---

### 3. Image 模式（已接近目标架构）

#### 当前状态
```
ImageText2ImageWorkspace.vue
    ↓
直接消费 useImageText2ImageSession (Pinia Store)
    ↓
ImageStorageService (图像数据存储)
```

#### 代码证据

**Session Store** (`useImageText2ImageSession.ts:41-56`):
```typescript
export const useImageText2ImageSession = defineStore('imageText2ImageSession', () => {
  // ✅ 使用独立 ref，符合 Pinia 最佳实践
  const originalPrompt = ref('')
  const optimizedPrompt = ref('')
  const reasoning = ref('')
  const originalImageResult = ref<ImageResult | null>(null)
  const optimizedImageResult = ref<ImageResult | null>(null)

  // ✅ 提供简洁的 action 方法
  const updatePrompt = (prompt: string) => {
    if (originalPrompt.value === prompt) return
    originalPrompt.value = prompt
    lastActiveAt.value = Date.now()
  }

  return {
    // state
    originalPrompt,
    optimizedPrompt,
    // ...

    // actions
    updatePrompt,
    updateOptimizedResult,
    // ...
  }
})
```

**图像存储分离** (`ImageStorageService`):
```typescript
// ✅ base64 数据存储在独立的 IndexedDB
// ✅ Session Store 只存储 ImageRef
{
  id: 'img_123',
  _type: 'image-ref'
}
```

#### 分析

**优点**:
- ✅ 最接近目标架构（Store + Operations）
- ✅ Session Store 使用独立 ref
- ✅ 数据分离合理（图像数据 vs 元数据）
- ✅ 组件可以直接访问 store

**缺点**:
- ⚠️ 业务逻辑可能直接写在组件中（未抽离 Operations）
- ⚠️ 组件可能会膨胀（2205 行）

---

## 🗺️ 迁移路线图分析

### Phase 1：基础设施准备（未开始）

**目标**: 建立护栏和规范

**具体任务**:
1. ✅ **已完成**: 组件消费规则文档（通过 Bug 修复总结）
2. ❌ **未完成**: ESLint 规则（禁止 computed 返回临时对象）
3. ❌ **未完成**: Operations 模板/示例
4. ❌ **未完成**: 迁移 checklist

**为什么没做？**
- P0 Bug 已通过局部修复解决
- 护栏建设需要团队协调
- 投入产出比不高（当前架构已稳定）

---

### Phase 2：Basic 模式迁移（未开始）

**目标**: Logic → Operations

**迁移步骤**（指南描述）:
```typescript
// Step 1: 创建新的 Operations composable
export function useBasicWorkspaceOperations(options) {
  // 只返回过程态和方法，不包装状态
  const isOptimizing = ref(false)
  const handleOptimize = async () => { /* ... */ }

  return {
    isOptimizing,
    handleOptimize,
    handleTest,
    handleIterate
  }
}

// Step 2: 组件直接消费 store
const session = useBasicSystemSession()
const ops = useBasicWorkspaceOperations({ services, sessionStore: session })

// 直接访问 store（不通过 Logic 层）
const hasOriginalResult = computed(() => !!session.testResults?.originalResult)

// 触发操作
<button @click="ops.handleOptimize()">优化</button>
```

**当前 vs 目标对比**:

| 维度 | 当前（Logic 层） | 目标（Operations） |
|------|-----------------|-------------------|
| 状态访问 | `logic.testResults.value` | `session.testResults` |
| 状态类型 | ComputedRef | 原生 Ref |
| 业务逻辑 | Logic 层内部 | Operations 独立 |
| 组件绑定 | `logic.handleOptimize` | `ops.handleOptimize` |
| 响应式陷阱 | 易漏 `.value` | 直接访问 store，无陷阱 |

**为什么没迁移？**
1. **当前方案已可用**: P0 Bug 已修复，功能正常
2. **迁移成本高**: 需要重构 2 个组件 + 创建新 Operations + 回归测试
3. **风险大**: Basic 模式是核心功能，迁移失败影响面大
4. **优先级低**: 没有紧迫的业务需求驱动

---

### Phase 3-5（未开始）

- **Phase 3**: Context 模式迁移（Tester → Operations）
- **Phase 4**: Image 模式对齐（补充 Operations 抽离）
- **Phase 5**: 清理废弃代码 + 性能优化

---

## 💡 关键发现

### 1. P0 Bug 的实际修复方式

**迁移指南描述**: 需要迁移到 Store + Operations
**实际修复**: 局部修复组件消费方式

**修复前** (`BasicSystemWorkspace.vue`):
```typescript
// ❌ 错误：logic.testResults 是 ComputedRef，漏了 .value
const hasOriginalResult = computed(() => !!logic.testResults?.originalResult)
```

**修复后** (`BasicSystemWorkspace.vue:365`):
```typescript
// ✅ 正确：显式使用 .value
const hasOriginalResult = computed(() => !!logic.testResults.value?.originalResult)
```

**结论**: P0 Bug 通过**最小化修改**已解决，不需要完整迁移架构。

---

### 2. Logic 层的实际价值

**迁移指南认为**: Logic 层是"技术债"，应该删除
**实际情况**: Logic 层提供了价值

**Logic 层的优点**:
1. ✅ **代码复用**: BasicSystem/BasicUser 共享同一套业务逻辑（597 行）
2. ✅ **状态封装**: 隔离了 Session Store 的实现细节
3. ✅ **职责清晰**: 组件专注于 UI，Logic 专注于业务逻辑

**Logic 层的缺点**:
1. ❌ **响应式陷阱**: 返回对象属性中的 ComputedRef，容易漏 `.value`
2. ❌ **间接层**: 增加了一层抽象，调试时需要跟踪多层
3. ❌ **与 Pinia 范式不符**: Pinia 推荐直接消费 store

---

### 3. 迁移的实际阻力

**迁移指南假设**: 团队愿意投入资源完成迁移
**实际情况**: 存在多重阻力

**阻力来源**:
1. **功能已稳定**: P0 Bug 已修复，没有紧迫的业务驱动
2. **投入产出比低**: 迁移需要数周时间，收益主要是"代码更优雅"
3. **回归风险**: Basic 模式是核心功能，迁移失败影响大
4. **测试覆盖不足**: 缺少自动化测试，迁移后难以验证正确性
5. **团队协调成本**: 需要统一编码规范、Code Review 标准

---

## 📝 建议

### 短期（1-2周）

**保持现状，不强制迁移**

**理由**:
1. P0 Bug 已修复，功能正常
2. 当前架构虽不完美，但已稳定运行
3. 迁移的性价比不高

**可选优化**:
- ✅ 补充组件消费规则文档（防止再次漏 `.value`）
- ✅ 添加 ESLint 规则提醒（warn 级别）
- ✅ 补充单元测试（防回归）

---

### 中期（1-3月）

**逐步迁移，按优先级排序**

**优先级**:
1. **Context 模式** (优先级最高)
   - 原因：Tester composable 状态管理混乱，存在状态分裂风险
   - 收益：统一架构，提高可维护性

2. **Image 模式** (优先级中)
   - 原因：已接近目标架构，只需补充 Operations 抽离
   - 收益：组件瘦身，业务逻辑复用

3. **Basic 模式** (优先级低)
   - 原因：当前方案已可用，迁移风险最大
   - 收益：主要是代码优雅性提升

---

### 长期（3-6月）

**建立规范，新代码遵循 Store + Operations**

**策略**:
1. **新功能强制使用**: 所有新增功能必须使用 Store + Operations
2. **旧代码按需重构**: 只在修改旧代码时顺便重构
3. **建立最佳实践**: 提供 Operations 模板和示例
4. **持续改进**: 每次迭代优化一小部分

---

## 🎯 结论

### 迁移指南的定位

**文档性质**: 长期愿景，非强制执行计划
**实际价值**:
- ✅ 提供了架构改进的方向
- ✅ 总结了当前架构的问题
- ✅ 设计了详细的迁移方案

**但实际上**:
- ❌ Phase 1-5 完全未开始
- ❌ Logic 层仍在使用
- ❌ 三种模式仍然使用不同架构

### 是否需要迁移？

**答案**: 不强制，按需渐进

**理由**:
1. P0 Bug 已通过最小化修改解决
2. 当前架构已稳定，功能正常
3. 迁移的投入产出比不高
4. 可以通过增量改进逐步达成目标

### 推荐路径

```
现状维持（短期）
    ↓
Context 模式优先迁移（中期）
    ↓
新功能强制使用 Store + Operations（长期）
    ↓
旧代码按需重构（逐步收敛）
```

---

## 📌 附录：快速参考

### 当前三种模式对比

| 模式 | 架构 | 是否需要迁移 | 优先级 |
|------|------|-------------|--------|
| Basic | Store → Logic → Component | 可选 | 低 |
| Context | Tester → Component | 建议迁移 | 高 |
| Image | Store → Component | 补充优化 | 中 |

### 关键代码位置

- **Basic Logic**: `packages/ui/src/composables/workspaces/useBasicWorkspaceLogic.ts` (597 行)
- **Context Tester**: `packages/ui/src/composables/prompt/useConversationTester.ts`
- **Image Session**: `packages/ui/src/stores/session/useImageText2ImageSession.ts`
- **迁移指南**: `docs/workspace/architecture-migration-guide.md` (20 KB)
