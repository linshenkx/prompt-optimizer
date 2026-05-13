# 自定义参数 JSON/字符串格式切换设计

**日期：** 2026-05-13  
**状态：** 已批准

## 背景

用户在模型管理中为自定义参数输入 Python 风格的 JSON（如 `{"enable_thinking": False}`）时，vLLM 等 API 返回 400 错误，原因是该值被作为字符串发送，而 API 期望收到一个字典对象。

根本原因：`parseCustomValue()` 在尝试 `JSON.parse` 时，Python 风格的 `False`/`True`/`None` 不是合法 JSON，解析失败后回退为字符串存储。

## 目标

- 修复 Python 风格 JSON 解析失败导致的 API 400 错误
- 为自定义参数提供明确的 JSON / 字符串格式切换，让用户清楚知道值以何种类型发送
- 零新存储字段，向后完全兼容

## 不在范围内

- Schema 中已定义的内置参数（无需 toggle）
- 图像模型参数
- 新的数据库迁移或存储格式变更

---

## 方案设计

### 原则

奥卡姆剃刀：最小改动达成目标。Toggle 状态从存储值类型推导，无需额外字段。

### 改动文件（共 2 个）

---

### 1. `packages/core/src/services/model/parameter-utils.ts`

#### 新增辅助函数

```typescript
function normalizePythonLiterals(input: string): string {
  return input
    .replace(/\bTrue\b/g, 'true')
    .replace(/\bFalse\b/g, 'false')
    .replace(/\bNone\b/g, 'null')
}
```

#### 修改 `parseCustomValue` 中 `{`/`[` 开头的逻辑

**修改前（只有一次 JSON.parse）：**
```typescript
if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
  try { return JSON.parse(trimmed) } catch {}
}
```

**修改后（失败后 normalize 再重试）：**
```typescript
if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
  try { return JSON.parse(trimmed) } catch {}
  try { return JSON.parse(normalizePythonLiterals(trimmed)) } catch {}
}
```

---

### 2. `packages/ui/src/components/ModelParameterEditor.vue`

#### Toggle 状态推导

不新增 prop，toggle 状态从存储值类型计算得出：

```typescript
function isJsonMode(value: unknown): boolean {
  return value !== null && typeof value === 'object'
}
```

#### UI 结构（每个自定义参数行）

```
[参数名 tag]               [JSON] [字符串]
┌────────────────────────────────────────┐
│ textarea 内容                          │
└────────────────────────────────────────┘
  状态提示：已解析为 Object ✓ / 无效 JSON ✗ / 字符串
```

#### 切换逻辑

- **切换到 JSON**：对当前 textarea 内容调用 `parseCustomValue()`（已含 Python 规范化），若结果为 object/array 则存储该值，否则显示"无效 JSON"错误提示
- **切换到字符串**：将存储值转为 `JSON.stringify(value)` 或直接存为字符串，不再解析
- **用户修改 textarea 内容时**：按当前 toggle 状态决定如何处理（JSON 模式调用 `parseCustomValue`；字符串模式直接存为 string）

#### `getDisplayValue` 补充 object 分支

```typescript
// 已有 string-array、boolean、number 分支，补充：
if (value !== null && typeof value === 'object') {
  return JSON.stringify(value, null, 2)
}
```

---

## 数据流

```
用户输入 textarea
    ↓
按当前 toggle 状态处理
  JSON 模式  → parseCustomValue() → 含 Python 规范化 → 存为 object
  String 模式 → 直接存为 string
    ↓
paramOverrides: Record<string, unknown>
    ↓
API 请求时 spread 展开 → 正确类型发送
```

## 向后兼容性

- 现有配置无需迁移：object 类型值自动显示为 JSON 模式，其他类型显示为字符串模式
- `parseCustomValue` 的现有自动推断行为保持不变，仅对 `{`/`[` 开头的字符串增加了一次重试

## 成功标准

- `{"enable_thinking": False}` 输入后自动解析为 `{"enable_thinking": false}` object，测试连接不再报 400
- Toggle 切换到字符串模式时，值以原始字符串发送
- 无现有测试回归
