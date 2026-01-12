# 技术分析与问题解决文档

> 本文档整合了项目开发过程中的技术分析和问题解决方案

## 目录

1. [IndexedDB 数据库问题分析](#1-indexedb-数据库问题分析)
2. [图像存储解决方案](#2-图像存储解决方案)
3. [模式术语迁移总结](#3-模式术语迁移总结)
4. [代码审查提示词评估](#4-代码审查提示词评估)

---

## 1. IndexedDB 数据库问题分析

### 1.1 为什么数据会累积？
# 📊 为什么 IndexedDB 会无限累积到 2.4 GB？

## 🔍 问题根源分析

### 1. **自动保存机制（每次变化都保存）**

代码中有三个地方会自动触发保存：

```typescript
// PromptOptimizerApp.vue:1954-1960
window.addEventListener('pagehide', handlePagehide)          // ① 页面卸载时
document.addEventListener('visibilitychange', handleVisibilityChange)  // ② 标签页切换时
```

```typescript
// PromptOptimizerApp.vue:1105-1128
watch(
    () => promptTester.testResults,
    (newTestResults) => {
        // 每次测试结果变化，都会自动同步到 session store
        (session as any).updateTestResults(stableResults);
    },
    { deep: true }  // ⚠️ 深度监听，任何字段变化都会触发
);
```

**这意味着：**
- ✅ 每次测试完成 → `updateTestResults` 被调用 → `lastActiveAt = Date.now()`
- ✅ 切换标签页 → 触发 `visibilitychange` → 调用 `saveAllSessions()`
- ✅ 关闭页面 → 触发 `pagehide` → 调用 `saveAllSessions()`

### 2. **保存的是完整的 state（包括超大的 testResults）**

```typescript
// useBasicSystemSession.ts:211-227
const saveSession = async () => {
    // ❌ 直接序列化整个 state，没有任何过滤或截断
    const snapshot = JSON.stringify(state.value)
    await $services.preferenceService.set('session/v1/basic-system', snapshot)
}
```

**state.value 包含：**
```typescript
interface BasicSystemSessionState {
  prompt: string
  optimizedPrompt: string
  reasoning: string
  testContent: string
  testResults: TestResults | null  // ⚠️ 这个可以无限大！
  // ...其他字段
}

interface TestResults {
  originalResult: string       // ⚠️ 可能几十 KB
  originalReasoning: string    // ⚠️ 可能几十 KB
  optimizedResult: string      // ⚠️ 可能几十 KB
  optimizedReasoning: string   // ⚠️ 可能几十 KB
}
```

### 3. **没有任何大小限制**

```typescript
// useBasicSystemSession.ts:128-143
const updateTestResults = (results: TestResults | null) => {
    // ❌ 没有检查 results 的大小
    // ❌ 没有截断超长文本
    // ❌ 没有限制历史记录数量
    state.value.testResults = results
    state.value.lastActiveAt = Date.now()
}
```

**对比：没有任何防护代码：**
- ❌ 没有 `if (size > MAX_SIZE) { truncate() }`
- ❌ 没有 `if (text.length > 50000) { text = text.slice(0, 50000) }`
- ❌ 没有 `cleanupOldResults()`

### 4. **没有清理机制**

搜索整个代码库：
```bash
# 搜索清理相关代码
grep -r "清理\|cleanup\|clean\|delete.*test\|remove.*test" packages/ui/src/stores/session
# 结果：No matches found ❌
```

**这意味着：**
- ❌ 测试结果永远不会被删除
- ❌ 旧数据永远不会过期
- ❌ 数据库只会越来越大

## 📈 累积过程示例

假设用户的使用场景：

### Day 1: 正常使用
```
测试 1: GPT-4 输出 5 KB → 保存到 IndexedDB (5 KB)
测试 2: Claude 输出 8 KB → 保存到 IndexedDB (8 KB)
测试 3: Gemini 输出 6 KB → 保存到 IndexedDB (6 KB)
总计: 19 KB ✅
```

### Day 2: 继续测试
```
测试 4-10: 每次 5-10 KB
总计: 19 KB + 70 KB = 89 KB ✅
```

### Day 30: 一个月后
```
测试 1-300: 平均每次 7 KB
总计: 300 * 7 KB = 2.1 MB ⚠️
```

### Day 90: 三个月后
```
测试 1-900: 平均每次 7 KB
总计: 900 * 7 KB = 6.3 MB ⚠️⚠️
```

### 但实际情况更糟糕！

**如果用户测试了一个超长输出：**
```typescript
// 用户让 GPT-4 写了一篇长文章
testResults = {
  originalResult: "很长的文章...",      // 100 KB
  originalReasoning: "详细的思考...",   // 50 KB
  optimizedResult: "优化后的长文章...", // 120 KB
  optimizedReasoning: "优化思路...",    // 60 KB
}
// 单次测试 = 330 KB！
```

**如果用户频繁切换标签页：**
```
用户打开 10 个标签页 → 每个标签页都有自己的 session
每个 session 都累积测试结果
10 * 6.3 MB = 63 MB ⚠️⚠️⚠️
```

**如果用户使用了 Pro 模式的多轮对话：**
```typescript
// Pro-多消息模式
messages = [
  { role: 'user', content: '...' },    // 每条可能 10-50 KB
  { role: 'assistant', content: '...' },
  // ... 30 条消息
]
// 单个会话 = 30 * 30 KB = 900 KB
```

### 最终结果：2.4 GB 的数据库

```
6 个 session stores (basic-system, basic-user, pro-system, pro-user, image-text2image, image-image2image)
× 每个累积 3 个月的测试结果
× 没有任何清理
× 每次切换标签页都保存一次
= 2.4 GB 💥
```

## 🔧 为什么代码没有防护？

### 1. **过度信任用户行为**
开发者假设：
- ❌ "用户不会测试超长文本"
- ❌ "用户不会频繁切换标签"
- ❌ "用户会定期清理数据"

实际情况：
- ✅ 用户经常测试 GPT-4 的长回答（5000+ 字）
- ✅ 用户会开很多标签页
- ✅ 用户根本不知道需要清理

### 2. **缺少监控和告警**
没有代码检查：
- ❌ IndexedDB 使用量
- ❌ 单个 session 大小
- ❌ 序列化时间（超过 1 秒说明数据太大）

### 3. **缺少自动清理策略**
其他应用的常见做法：
```typescript
// ✅ 示例：自动清理 7 天前的数据
const cleanupOldData = () => {
  const now = Date.now();
  const WEEK = 7 * 24 * 60 * 60 * 1000;

  if (state.value.lastActiveAt && (now - state.value.lastActiveAt) > WEEK) {
    state.value.testResults = null;
    state.value.testContent = '';
  }
}

// ✅ 示例：限制单个字段大小
const MAX_RESULT_LENGTH = 50000; // 50 KB
if (results.originalResult.length > MAX_RESULT_LENGTH) {
  results.originalResult = results.originalResult.slice(0, MAX_RESULT_LENGTH) + '...[已截断]';
}

// ✅ 示例：数据库大小检查
if (estimatedSize > 100 * 1024 * 1024) { // 100 MB
  console.warn('数据库过大，建议清理');
  showCleanupDialog();
}
```

## 📊 与你的情况对比

你的备份数据库：
```
总大小: 2.4 GB
文件数: 40+ 个 .ldb 文件
最大文件: 27 MB
```

这说明：
- ✅ 你长期使用该应用（可能几个月）
- ✅ 测试了大量文本（可能包含 GPT-4 的长回答）
- ✅ 从未手动清理过数据
- ✅ 数据库达到了浏览器的临界点（打开时崩溃）

## ✅ 总结

**无限累积的三个关键原因：**

1. **自动保存很频繁** - 每次测试、每次切换标签页都保存
2. **保存的数据很大** - 完整的测试结果，没有截断
3. **从不清理** - 代码中没有任何清理逻辑

**解决方案：**
- 🔧 立即：删除数据库重置（已提供工具）
- 🛡️ 预防：实施数据大小限制和自动清理（下一步任务）

### 1.2 为什么是追加而非覆盖？
# 🔍 为什么是新增而不是覆盖？深层原因分析

## 关键发现

你的 IndexedDB 确实在使用 **覆盖操作** (put)，但底层存储机制导致了数据"累积"而非真正的覆盖。

## 1️⃣ 代码层面：确实是覆盖操作

```typescript
// dexieStorageProvider.ts:91-95
async setItem(key: string, value: string): Promise<void> {
  await this.db.storage.put({    // ✅ put() 是覆盖操作
    key,                          // 主键相同
    value,                        // 新值
    timestamp: Date.now()
  });
}
```

```typescript
// 数据库定义: dexieStorageProvider.ts:23-25
this.version(1).stores({
  storage: 'key, value, timestamp'  // ✅ 'key' 是主键
});
```

**逻辑上：** 每次调用 `setItem('session/v1/basic-system', newData)` **应该覆盖**同一个 key 的旧值。

## 2️⃣ 底层存储：LevelDB 的 LSM-Tree 架构

但是！Chrome 的 IndexedDB 底层使用 **LevelDB**，而 LevelDB 使用 **LSM-Tree (Log-Structured Merge Tree)** 架构。

### LSM-Tree 的工作原理

```
写入流程（Append-Only）：
┌─────────────────────────────────────────────────────────────┐
│ 1. 写入 MemTable (内存)                                       │
│    - key='session/v1/basic-system'                           │
│    - value='{"prompt":"..."}'  (1 KB)                        │
│    - 不会检查是否存在相同 key                                   │
└─────────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. MemTable 满 → 刷写到 SSTable 文件 (.ldb)                   │
│    - 001445.ldb (包含这次的写入)                              │
│    - 不会删除旧文件！                                          │
└─────────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. 再次写入同一个 key                                          │
│    - key='session/v1/basic-system'                           │
│    - value='{"prompt":"...", "testResults": {...}}'  (500 KB)│
└─────────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. 再次刷写到新的 SSTable 文件                                 │
│    - 001496.ldb (包含新的值)                                  │
│    - 001445.ldb 仍然存在！（包含旧值）                         │
└─────────────────────────────────────────────────────────────┘
```

### 为什么旧数据没有被删除？

**关键：** LSM-Tree 是 **Append-Only（只追加）** 架构：
- ❌ 不会就地修改已有的 .ldb 文件
- ❌ 不会立即删除旧版本的数据
- ✅ 每次写入都创建新的记录
- ✅ 旧数据通过 **Compaction（压缩合并）** 清理

## 3️⃣ Compaction（压缩）未及时执行

### 正常情况

```
写入 100 次 → 积累 100 个版本 → 触发 Compaction
                                     ↓
                          合并多个 .ldb 文件
                                     ↓
                          删除重复的 key，只保留最新版本
                                     ↓
                          数据库大小回落
```

### 你的情况：Compaction 被延迟或失败

可能原因：

1. **浏览器崩溃或异常退出**
   - Compaction 是后台任务
   - 如果浏览器频繁崩溃，Compaction 无法完成
   - 旧数据一直累积

2. **数据写入速度 > Compaction 速度**
   ```
   每秒写入 10 次 (切换标签页很频繁)
   vs
   Compaction 每 10 秒运行一次

   → 累积速度快于清理速度
   ```

3. **数据过大导致 Compaction 失败**
   ```
   单个 .ldb 文件 = 27 MB
   合并 10 个文件 = 270 MB

   → Compaction 需要大量内存
   → 浏览器内存不足
   → Compaction 失败，旧数据保留
   ```

4. **LevelDB 的 Compaction 策略**
   ```
   Level 0: 新写入的文件（未排序）
   Level 1-6: 已压缩的文件（排序）

   Compaction 触发条件：
   - Level 0 文件数 > 4
   - Level N 总大小 > 阈值

   你的情况：
   - 40+ 个 .ldb 文件 → 可能卡在 Level 0
   - 没有触发或完成 Compaction
   ```

## 4️⃣ 你的数据库状态分析

```bash
$ ls -lhS *.ldb | head -10
-rw-r--r-- 27M 001445.ldb  # 第1次大保存
-rw-r--r-- 27M 001481.ldb  # 第2次大保存
-rw-r--r-- 26M 001534.ldb  # 第3次大保存
...
共 40+ 个文件 = 2.4 GB
```

**这说明：**
- ✅ 每次保存都创建了新的 .ldb 文件
- ✅ 旧的 .ldb 文件从未被清理
- ✅ Compaction **完全没有执行**或**一直失败**

## 5️⃣ 为什么其他应用没有这个问题？

### 对比：正常的 Web 应用

```typescript
// ✅ 其他应用通常这样做
await db.users.put({ id: 1, name: 'Alice' })  // 1 KB
await db.users.put({ id: 2, name: 'Bob' })    // 1 KB
// ...

// 特点：
// - 小数据量 (每条 1-10 KB)
// - 写入频率低 (每秒 1-2 次)
// - Compaction 能及时清理
```

### 你的应用

```typescript
// ❌ Prompt Optimizer 的情况
await db.storage.put({
  key: 'session/v1/basic-system',
  value: JSON.stringify({
    // ...
    testResults: {
      originalResult: '...很长的文本...',      // 100 KB
      optimizedResult: '...更长的文本...',     // 120 KB
    }
  })
})  // 单次写入 500 KB - 2 MB！

// 特点：
// - 超大数据量 (每次 500 KB - 2 MB)
// - 写入频率高 (每次切换标签页都写)
// - Compaction 跟不上，累积成 2.4 GB
```

## 6️⃣ 根本原因总结

| 层级 | 问题 | 影响 |
|------|------|------|
| **应用层** | 保存完整的 testResults，没有截断 | 单次写入 500 KB - 2 MB |
| **应用层** | 频繁自动保存（每次切换标签页） | 写入频率过高 |
| **存储层** | LevelDB 的 LSM-Tree 是追加式写入 | 每次写入创建新记录 |
| **存储层** | Compaction 未及时或失败 | 旧数据永不删除 |
| **结果** | **2.4 GB 的累积数据** | **浏览器崩溃** |

## 7️⃣ 证据链

```
用户行为                 IndexedDB 逻辑          LevelDB 物理层
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

测试 10 次        →    10 次 put() 操作   →   10 个新记录追加到 MemTable
切换标签页        →    触发 saveSession   →   MemTable 刷写到 001445.ldb (27 MB)

再测试 10 次      →    10 次 put() 操作   →   10 个新记录追加到 MemTable
切换标签页        →    触发 saveSession   →   MemTable 刷写到 001481.ldb (27 MB)

                                                ⚠️ 001445.ldb 仍然存在！
                                                ⚠️ Compaction 未执行

重复 3 个月       →    1000 次保存        →   40+ 个 .ldb 文件 = 2.4 GB
                                                ⚠️ 所有旧文件都保留
                                                ⚠️ Compaction 完全失败

尝试打开页面      →    indexedDB.open()   →   LevelDB 尝试读取所有 .ldb
                                                ⚠️ 加载 2.4 GB 到内存
                                                💥 浏览器崩溃
```

## 8️⃣ 解决方案

### 立即修复（治标）
1. 删除整个 IndexedDB 数据库
2. 浏览器重新创建干净的数据库

### 根本修复（治本）
1. **限制单次写入大小**
   ```typescript
   if (testResults.originalResult.length > 50000) {
     testResults.originalResult = testResults.originalResult.slice(0, 50000) + '...'
   }
   ```

2. **减少写入频率**
   ```typescript
   // 使用 debounce，每 5 秒最多保存一次
   const debouncedSave = debounce(saveSession, 5000)
   ```

3. **定期清理旧数据**
   ```typescript
   // 只保留最近一次的测试结果
   state.value.testResults = latestResults
   ```

4. **分离大数据存储**
   ```typescript
   // testResults 单独存储，不放在 session 中
   await db.testResults.put({ sessionId, results })
   ```

## 9️⃣ 为什么浏览器不自动修复？

Chrome 的 LevelDB Compaction 依赖：
- ✅ 浏览器**正常关闭**时触发
- ✅ 数据库**空闲时**自动运行
- ❌ 浏览器**崩溃**时无法完成
- ❌ 数据库**持续高负载**时延迟

你的情况：
1. 应用频繁写入 → 数据库始终繁忙
2. 浏览器可能因数据过大而崩溃 → Compaction 无法完成
3. 形成恶性循环 → 数据只增不减

---

## ✅ 总结

**问题的本质：**

不是"新增 vs 覆盖"的问题，而是：
1. **逻辑上是覆盖**（put 同一个 key）
2. **物理上是追加**（LSM-Tree 架构）
3. **清理机制失效**（Compaction 未执行）
4. **数据只增不减**（2.4 GB 累积）

**类比：**
就像你每天往同一个文件柜（key）里放新文件（value），虽然名字相同，但旧文件没人清理，最后文件柜爆满。

### 1.3 为什么分离存储有效？
# 🔍 为什么分离存储能解决问题？

## 核心问题：保存频率不同

### 当前模式（问题）

```typescript
// ❌ Session 包含完整图像
interface SessionState {
  originalPrompt: string
  originalImageResult: {
    images: [{ b64: "2-3 MB 的 base64..." }]  // 包含在 session 中
  }
}

// 保存流程
saveSession() {
  const snapshot = {
    prompt: state.prompt,
    imageResult: state.originalImageResult  // ← 包含 26 MB 图像
  }
  await db.put('session', snapshot)  // ← 每次都保存 26 MB
}

// 触发时机
- 用户生成图像 → 保存
- 用户切换标签页 → 保存 ← 包含图像！
- 用户切换回来 → 保存 ← 包含图像！
- 用户关闭页面 → 保存 ← 包含图像！
```

**问题：**
```
时间线：
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

10:00  生成图像1 (26 MB)
       ↓ saveSession()
       ↓ 写入 001.ldb (26 MB)

10:05  切换标签页
       ↓ saveSession()
       ↓ 写入 002.ldb (26 MB) ← 重复保存图像1！

10:10  切换回来
       ↓ saveSession()
       ↓ 写入 003.ldb (26 MB) ← 又重复保存图像1！

10:15  关闭页面
       ↓ saveSession()
       ↓ 写入 004.ldb (26 MB) ← 又重复保存图像1！

10:20  重新打开，生成图像2 (26 MB)
       ↓ saveSession()
       ↓ 写入 005.ldb (26 MB) ← 图像2

10:25  又切换标签页
       ↓ saveSession()
       ↓ 写入 006.ldb (26 MB) ← 重复保存图像2！

... 重复 42 次 ...

总计：42 个文件 × 26 MB = 1.1 GB ❌
```

---

### 分离模式（解决）

```typescript
// ✅ Session 只保存引用
interface SessionState {
  originalPrompt: string
  originalImageRef: {
    imageId: "img_123456"  // ← 只保存 ID (20 字节)
  }
}

// 图像单独存储
interface ImageRecord {
  id: string
  data: {
    images: [{ b64: "2-3 MB 的 base64..." }]
  }
  createdAt: number
}

// 保存流程（分离）
saveSession() {
  const snapshot = {
    prompt: state.prompt,
    imageRef: state.originalImageRef  // ← 只有 ID，几 KB
  }
  await db.put('session', snapshot)  // ← 只保存几 KB
}

saveImage(data) {
  const imageRecord = {
    id: `img_${Date.now()}`,
    data: data,  // ← 26 MB
    createdAt: Date.now()
  }
  await db.put('images', imageRecord)  // ← 只在生成新图像时调用
}
```

**解决：**
```
时间线：
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

10:00  生成图像1 (26 MB)
       ↓ saveImage()  ← 只调用1次
       ↓ 写入 images:001.ldb (26 MB)
       ↓ saveSession()
       ↓ 写入 session:001.ldb (5 KB) ← 只保存 ID

10:05  切换标签页
       ↓ saveSession()  ← 没有 saveImage()
       ↓ 写入 session:002.ldb (5 KB) ← 又是 ID，但很小！

10:10  切换回来
       ↓ saveSession()
       ↓ 写入 session:003.ldb (5 KB) ← 很小！

10:15  关闭页面
       ↓ saveSession()
       ↓ 写入 session:004.ldb (5 KB) ← 很小！

10:20  重新打开，生成图像2 (26 MB)
       ↓ saveImage()  ← 只调用1次
       ↓ 写入 images:002.ldb (26 MB)
       ↓ saveSession()
       ↓ 写入 session:005.ldb (5 KB)

10:25  又切换标签页
       ↓ saveSession()
       ↓ 写入 session:006.ldb (5 KB) ← 很小！

... 重复 42 次 ...

Session 保存：42 个文件 × 5 KB = 210 KB ✅
图像保存：2 个文件 × 26 MB = 52 MB ✅
总计：210 KB + 52 MB = 52.2 MB ✅
```

---

## 关键对比

### 保存频率

```
当前模式：
- Session 保存：42 次
- 每次包含图像：42 次
- 图像数据写入：42 次

分离模式：
- Session 保存：42 次
- 每次只包含 ID：42 次
- 图像数据写入：2 次（只在生成新图像时）
```

### 数据写入量

```
当前模式：
42 次 × 26 MB = 1,092 MB (1.1 GB) ❌

分离模式：
Session：42 次 × 5 KB = 210 KB ✅
图像：2 次 × 26 MB = 52 MB ✅
总计：52.2 MB ✅

减少：95%+ 🎉
```

---

## Compaction 为什么能成功？

### 当前模式（失败）

```
尝试合并 42 个 session 文件：
├── 001.ldb (26 MB) ← 包含图像1
├── 002.ldb (26 MB) ← 包含图像1
├── 003.ldb (26 MB) ← 包含图像1
├── ...
└── 042.ldb (26 MB) ← 包含图像2

需要读取：42 × 26 MB = 1,092 MB
需要内存：3-4 倍（去重、合并）= 3-4 GB
浏览器限制：~100-500 MB
结果：内存不足/超时 → Compaction 失败 ❌
```

### 分离模式（成功）

```
尝试合并 42 个 session 文件：
├── 001.ldb (5 KB) ← 只有 ID "img_123"
├── 002.ldb (5 KB) ← 只有 ID "img_123"
├── 003.ldb (5 KB) ← 只有 ID "img_123"
├── ...
└── 042.ldb (5 KB) ← 只有 ID "img_456"

需要读取：42 × 5 KB = 210 KB
需要内存：3-4 倍 = 1 MB 左右
浏览器限制：~100-500 MB
结果：轻松完成 ✅

Compaction：
1. 快速读取所有文件（210 KB）
2. 合并去重（都在内存中）
3. 写入新文件（5 KB）
4. 删除 42 个旧文件 ✅

最终：只有 1 个最新的 session 文件（5 KB）
```

---

## 核心原理

### 1. 不同的生命周期

```
Session：高频更新，低频读取
- 每次切换标签页都保存
- 但数据很小（几 KB）
- Compaction 轻松处理

Images：低频更新，按需读取
- 只在生成新图像时保存
- 数据较大（26 MB）
- 但数量可控（假设 10 张 = 260 MB）
```

### 2. 独立的 Compaction

```
Session Store：
- 小文件，高频率
- Compaction 每秒都在运行
- 随时保持干净状态

Images Store：
- 大文件，低频率
- Compaction 偶尔运行
- 总量可控（260 MB）
```

### 3. 故障隔离

```
当前模式：
- 图像导致 Session 文件过大
- Session Compaction 失败
- 整个数据库崩溃 ❌

分离模式：
- Session 文件很小 → Compaction 正常 ✅
- 图像文件独立 → 即使 Compaction 慢，也不影响 Session ✅
- 故障隔离 ✅
```

---

## 类比

### 当前模式

```
就像：每次搬家都把所有家具打包
- 第1次搬家：打包所有家具（26 MB）
- 第2次搬家：又打包所有家具（26 MB）
- 第3次搬家：又打包所有家具（26 MB）
...
- 第42次搬家：还是打包所有家具（26 MB）

结果：搬家公司崩溃 ❌
```

### 分离模式

```
就像：只打包"家具清单"，家具放在仓库
- 第1次搬家：打包清单（5 KB）+ 家运到仓库（26 MB）
- 第2次搬家：打包清单（5 KB）← 清单很小！
- 第3次搬家：打包清单（5 KB）← 清单很小！
...
- 第42次搬家：打包清单（5 KB）← 清单很小！

结果：
- 清单：42 × 5 KB = 210 KB ✅
- 仓库：只有真正搬家的 2 次的家具 = 52 MB ✅
```

---

## 总结

### 为什么分离能解决？

| 维度 | 当前模式 | 分离模式 |
|------|----------|----------|
| Session 保存大小 | 26 MB | 5 KB |
| Session 保存次数 | 42 次 | 42 次 |
| Session 总写入量 | 1,092 MB | 210 KB |
| 图像保存次数 | 42 次（冗余） | 2 次（实际） |
| 图像总写入量 | 1,092 MB | 52 MB |
| Compaction 内存需求 | 3-4 GB | 1 MB |
| Compaction 结果 | 失败 ❌ | 成功 ✅ |

### 核心原理

**不是"分离"本身解决问题，而是：**
1. Session 不再包含大数据 → 文件小
2. 文件小 → Compaction 能成功
3. Compaction 成功 → 旧文件被删除
4. 旧文件被删除 → 数据库不累积
5. 图像单独保存 → 总量可控（260 MB vs 1.1 GB）

**关键是：减少写入频率（42次 → 2次），而不是分离！**

### 1.4 IndexedDB 损坏分析
# 🔴 IndexedDB 数据库损坏问题分析报告

## 问题现象
- 打开 IndexedDB 数据库导致浏览器崩溃
- 应用在有历史数据的情况下无法启动
- 连简单的 `indexedDB.open()` 操作都会触发崩溃

## 🔍 根本原因分析

### 1. **危险的序列化操作**

**问题代码** (所有 session store):
```typescript
const saveSession = async () => {
  const snapshot = JSON.stringify(state.value)  // ❌ 没有错误处理
  await $services.preferenceService.set('session/v1/basic-system', snapshot)
}
```

**风险点**:
- 如果 `state.value` 包含循环引用 → `JSON.stringify` 抛出错误 → 错误被吞掉 → 写入不完整数据
- 如果 `state.value` 包含超大对象（> 100MB）→ 内存溢出 → 浏览器崩溃
- 没有大小限制检查
- 没有循环引用检测

### 2. **可能的并发写入冲突**

虽然 `useSessionManager.ts` 已修复为顺序保存，但：
- 页面卸载时的 `beforeunload` 事件可能触发多次 `saveAllSessions`
- 如果用户快速刷新/关闭页面，可能同时触发多个保存操作
- IndexedDB 事务可能冲突，导致数据库损坏

### 3. **testResults 可能包含超大对象**

**问题场景**:
```typescript
// useBasicSystemSession.ts
state.value.testResults = results  // 可能包含完整的输出文本
```

如果用户测试了很长的输出（如 GPT-4 的长回答）：
- 单个 testResult 可能 1-5 MB
- 多次测试累积可能达到 50-100 MB
- `JSON.stringify` 时内存暴涨

### 4. **没有数据清理机制**

- 历史测试数据一直累积
- 没有大小上限检查
- 没有定期清理旧数据

## 🛠️ 解决方案

### 立即修复 (高优先级)

1. **添加安全的序列化函数**
```typescript
function safeStringify(obj: any, maxSize: number = 10 * 1024 * 1024): string | null {
  try {
    // 检测循环引用
    const seen = new WeakSet();
    const jsonString = JSON.stringify(obj, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }
      return value;
    });

    // 检查大小
    if (jsonString.length > maxSize) {
      console.error(`数据过大: ${jsonString.length} 字节 (限制: ${maxSize})`);
      return null;
    }

    return jsonString;
  } catch (error) {
    console.error('序列化失败:', error);
    return null;
  }
}
```

2. **限制 testResults 大小**
```typescript
const updateTestResults = (results: TestResults | null) => {
  if (!results) return;

  // 限制文本长度
  const MAX_LENGTH = 50000; // 50KB
  if (results.originalResult?.length > MAX_LENGTH) {
    results.originalResult = results.originalResult.slice(0, MAX_LENGTH) + '...[截断]';
  }
  if (results.optimizedResult?.length > MAX_LENGTH) {
    results.optimizedResult = results.optimizedResult.slice(0, MAX_LENGTH) + '...[截断]';
  }

  state.value.testResults = results;
}
```

3. **添加保存前的验证**
```typescript
const saveSession = async () => {
  const snapshot = safeStringify(state.value);
  if (!snapshot) {
    console.error('[BasicSystemSession] 序列化失败，跳过保存');
    return;
  }

  try {
    await $services.preferenceService.set('session/v1/basic-system', snapshot);
  } catch (error) {
    console.error('[BasicSystemSession] 保存会话失败:', error);
  }
}
```

4. **添加定期清理**
```typescript
// 清理超过 7 天的测试结果
const cleanupOldData = () => {
  const now = Date.now();
  const WEEK = 7 * 24 * 60 * 60 * 1000;

  if (state.value.lastActiveAt && (now - state.value.lastActiveAt) > WEEK) {
    state.value.testResults = null;
    state.value.testContent = '';
  }
}
```

### 中期优化

1. **数据分片存储**
   - 将 testResults 单独存储
   - 只保留最近 N 条记录
   - 使用 IndexedDB 的 auto-increment key

2. **添加数据压缩**
   - 使用 LZString 或类似库压缩数据
   - 可以减少 50-80% 的存储空间

3. **添加数据库健康检查**
   - 启动时检查数据大小
   - 如果过大，提示用户清理
   - 提供清理按钮

## 📊 诊断结果更新

### 实际发现（2026-01-07）

✅ **已确认数据库状态：**
- 数据库总大小：**2.4 GB**（正常应该 < 100 MB）
- 单个 .ldb 文件：26-27 MB（共 40+ 个文件）
- 文件结构完整，**不是损坏，而是数据过载**

✅ **根本原因确认：**

1. **自动保存机制过于频繁**
   - 每次测试结果变化 → 自动保存
   - 每次切换标签页（visibilitychange）→ 自动保存
   - 每次关闭页面（pagehide）→ 自动保存

2. **保存完整 state，没有过滤**
   ```typescript
   // useBasicSystemSession.ts:219
   const snapshot = JSON.stringify(state.value)  // ❌ 包含所有 testResults
   ```

3. **没有任何大小限制**
   - ❌ 没有检查 testResults 的大小
   - ❌ 没有截断超长文本
   - ❌ 没有限制字段长度

4. **没有清理机制**
   ```bash
   grep -r "清理\|cleanup\|clean" packages/ui/src/stores/session
   # 结果：No matches found ❌
   ```

详细分析见：`docs/workspace/why-data-accumulates.md`

## 📊 下一步行动

1. ✅ 创建了 `find-db.html` - 帮助用户找到数据库文件
2. ✅ 创建了 `db-repair.html` - 数据库修复和清理工具
3. ✅ 分析了数据累积的根本原因
4. ⏳ 用户使用修复工具清理数据库
5. ⏳ 实施预防措施（数据大小限制、自动清理）

## 🔗 相关文件

- `packages/ui/src/stores/session/useBasicSystemSession.ts:211`
- `packages/ui/src/stores/session/useBasicUserSession.ts`
- `packages/ui/src/stores/session/useProVariableSession.ts`
- `packages/ui/src/stores/session/useProMultiMessageSession.ts`
- `packages/ui/src/stores/session/useImageText2ImageSession.ts`
- `packages/ui/src/stores/session/useImageImage2ImageSession.ts`
- `packages/ui/src/stores/session/useSessionManager.ts:324` (saveAllSessions)

### 1.5 图像存储解决方案
# 📋 图像存储优化方案

## 问题分析

当前实现：直接在 session 中存储图像的 base64（2-3 MB），导致：
- 单次保存 26 MB
- 42 次保存 = 1.1 GB
- Compaction 失败
- 数据库崩溃

## 推荐方案

### ✅ 方案1：图像单独存储（推荐）

#### 实现思路

```
1. 创建独立的 images object store
2. Session 只保存图像 ID（字符串引用）
3. 图像和 session 分离存储
4. 定期清理旧的图像
```

#### 代码结构

```typescript
// 1. 创建 ImageStorageService
class ImageStorageService {
  private readonly IMAGE_STORE = 'images'

  // 保存图像，返回 ID
  async saveImage(imageResult: ImageResult): Promise<string> {
    const db = await this.openDB()
    const id = `img_${Date.now()}_${Math.random().toString(36).slice(2)}`

    await db.put(this.IMAGE_STORE, {
      id,
      data: imageResult,        // 完整的图像数据
      createdAt: Date.now()
    })

    return id
  }

  // 读取图像
  async getImage(id: string): Promise<ImageResult | null> {
    const db = await this.openDB()
    const record = await db.get(this.IMAGE_STORE, id)
    return record?.data || null
  }

  // 清理旧图像（保留最近 N 张）
  async cleanupOldImages(keepCount: number = 10): Promise<void> {
    const db = await this.openDB()
    const tx = db.transaction(this.IMAGE_STORE, 'readwrite')
    const store = tx.objectStore(this.IMAGE_STORE)

    // 获取所有图像，按时间排序
    const allImages = await store.getAll()
    allImages.sort((a, b) => a.createdAt - b.createdAt)

    // 删除旧的
    const toDelete = allImages.slice(0, -keepCount)
    for (const img of toDelete) {
      await store.delete(img.id)
    }
  }
}

// 2. 修改 ImageResult 接口
interface ImageResultRef {
  imageId: string          // 只保存 ID
  thumbnail?: string      // 缩略图（可选，10KB以内）
}

// 3. 修改 Session
interface ImageText2ImageSessionState {
  // ...其他字段
  originalImageResult: ImageResultRef | null    // 只保存引用
  optimizedImageResult: ImageResultRef | null   // 只保存引用
}

// 4. 保存图像时的流程
async function handleImageGenerated(result: ImageResult) {
  // 保存到独立的图像存储
  const imageId = await imageStorageService.saveImage(result)

  // Session 只保存引用
  session.updateOriginalImageResult({
    imageId,
    thumbnail: result.images[0].b64?.slice(0, 1000)  // 只保存前1KB作为预览
  })
}
```

#### 优点
✅ Session 数据小（几 KB）
✅ 图像独立管理，可单独清理
✅ 不影响 Compaction
✅ 可以实施 LRU 缓存策略

#### 缺点
⚠️ 需要额外的清理逻辑
⚠️ 增加复杂度

---

### ✅ 方案2：限制图像数量 + 覆盖策略

#### 实现思路

```
1. Session 中保存图像，但只保留最近 N 张
2. 超过限制时，删除最早的
3. 总大小可控
```

#### 代码实现

```typescript
class ImageSessionManager {
  private readonly MAX_IMAGES = 3  // 最多保留3张图像
  private readonly MAX_IMAGE_SIZE = 500 * 1024  // 单张最大 500KB

  async updateImageResult(
    session: ImageText2ImageSessionState,
    newResult: ImageResult
  ): Promise<void> {
    // 1. 限制单张图像大小
    const limitedResult = this.limitImageSize(newResult)

    // 2. 获取现有图像列表
    const imageList = session.imageList || []

    // 3. 添加新图像
    imageList.push({
      ...limitedResult,
      id: `img_${Date.now()}`,
      createdAt: Date.now()
    })

    // 4. 只保留最近 N 张
    const keepCount = Math.min(imageList.length, this.MAX_IMAGES)
    const trimmedList = imageList.slice(-keepCount)

    // 5. 更新 session
    session.imageList = trimmedList

    // 6. 如果需要，清理 IndexedDB 中的旧图像
    await this.cleanupOldImages(imageList, trimmedList)
  }

  private limitImageSize(result: ImageResult): ImageResult {
    return {
      ...result,
      images: result.images.map(img => ({
        ...img,
        // 如果 base64 太大，截断或丢弃
        b64: img.b64 && img.b64.length > this.MAX_IMAGE_SIZE
          ? undefined
          : img.b64,
        // 优先使用 URL
        url: img.url || img.b64  // 如果有 b64，生成 Blob URL
      }))
    }
  }
}

// 修改 Session 接口
interface ImageText2ImageSessionState {
  // 不再是 single result，而是 list
  imageList: ImageResultItem[]
  currentImageId?: string  // 当前选中的图像
}
```

#### 优点
✅ 实现相对简单
✅ 总大小可控（3 × 500KB = 1.5 MB）
✅ 不需要额外的 object store

#### 缺点
⚠️ 丢失历史图像
⚠️ 用户体验可能受影响

---

### ✅ 方案3：只保存 URL，不保存 base64

#### 实现思路

```
1. 图像 API 通常返回 URL（如 OpenAI 的临时 URL）
2. 只保存 URL，不保存 base64
3. 如果需要持久化，让用户手动下载
```

#### 代码实现

```typescript
interface ImageResultItem {
  url?: string           // 优先使用 URL
  b64?: string           // ⚠️ 不保存 base64
  mimeType?: string
  expiresAt?: number     // URL 过期时间
}

// 保存时
async function handleImageGenerated(result: ImageResult) {
  // 只保存 URL，丢弃 base64
  const limitedResult = {
    ...result,
    images: result.images.map(img => ({
      url: img.url,
      mimeType: img.mimeType,
      b64: undefined  // ❌ 不保存 base64
    }))
  }

  session.updateOriginalImageResult(limitedResult)
}

// 显示时
function displayImage(imageRef: ImageResultItem) {
  if (imageRef.url) {
    // 使用 URL
    return <img src={imageRef.url} />
  } else if (imageRef.b64) {
    // 如果有 base64（旧数据兼容）
    return <img src={imageRef.b64} />
  } else {
    // 都没有，提示重新生成
    return <div>图像已过期，请重新生成</div>
  }
}
```

#### 优点
✅ 实现最简单
✅ Session 数据最小
✅ 完全避免大文件问题

#### 缺点
❌ URL 会过期（OpenAI 的 URL 1小时后失效）
❌ 用户关闭页面后，图像丢失
❌ 用户体验差

---

### ✅ 方案4：File System Access API（仅桌面版）

#### 实现思路

```
1. 使用 File System Access API
2. 让用户选择保存位置
3. 图像直接保存到用户磁盘
4. Session 只保存文件路径
```

#### 代码实现

```typescript
// 仅在 Electron/桌面应用中可用
async function saveImageToFile(result: ImageResult) {
  // 请求用户选择保存位置
  const fileHandle = await window.showSaveFilePicker({
    suggestedName: `image-${Date.now()}.png`,
    types: [{
      description: 'PNG Image',
      accept: {'image/png': ['.png']}
    }]
  })

  // 保存图像
  const blob = await fetch(result.images[0].url).then(r => r.blob())
  const writable = await fileHandle.createWritable()
  await writable.write(blob)
  await writable.close()

  // Session 只保存文件路径
  session.updateOriginalImageResult({
    filePath: fileHandle.name,
    fileType: 'local'
  })
}
```

#### 优点
✅ 不占用浏览器存储
✅ 图像永久保存
✅ 大小不受限制

#### 缺点
❌ 只在支持 File System Access API 的浏览器可用
❌ 需要用户手动选择
❌ Web 版不支持

---

## 🎯 推荐实施步骤

### 短期（立即修复）

**方案2：限制图像数量**
- 只保留最近 3 张图像
- 限制单张 500 KB
- 总大小 < 1.5 MB
- 实施简单，立即见效

### 中期（优化体验）

**方案1：图像单独存储**
- 创建独立的 image store
- Session 只保存引用
- 实施 LRU 缓存
- 保留最近 10-20 张图像

### 长期（最佳体验）

**方案1 + 方案4 组合**
- Web 版：图像单独存储（IndexedDB）
- 桌面版：File System Access API
- 提供用户选择：自动管理 / 手动保存

## 📝 代码改动清单

### 必须修改的文件

1. `packages/core/src/services/image/types.ts`
   - 添加 `ImageResultRef` 接口

2. `packages/ui/src/stores/session/useImageText2ImageSession.ts`
   - 修改 `ImageText2ImageSessionState`
   - 改为只保存引用

3. `packages/ui/src/stores/session/useImageImage2ImageSession.ts`
   - 同上

4. `packages/core/src/services/storage/` (新增)
   - 创建 `ImageStorageService`

5. `packages/ui/src/components/.../ImageWorkspace.vue`
   - 修改保存/读取逻辑

## 🔧 实施优先级

### P0（立即）
- ✅ 方案2：限制图像数量到 3 张
- ✅ 限制单张图像 500 KB

### P1（本周）
- ✅ 方案1：创建 ImageStorageService
- ✅ 迁移到引用模式

### P2（下周）
- ✅ 添加清理逻辑
- ✅ 添加用户下载按钮
- ✅ 桌面版集成 File System Access API

---

## 总结

| 方案 | 复杂度 | 效果 | 推荐度 |
|------|--------|------|--------|
| 方案1：单独存储 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ 强烈推荐 |
| 方案2：限制数量 | ⭐⭐ | ⭐⭐⭐⭐ | ✅ 短期推荐 |
| 方案3：只保存URL | ⭐ | ⭐⭐ | ❌ 不推荐 |
| 方案4：文件系统 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ 桌面推荐 |

---

## 2. 模式术语迁移总结
# 模式术语统一迁移总结

## 📋 迁移概述

本次迁移旨在统一项目中的模式术语，将过时或语义不清的 `optimizationMode`、`contextMode`、`selectedOptimizationMode` 等表达，逐步对齐到 `functionMode`（一级功能模式）与 `subMode`（二级子模式）的设计，并确保各模式的子模式状态独立持久化。

说明：该文档保留在 `docs/workspace/` 作为“模式术语与迁移现状”的单点入口；其中的“待办/清理项”只保留仍然有效的内容，避免对过往实现阶段产生误导。

## 🎯 统一设计架构

### 核心概念
- **functionMode**: 一级功能模式 (`basic` | `pro` | `image`)
- **subMode**: 二级子模式，根据 functionMode 而定
  - 基础模式子模式 (`system` | `user`)
  - 上下文模式子模式 (`system` | `user`)
  - 图像模式子模式 (`text2image` | `image2image`)

### 统一管理函数
所有模式状态应使用 `packages/ui/src/composables/mode/` 下的函数：

```typescript
// 功能模式管理
useFunctionMode(services) // { functionMode, setFunctionMode, ... }

// 子模式管理（独立持久化）
useBasicSubMode(services)  // 基础模式子模式
useProSubMode(services)    // 上下文模式子模式
useImageSubMode(services)  // 图像模式子模式

// 只读访问（无需 services）
useCurrentMode()           // { functionMode, proSubMode, isBasicMode, ... }
```

## ✅ 当前实现现状（已落地）

### 1) 主装配位置从 Web/Extension App.vue 收敛到 UI 主组件

- `packages/web/src/App.vue`、`packages/extension/src/App.vue` 目前仅作为壳组件渲染 UI 主应用。
- 真实的模式状态管理与装配已收敛到：
  - `packages/ui/src/components/app-layout/PromptOptimizerApp.vue`

### 2) 子模式持久化已实现，且 `selectedOptimizationMode` 已改为 computed（非独立状态源）

- `PromptOptimizerApp.vue` 使用 `useFunctionMode` + `useBasicSubMode/useProSubMode/useImageSubMode` 管理状态，并做独立持久化。
- `selectedOptimizationMode` 不再是独立 `ref`，而是从 subMode 推导的 `computed`（兼容旧接口/props 形态）。

## ✅ 已完成的迁移

### 1. Composables 参数统一
- **usePromptOptimizer**: `selectedOptimizationMode` → `optimizationMode`
- **usePromptTester**: `selectedOptimizationMode` → `optimizationMode`
- **useContextManagement**: 添加 @deprecated 标记

### 2. 内部变量名统一
- `usePromptTester.ts` 中所有 `selectedOptimizationMode.value` → `optimizationMode.value`

### 3. 文档和注释更新
- 为迁移的参数添加 @deprecated 标记
- 更新 JSDoc 注释，说明统一使用 subMode 概念
- 在 `PromptOptimizerApp.vue` 中保留必要的兼容性注释（以反映真实装配位置）

## 🔍 仍需迁移的区域

### 高优先级（清理与一致性）
1. **逐步移除命名上的“误导”**
   - `selectedOptimizationMode` 虽已是 computed，但命名仍容易让人误以为它是“用户选择的优化模式状态源”。
   - 建议方向：
     - 对外仍可维持 `optimizationMode` props（避免大范围破坏性改动）
     - 内部逐步改为更准确的命名（例如 `currentOptimizationMode` / `derivedOptimizationMode`），并集中在 UI 层统一出口

2. **组件/模板中的旧名收敛**
   - 将零散的 `optimizationMode/contextMode/selectedOptimizationMode` 相关命名逐步统一为“functionMode/subMode 派生值”的表达（不强求一次性替换，但要避免继续引入新旧混用）

### 中优先级
3. **类型定义中的过时术语**
   - 检查 `packages/ui/src/types/components.ts`
   - 检查 `packages/core/src/types/` 相关文件

4. **测试文件中的术语**
   - 更新测试用例中的变量名和断言

### 低优先级
5. **国际化文件**
   - 检查 `packages/ui/src/i18n/locales/` 中的键名
   - 确保文档和帮助文本使用统一术语

## 🚀 迁移建议

### 重点方向：以“不破坏行为”为前提做术语清理
1. 将“状态源”限定为 `functionMode + 各自 subMode`（已完成）
2. 将“对外接口/props”保持可用，同时逐步减少旧命名在内部传播（进行中）
3. 等调用方与文档一致后，再移除 `@deprecated` 标记（后续清理）

## 📝 迁移检查清单

- [x] 更新 usePromptOptimizer 参数
- [x] 更新 usePromptTester 参数
- [x] 更新 useContextManagement 接口
- [x] 统一内部变量名
- [x] 添加 @deprecated 标记
- [x] 模式管理收敛到 PromptOptimizerApp（由 subMode 推导 optimizationMode）
- [ ] 更新所有 Vue 模板/props 命名（逐步收敛，避免引入新旧混用）
- [ ] 更新类型定义
- [ ] 更新测试文件
- [ ] 验证功能完整性
- [ ] 更新文档

## 🎯 预期收益

1. **术语统一**: 消除混淆，提高代码可读性
2. **架构清晰**: 明确的层级关系（functionMode → subMode）
3. **状态隔离**: 不同功能模式的子模式独立持久化
4. **开发体验**: 统一的 API 和清晰的使用模式

## 🔗 相关文档

- [功能模式设计文档](../archives/126-submode-persistence/README.md)
- [模式管理 API](../../../packages/ui/src/composables/mode/index.ts)
- [上下文 UI 改造与变量系统重构（归档）](../archives/128-context-ui-and-variable-system-refactor/README.md)

---

**文档版本**: v1.0
**创建时间**: 2025-10-31
**最近更新**: 2025-12-19
**维护者**: 用户

---

## 3. 提示词文档
# 角色设定
你是一个基于E4-D方法论的智能提示词优化引擎，实现分解→诊断→开发→交付的全流程自动化优化。

# 核心参数配置
**基础参数**
- 原始提示词：{{originalPrompt}}
- 目标平台：{{targetPlatform}}（GPT-4/Claude-3/Gemini-Pro/通用）
- 优化模式：{{optimizationMode}}（DETAIL/BASIC/AUTO）

**E4-D专项参数**
- 分解深度：{{decomposeDepth}}（浅层/标准/深度）
- 诊断维度：{{diagnoseDimensions}}（清晰度/完整性/结构性）
- 开发策略：{{developStrategy}}（思维链/少样本/多视角/混合）
- 交付标准：{{deliverStandard}}（基础/专业/企业级）

**扩展参数**
- 任务类型：{{taskType}}（创意生成/技术分析/教育解释/复杂推理）
- 输出格式：{{outputFormat}}（Markdown/JSON/纯文本/结构化报告）
- 语言风格：{{languageStyle}}（专业/通俗/学术/商务）
- 迭代上限：{{maxIterations}}（1-5轮，默认3轮）

# E4-D自动化优化流程
**阶段一：分解（Decompose）**
- 语义解构：解析{{originalPrompt}}的核心意图与隐含需求
- 要素提取：识别关键实体、操作指令、约束条件
- 边界划定：根据{{decomposeDepth}}确定分析粒度

**阶段二：诊断（Diagnose）**
- 多维评估：基于{{diagnoseDimensions}}进行缺陷量化分析
- 问题定位：识别模糊点、歧义项、结构缺陷
- 优先级排序：按影响程度分类处理优化重点

**阶段三：开发（Develop）**
- 策略匹配：根据{{developStrategy}}选择最优架构模式
- 模板注入：动态绑定标准化优化模板
- 平台适配：针对{{targetPlatform}}注入兼容层

**阶段四：交付（Deliver）**
- 质量验证：按照{{deliverStandard}}进行输出检验
- 格式标准化：确保符合{{outputFormat}}要求
- 迭代判断：未达阈值时自动触发下一轮E4-D循环

# 质量保障机制
**自动评估指标**
- 意图达成率（≥95%）
- 结构完整性（≥90%）
- 平台兼容性（≥95%）
- 风格一致性（≥90%）

**迭代优化逻辑**
- 每轮E4-D流程后重新评估质量得分
- 根据薄弱环节调整下一轮优化策略
- 达到{{qualityThreshold}}或{{maxIterations}}后终止

# 输出交付物
**最终产物包含**
- 优化后的提示词（标记E4-D迭代版本）
- E4-D流程报告（各阶段执行详情）
- 质量认证证书（四维度达标状态）
- 参数使用摘要（所有配置参数效果分析）

---

## 4. 代码审查提示词评估
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
- `packages/ui/src/components/basic-mode/BasicSystemWorkspace.vue`
- `packages/ui/src/components/basic-mode/BasicUserWorkspace.vue`
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
