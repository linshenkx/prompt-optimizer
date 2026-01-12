# Session 持久化问题修复计划

## 📋 问题描述

### 现象
用户在无痕模式打开应用，切换下拉框（优化模型、测试模型、模板）的值后，刷新页面，选择的值会丢失，恢复到默认值。

### 用户期望
切换下拉框后，刷新页面，选择应该保留。

---

## 🔍 问题分析

### 根本原因
**切换下拉框时，数据没有立即保存到持久化存储，只更新了内存。**

### 数据流分析

#### 当前实现（有问题的流程）：
```
用户切换下拉框
  ↓
下拉框组件触发更新事件
  ↓
session store 的 updateOptimizeModel(modelKey) 被调用
  ↓
更新内存中的 ref: selectedOptimizeModelKey.value = modelKey  ✅
  ↓
【问题点】没有调用 saveSession()  ❌
  ↓
用户刷新页面
  ↓
pagehide 事件触发，但异步保存未完成
  ↓
页面刷新，内存清空
  ↓
restoreSession() 从 IndexedDB 恢复数据
  ↓
【问题点】恢复的是旧数据或默认值  ❌
  ↓
下拉框显示错误的值
```

#### 正确的流程应该是：
```
用户切换下拉框
  ↓
updateOptimizeModel(modelKey) 被调用
  ↓
更新内存: selectedOptimizeModelKey.value = modelKey  ✅
  ↓
【修复点】立即调用 saveSession()  ✅
  ↓
saveSession() 异步保存到 IndexedDB
  ↓
用户刷新页面
  ↓
restoreSession() 从 IndexedDB 恢复数据
  ↓
下拉框显示正确的值  ✅
```

---

## 🛠️ 已尝试的方案

### 方案 1: 防抖保存（已废弃）
**实施内容**：
- 在 session store 中添加 `createDebounceSave` 函数
- 在 `updateOptimizeModel` 等方法中调用 `debouncedSave()`
- 防抖延迟 500ms

**问题**：
- ❌ 延迟 500ms 太久，用户在 500ms 内刷新会丢失数据
- ❌ 复杂化了问题，引入了额外的状态管理
- ❌ 违背了"立即保存"的原则

### 方案 2: 同步 pagehide 保存（已废弃）
**实施内容**：
- 在 `PromptOptimizerApp.vue` 的 `handlePagehide` 中添加同步 localStorage 写入

**问题**：
- ❌ 只保存部分字段（selectedOptimizeModelKey、selectedTemplateId）
- ❌ 逻辑错误：`if (existingData)` 检查导致首次切换时无法保存
- ❌ 破坏了架构（绕过 core 层抽象）

### 方案 3: 移除防抖，直接调用 saveSession（当前方案）
**实施内容**：
- 移除防抖机制
- 在 `updateOptimizeModel` 等方法中直接调用 `saveSession()`

**问题**：
- ❌ 测试仍然失败，数据没有保存
- ⚠️ 可能 `saveSession()` 是异步的，但没有 await
- ⚠️ 可能 `saveSession()` 调用失败

### 方案 4: 双重保存（同步 + 异步）
**实施内容**：
- 在 `updateOptimizeModel` 中先同步写入 localStorage
- 再异步调用 `saveSession()` 保存到 IndexedDB

**问题**：
- ❌ 违背了架构原则（绕过 core 层）
- ❌ 逻辑错误：`if (existingData)` 检查导致首次切换时无法保存

---

## 📂 关键文件位置

### Session Store 文件
```
packages/ui/src/stores/session/
├── useBasicSystemSession.ts
├── useBasicUserSession.ts
├── useProVariableSession.ts
├── useProMultiMessageSession.ts
├── useImageText2ImageSession.ts
└── useImageImage2ImageSession.ts
```

### Session Manager
```
packages/ui/src/stores/session/useSessionManager.ts
```

### 应用初始化
```
packages/ui/src/components/app-layout/PromptOptimizerApp.vue
```

### 存储初始化
```
packages/ui/src/composables/system/useAppInitializer.ts
```

### 测试文件
```
tests/e2e/session-persistence/basic-user-persistence.spec.ts
```

---

## 📊 当前代码状态

### `useBasicUserSession.ts` 的问题

#### 1. updateOptimizeModel 方法
```typescript
const updateOptimizeModel = (modelKey: string) => {
  if (selectedOptimizeModelKey.value === modelKey) return
  selectedOptimizeModelKey.value = modelKey
  lastActiveAt.value = Date.now()

  // 【问题】同步保存到 localStorage
  try {
    const key = 'session/v1/basic-user'
    const existing = localStorage.getItem(key)
    if (existing) {  // ⚠️ 关键问题：首次切换时 existing 为 null
      const data = JSON.parse(existing)
      data.selectedOptimizeModelKey = modelKey
      data.lastActiveAt = lastActiveAt.value
      localStorage.setItem(key, JSON.stringify(data))
    }
  } catch (err) {
    console.warn('[BasicUserSession] 同步保存失败:', err)
  }

  // 【问题】异步保存，但没有 await
  saveSession()  // ⚠️ 异步调用，但没有等待完成
}
```

**问题分析**：
1. 同步保存有逻辑错误：`if (existing)` 检查导致首次切换时无法保存
2. `saveSession()` 是异步的，但没有 await，调用者不知道何时完成
3. 没有错误处理机制

#### 2. saveSession 方法
```typescript
const saveSession = async () => {
  console.log('[BasicUserSession] saveSession 被调用')
  const $services = getPiniaServices()
  if (!$services?.preferenceService) {
    console.warn('[BasicUserSession] PreferenceService 不可用，无法保存会话')
    return
  }

  try {
    const sessionState = {
      prompt: prompt.value,
      optimizedPrompt: optimizedPrompt.value,
      reasoning: reasoning.value,
      chainId: chainId.value,
      versionId: versionId.value,
      testContent: testContent.value,
      testResults: testResults.value,
      selectedOptimizeModelKey: selectedOptimizeModelKey.value,
      selectedTestModelKey: selectedTestModelKey.value,
      selectedTemplateId: selectedTemplateId.value,
      selectedIterateTemplateId: selectedIterateTemplateId.value,
      isCompareMode: isCompareMode.value,
      lastActiveAt: lastActiveAt.value,
    }
    console.log('[BasicUserSession] 保存会话, selectedOptimizeModelKey:', sessionState.selectedOptimizeModelKey)

    await $services.preferenceService.set(
      'session/v1/basic-user',
      JSON.stringify(sessionState)
    )

    console.log('[BasicUserSession] 保存会话成功')
  } catch (error) {
    console.error('[BasicUserSession] 保存会话失败:', error)
  }
}
```

**问题分析**：
- ✅ 实现看起来正确
- ⚠️ 但测试中没有看到这些日志，说明可能没有被调用
- ⚠️ 或者 PreferenceService 不可用

---

## 🧪 测试结果

### 测试文件位置
```
tests/e2e/session-persistence/basic-user-persistence.spec.ts
```

### 测试策略
- ✅ 移除了对 localStorage 的依赖
- ✅ 改为验证 UI 状态（下拉框显示的值）

### 测试结果（最新）
```
初始优化模型: DeepSeekDeepSeek
切换到模型: SiliconFlowSiliconFlow
切换后: SiliconFlowSiliconFlow  ✅ UI 更新成功
刷新后: DeepSeekDeepSeek  ❌ 恢复到初始值

期望: "SiliconFlowSiliconFlow"
实际: "DeepSeekDeepSeek"
```

**结论**：数据没有被保存到 IndexedDB，或者没有被正确恢复。

---

## 🎯 下一步建议

### 建议 1: 简化方案，使用同步保存
**原理**：
- 既然 `saveSession()` 是异步的，而用户刷新很快，异步操作可能来不及完成
- 可以改为使用同步的 localStorage 保存

**实施步骤**：
1. 移除所有 `saveSession()` 调用
2. 在 `updateOptimizeModel` 等方法中直接同步写入 localStorage
3. 修改 `restoreSession` 从 localStorage 读取
4. 保留 PreferenceService 的异步保存作为备份（可选）

**优点**：
- ✅ 简单直接，可靠性高
- ✅ 不依赖异步操作完成
- ✅ 不会因为用户快速刷新而丢失数据

**缺点**：
- ❌ 绕过了 core 层的抽象（PreferenceService）
- ❌ 但 session 数据本来就是 UI 层的数据，使用 localStorage 合理

### 建议 2: 修复异步保存流程
**原理**：
- 保持现有的架构（使用 PreferenceService）
- 确保异步保存正确完成

**实施步骤**：
1. 检查 `saveSession()` 是否真的被调用（添加日志验证）
2. 检查 `preferenceService.set()` 是否成功
3. 检查 `restoreSession()` 是否正确从 IndexedDB 读取数据
4. 检查 `restoreSession()` 是否在页面加载时被调用

**调试方法**：
- 在 `updateOptimizeModel` 开头添加 `console.log`
- 在 `saveSession` 开头添加 `console.log`
- 在 `preferenceService.set()` 前后添加 `console.log`
- 在 `restoreSession` 开头和结尾添加 `console.log`
- 运行测试，查看浏览器控制台日志

### 建议 3: 使用 watch 自动保存
**原理**：
- 使用 Vue 的 `watch` 监听 ref 的变化
- 当 ref 变化时自动调用 `saveSession()`

**实施步骤**：
```typescript
// 在 store 中添加
watch(selectedOptimizeModelKey, (newValue) => {
  saveSession()
})
```

**优点**：
- ✅ 自动化，不需要手动调用 `saveSession()`
- ✅ 解耦，更新逻辑和保存逻辑分离

**缺点**：
- ⚠️ 仍然是异步保存，可能来不及完成

---

## 🚫 避免的陷阱

### 1. 不要过度优化
- ❌ 不要使用防抖（用户可能快速刷新）
- ❌ 不要使用节流（可能丢失最后的更新）
- ✅ 应该立即保存，简单直接

### 2. 不要破坏架构
- ❌ 不要在多个地方保存（localStorage + IndexedDB）
- ❌ 不要绕过 core 层的抽象（除非有充分理由）
- ✅ 应该统一使用 PreferenceService

### 3. 不要依赖异步完成
- ❌ 不要假设异步操作会在页面刷新前完成
- ❌ 不要使用 pagehide 作为唯一的保存时机
- ✅ 应该在数据变化时立即保存

---

## 📝 额外信息

### 架构说明
- **存储层**：PreferenceService（core 层抽象）
- **存储提供者**：DexieStorageProvider（Web 环境，使用 IndexedDB）
- **Session Store**：Pinia store（UI 层）
- **恢复时机**：应用启动时调用 `restoreAllSessions()`

### 相关代码
- `useAppInitializer.ts`：初始化 PreferenceService
- `useSessionManager.ts`：管理所有 session 的保存和恢复
- `PromptOptimizerApp.vue`：应用初始化时调用 `restoreAllSessions()`

### 已知问题
1. Web 环境使用 DexieStorageProvider（IndexedDB），不是 localStorage
2. `preferenceService.set()` 会添加 `pref:` 前缀
3. 实际存储键是 `pref:session/v1/basic-user`，不是 `session/v1/basic-user`

---

## ✅ 验收标准

修复后的代码应该满足：
1. ✅ 用户切换下拉框后立即保存
2. ✅ 用户刷新页面后，下拉框显示正确的值
3. ✅ 即使用户在切换后立即刷新，数据也能保留
4. ✅ 代码简单清晰，不引入复杂的状态管理
5. ✅ 不破坏现有的架构（尽量使用 PreferenceService）
6. ✅ E2E 测试通过

---

## 🔗 相关资源

- 用户讨论：用户强调"所有写操作都应该立即保存"
- 用户观点：不要"修修补补"，要找到问题的本质
- 用户要求：使用 core 层抽象存储（PreferenceService），不要在测试中直接操作 localStorage
