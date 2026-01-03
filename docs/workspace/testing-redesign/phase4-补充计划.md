# Phase 4 测试用例补充计划

## 当前状态

**已完成** (2026-01-09):
- ✅ VCR 基础设施（录制/回放）
- ✅ UI 错误检测门禁（Vitest + Playwright）
- ✅ 基础冒烟测试（6 个集成测试 + 3 个 Store 单元测试 + 1 个 E2E 冒烟）
- ✅ 门禁验证通过（257 个测试，执行时间 < 1 分钟）

**待补充**:
- ⏳ 完整工作流测试（端到端场景）
- ⏳ LLM 服务集成测试（多提供商、流式响应）
- ⏳ Session Store 集成测试（模式切换、并发保护）
- ⏳ 图像生成+历史收藏测试

---

## 优先级分析

### 🔴 P0 - 高优先级（核心功能，必须补充）

#### 1. LLM 服务集成测试
**重要性**: ⭐⭐⭐⭐⭐
- **原因**: LLM 是核心依赖，直接影响所有优化和测试功能
- **风险**: 多提供商切换、流式响应异常、错误重试失败
- **已有基础**: VCR 系统已完成，可快速录制 fixtures

**测试用例**:
```typescript
// packages/core/tests/integration/llm-service.spec.ts
describe('LLM Service Integration', () => {
  describe('Multi-provider support', () => {
    test('OpenAI provider works with VCR', async () => {})
    test('Gemini provider works with VCR', async () => {})
    test('DeepSeek provider works with VCR', async () => {})
    test('Custom provider works with VCR', async () => {})
  })

  describe('Streaming response', () => {
    test('Stream chunks are correctly parsed', async () => {})
    test('Stream errors are handled gracefully', async () => {})
    test('Stream abort works correctly', async () => {})
  })

  describe('Error handling', () => {
    test('Rate limit errors trigger retry', async () => {})
    test('Network errors are surfaced to UI', async () => {})
    test('Timeout errors are handled', async () => {})
  })

  describe('Model switching', () => {
    test('Switching between models preserves state', async () => {})
    test('Model parameters are correctly applied', async () => {})
  })
})
```

**预估时间**: 2-3 天

---

#### 2. Basic-System/User 完整工作流测试
**重要性**: ⭐⭐⭐⭐⭐
- **原因**: Basic 模式是最常用功能，需要端到端验证
- **风险**: 优化结果丢失、测试结果不同步、迭代逻辑错误
- **已有基础**: 冒烟测试已通过，需扩展为完整场景

**测试用例**:
```typescript
// packages/ui/tests/integration/basic-complete-workflow.spec.ts
describe('Basic-System Complete Workflow', () => {
  test('End-to-end: optimize → test → iterate', async () => {
    // 1. 输入 prompt
    // 2. 点击优化，等待 LLM 响应
    // 3. 验证优化结果显示
    // 4. 测试原始和优化后的 prompt
    // 5. 验证测试结果对比
    // 6. 迭代优化
    // 7. 验证迭代历史记录
  })

  test('State persistence after page reload', async () => {})
  test('Error recovery when LLM fails', async () => {})
})

describe('Basic-User Complete Workflow', () => {
  test('End-to-end: input → optimize → test with variables', async () => {})
  test('Variable replacement works correctly', async () => {})
})
```

**预估时间**: 2-3 天

---

### 🟡 P1 - 中优先级（增强测试覆盖）

#### 3. Session Store 集成测试
**重要性**: ⭐⭐⭐⭐
- **原因**: Store 是状态管理核心，模式切换时易出错
- **风险**: 跨模式状态污染、持久化数据丢失
- **已有基础**: 3 个 Store 单元测试已完成

**测试用例**:
```typescript
// packages/ui/tests/integration/session-store-switching.spec.ts
describe('Session Store Mode Switching', () => {
  test('Switch from Basic to Context preserves common state', async () => {})
  test('Switch to Image mode isolates image-specific state', async () => {})
  test('Rapid mode switching does not cause state corruption', async () => {})
})

// packages/ui/tests/integration/session-store-persistence.spec.ts
describe('Session Store Persistence', () => {
  test('State survives page reload', async () => {})
  test('Migration from old storage format works', async () => {})
  test('Concurrent tabs handle storage conflicts', async () => {})
})
```

**预估时间**: 1-2 天

---

#### 4. Context 模式完整工作流
**重要性**: ⭐⭐⭐⭐
- **原因**: Context 模式涉及多轮对话和变量管理，复杂度高
- **风险**: 变量替换错误、对话历史丢失、链映射错误
- **已有基础**: 4 个冒烟测试已通过

**测试用例**:
```typescript
// packages/ui/tests/integration/context-complete-workflow.spec.ts
describe('Context-System Multi-turn Conversation', () => {
  test('End-to-end: add messages → optimize → test → iterate', async () => {})
  test('V0 comparison works correctly', async () => {})
  test('Variable merging from all messages works', async () => {})
})

describe('Context-User Variable Management', () => {
  test('Custom variables CRUD operations', async () => {})
  test('Missing variable detection and auto-creation', async () => {})
  test('Variable preview updates in real-time', async () => {})
})
```

**预估时间**: 2-3 天

---

### 🟢 P2 - 低优先级（可选增强）

#### 5. 图像生成+历史收藏
**重要性**: ⭐⭐⭐
- **原因**: 图像功能相对独立，现有冒烟测试已覆盖核心逻辑
- **风险**: ImageStorage 大文件处理、IndexedDB 限制
- **已有基础**: Image 生成逻辑冒烟测试已完成

**测试用例**:
```typescript
// packages/core/tests/unit/services/image-storage.spec.ts
describe('ImageStorageService', () => {
  test('Store and retrieve base64 images', async () => {})
  test('Handle IndexedDB quota exceeded', async () => {})
  test('Cleanup old images correctly', async () => {})
})

// packages/ui/tests/integration/image-history-favorites.spec.ts
describe('Image History & Favorites', () => {
  test('History records are saved and displayed', async () => {})
  test('Favorite management (add/remove/filter)', async () => {})
  test('Category and tag filtering works', async () => {})
})
```

**预估时间**: 2-3 天

---

## 补充策略

### 🎯 渐进式补充（推荐）

**Week 1** (高优先级):
- Day 1-3: LLM 服务集成测试（P0）
- Day 4-6: Basic 完整工作流测试（P0）

**Week 2** (中优先级):
- Day 7-8: Session Store 集成测试（P1）
- Day 9-11: Context 完整工作流测试（P1）

**Week 3+** (可选):
- Day 12-14: 图像生成+历史收藏测试（P2）
- 后续: 持续优化和增强

### ⚡ 快速补充（最小可行）

仅补充 P0 高优先级测试：
- LLM 服务集成测试（2-3 天）
- Basic 完整工作流测试（2-3 天）

**理由**:
- 当前 257 个测试已覆盖核心冒烟场景
- P0 测试补充后，核心功能测试覆盖率可达 80%+
- P1/P2 测试可按需渐进补充

---

## 执行建议

### ✅ 立即行动

1. **先提交当前进度**
   ```bash
   git commit -m "test: 建立测试基础设施（VCR + 错误门禁 + 冒烟测试）"
   ```

2. **创建 Phase 4 补充分支**
   ```bash
   git checkout -b feat/phase4-test-coverage
   ```

3. **按优先级逐个实现测试**
   - 每完成一个测试套件，立即提交
   - 保持门禁测试始终通过

### 🚫 避免过度工程

- ❌ 不要追求 100% 覆盖率
- ❌ 不要为边缘场景写过多测试
- ✅ 专注于 P0 核心功能和高风险场景
- ✅ 利用 VCR 减少真实 API 调用成本

---

## 成功标准

**最小可行标准** (MVP):
- ✅ LLM 服务集成测试完成（多提供商 + 流式响应）
- ✅ Basic 完整工作流测试完成（优化 + 测试 + 迭代）
- ✅ 所有测试通过门禁
- ✅ 无 flaky tests

**理想标准** (Ideal):
- ✅ MVP 标准
- ✅ Session Store 集成测试完成
- ✅ Context 完整工作流测试完成
- ✅ 代码覆盖率 > 75%

---

## 下一步行动

1. ✅ **已完成**: 提交所有测试基础设施文件
2. ✅ **已完成**: 验证门禁测试通过
3. ⏳ **进行中**: 创建 Phase 4 补充计划（本文档）
4. 🔜 **待执行**: 实现 LLM 服务集成测试（P0）
5. 🔜 **待执行**: 实现 Basic 完整工作流测试（P0）

---

**最后更新**: 2026-01-09
**状态**: 补充计划已完成，待用户确认优先级
