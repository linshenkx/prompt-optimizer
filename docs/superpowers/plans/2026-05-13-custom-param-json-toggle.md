# 自定义参数 JSON/字符串格式切换 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复自定义参数无法解析 Python 风格 JSON（`False`/`True`/`None`）导致 vLLM API 400 错误，并为自定义参数添加 JSON/字符串格式切换开关。

**Architecture:** 两层修复：核心层在 `parseCustomValue` 中加 Python→JSON 规范化重试；UI 层在 `ModelParameterEditor.vue` 的自定义参数行加格式切换按钮，用本地 `ref` 跟踪用户意图，`isJsonMode` computed 驱动显示。

**Tech Stack:** TypeScript, Vue 3 Composition API, Naive UI (NButton/NSpace/NText), vitest

---

## 文件总览

| 文件 | 操作 | 职责 |
|---|---|---|
| `packages/core/src/services/model/parameter-utils.ts` | 修改 | 新增 `normalizePythonLiterals`，修改 `parseCustomValue` |
| `packages/core/tests/unit/parameter-utils.test.ts` | 修改 | 新增 `parseCustomValue` 测试用例 |
| `packages/ui/src/i18n/locales/zh-CN/models.ts` | 修改 | 新增 4 个 i18n key |
| `packages/ui/src/i18n/locales/zh-TW/models.ts` | 修改 | 新增 4 个 i18n key |
| `packages/ui/src/i18n/locales/en-US/models.ts` | 修改 | 新增 4 个 i18n key |
| `packages/ui/src/components/ModelParameterEditor.vue` | 修改 | 自定义参数 toggle + 显示 + 处理逻辑 |

---

### Task 1: 修复 `parseCustomValue` - Python 字面量规范化

**Files:**
- Modify: `packages/core/src/services/model/parameter-utils.ts:40-47`
- Modify: `packages/core/tests/unit/parameter-utils.test.ts`

- [ ] **Step 1: 在测试文件顶部添加 `parseCustomValue` 的导入和失败测试**

打开 `packages/core/tests/unit/parameter-utils.test.ts`，在文件顶部的 import 行修改：

```typescript
import {
  mergeOverrides,
  parseCustomValue,
  splitOverridesBySchema,
  validateOverrides
} from '../../src/services/model/parameter-utils'
```

在 `describe('parameter-utils', () => {` 块最末尾（现有测试之后）追加：

```typescript
  describe('parseCustomValue', () => {
    it('parses standard JSON object', () => {
      expect(parseCustomValue('{"key": "value"}')).toEqual({ key: 'value' })
    })

    it('parses Python-style False/True/None in JSON object', () => {
      expect(parseCustomValue('{"enable_thinking": False}')).toEqual({ enable_thinking: false })
      expect(parseCustomValue('{"flag": True}')).toEqual({ flag: true })
      expect(parseCustomValue('{"val": None}')).toEqual({ val: null })
    })

    it('parses mixed Python/JSON literals', () => {
      expect(parseCustomValue('{"a": True, "b": False, "c": None}')).toEqual({
        a: true, b: false, c: null
      })
    })

    it('returns string when content is not valid JSON even after normalization', () => {
      expect(parseCustomValue('{broken')).toBe('{broken')
    })

    it('parses JSON array', () => {
      expect(parseCustomValue('[1, 2, 3]')).toEqual([1, 2, 3])
    })

    it('parses booleans, null, integers, floats', () => {
      expect(parseCustomValue('true')).toBe(true)
      expect(parseCustomValue('false')).toBe(false)
      expect(parseCustomValue('null')).toBe(null)
      expect(parseCustomValue('42')).toBe(42)
      expect(parseCustomValue('3.14')).toBe(3.14)
    })

    it('returns plain string for non-special input', () => {
      expect(parseCustomValue('hello world')).toBe('hello world')
    })
  })
```

- [ ] **Step 2: 运行测试，确认新用例失败**

```bash
cd packages/core && npx vitest run tests/unit/parameter-utils.test.ts
```

期望输出：`parseCustomValue` 的 "parses Python-style" 测试 FAIL，其余用例 PASS。

- [ ] **Step 3: 在 `parameter-utils.ts` 中新增辅助函数并修改解析逻辑**

在 `packages/core/src/services/model/parameter-utils.ts` 第 15 行（`export function parseCustomValue` 之前）插入：

```typescript
function normalizePythonLiterals(input: string): string {
  return input
    .replace(/\bTrue\b/g, 'true')
    .replace(/\bFalse\b/g, 'false')
    .replace(/\bNone\b/g, 'null')
}
```

将文件第 40-47 行（JSON 对象/数组解析块）替换为：

```typescript
  // JSON 对象或数组
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      return JSON.parse(trimmed)
    } catch {
      // 尝试规范化 Python 风格字面量后重试
    }
    try {
      return JSON.parse(normalizePythonLiterals(trimmed))
    } catch {
      // 解析失败，作为字符串处理
    }
  }
```

- [ ] **Step 4: 运行测试，确认全部通过**

```bash
cd packages/core && npx vitest run tests/unit/parameter-utils.test.ts
```

期望输出：所有测试 PASS，无 FAIL。

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/services/model/parameter-utils.ts packages/core/tests/unit/parameter-utils.test.ts
git commit -m "fix(core): normalize Python literals in parseCustomValue for JSON objects"
```

---

### Task 2: 添加 i18n 文案

**Files:**
- Modify: `packages/ui/src/i18n/locales/zh-CN/models.ts`
- Modify: `packages/ui/src/i18n/locales/zh-TW/models.ts`
- Modify: `packages/ui/src/i18n/locales/en-US/models.ts`

- [ ] **Step 1: 在 zh-CN `advancedParameters` 对象末尾追加新 key**

在 `packages/ui/src/i18n/locales/zh-CN/models.ts` 文件中，找到 `advancedParameters` 对象（约第 45 行）。在该对象的最后一个现有 key 之后，闭合括号 `}` 之前，追加：

```typescript
      "formatJson": "JSON",
      "formatString": "字符串",
      "parsedAsObject": "已解析为 Object ✓",
      "invalidJson": "无效 JSON，将作为字符串发送"
```

- [ ] **Step 2: 在 zh-TW `advancedParameters` 对象末尾追加新 key**

在 `packages/ui/src/i18n/locales/zh-TW/models.ts` 文件中，找到 `advancedParameters` 对象，在末尾追加：

```typescript
      "formatJson": "JSON",
      "formatString": "字串",
      "parsedAsObject": "已解析為 Object ✓",
      "invalidJson": "無效 JSON，將作為字串發送"
```

- [ ] **Step 3: 在 en-US `advancedParameters` 对象末尾追加新 key**

在 `packages/ui/src/i18n/locales/en-US/models.ts` 文件中，找到 `advancedParameters` 对象，在末尾追加：

```typescript
      "formatJson": "JSON",
      "formatString": "String",
      "parsedAsObject": "Parsed as Object ✓",
      "invalidJson": "Invalid JSON, will be sent as string"
```

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/i18n/locales/zh-CN/models.ts packages/ui/src/i18n/locales/zh-TW/models.ts packages/ui/src/i18n/locales/en-US/models.ts
git commit -m "feat(i18n): add custom param JSON/string format toggle keys"
```

---

### Task 3: 更新 `ModelParameterEditor.vue` - Toggle UI 与逻辑

**Files:**
- Modify: `packages/ui/src/components/ModelParameterEditor.vue`

- [ ] **Step 1: 在 `<script setup>` 中引入 `ref`、`watch` 并添加格式状态**

在 `ModelParameterEditor.vue` 第 258 行（`<script setup lang="ts">`）找到：

```typescript
import { computed, type PropType } from 'vue'
```

替换为：

```typescript
import { computed, ref, watch, type PropType } from 'vue'
```

在第 261 行找到：

```typescript
import { useMessage, createDiscreteApi, NAlert, NButton, NCheckbox, NForm, NFormItem, NInput, NInputNumber, NSelect, NSpace, NTag, NText } from 'naive-ui'
```

替换为：

```typescript
import { useMessage, createDiscreteApi, NAlert, NButton, NCheckbox, NForm, NFormItem, NInput, NInputNumber, NSelect, NSpace, NTag, NText } from 'naive-ui'
```

（naive-ui 导入保持不变，NButton 已经在里面了。）

在 `const emit = defineEmits<{...}>()` 之后（约第 285 行），追加以下内容：

```typescript
// 跟踪每个自定义参数的格式用户意图：'json' | 'string'
// 初始值从存储值类型推导；用户切换后记录显式选择
const customParamFormats = ref<Record<string, 'json' | 'string'>>({})

watch(
  () => props.paramOverrides,
  (overrides) => {
    for (const key of Object.keys(overrides)) {
      if (!schemaMap.value.has(key) && !(key in customParamFormats.value)) {
        const val = overrides[key]
        customParamFormats.value[key] = (val !== null && typeof val === 'object') ? 'json' : 'string'
      }
    }
  },
  { immediate: true }
)
```

- [ ] **Step 2: 新增 `getCustomDisplayValue` 和 `handleCustomFormatToggle` 函数**

在 `handleCustomValueChange` 函数（约第 379 行）之后追加：

```typescript
const getCustomDisplayValue = (key: string): string => {
  const val = props.paramOverrides[key]
  if (val !== null && typeof val === 'object') {
    return JSON.stringify(val, null, 2)
  }
  return val === undefined ? '' : String(val)
}

const handleCustomFormatToggle = (key: string, format: 'json' | 'string') => {
  if (format === 'json') {
    const currentText = getCustomDisplayValue(key)
    const parsed = parseCustomValue(currentText)
    if (parsed !== null && typeof parsed === 'object') {
      customParamFormats.value[key] = 'json'
      const next = { ...props.paramOverrides, [key]: parsed }
      emit('update:paramOverrides', next)
    } else {
      message.error(t('modelManager.advancedParameters.invalidJson'))
    }
  } else {
    customParamFormats.value[key] = 'string'
    const next = { ...props.paramOverrides }
    const val = next[key]
    if (val !== null && typeof val === 'object') {
      next[key] = JSON.stringify(val)
    }
    emit('update:paramOverrides', next)
  }
}
```

- [ ] **Step 3: 修改 `handleCustomValueChange` 以尊重格式设置**

将现有的 `handleCustomValueChange` 函数（约第 379-388 行）：

```typescript
const handleCustomValueChange = (key: string, value: string) => {
  const trimmed = value.trim()
  const next = { ...props.paramOverrides }
  if (trimmed === '') {
    delete next[key]
  } else {
    next[key] = parseCustomValue(trimmed)
  }
  emit('update:paramOverrides', next)
}
```

替换为：

```typescript
const handleCustomValueChange = (key: string, value: string) => {
  const trimmed = value.trim()
  const next = { ...props.paramOverrides }
  if (trimmed === '') {
    delete next[key]
  } else {
    const format = customParamFormats.value[key] ?? 'string'
    if (format === 'json') {
      next[key] = parseCustomValue(trimmed)
    } else {
      next[key] = trimmed
    }
  }
  emit('update:paramOverrides', next)
}
```

- [ ] **Step 4: 更新 `defineExpose` 以包含新函数**

将 `defineExpose` 块（约第 390-394 行）：

```typescript
defineExpose({
  handleAddDefinition,
  handleValueChange,
  handleCustomValueChange
})
```

替换为：

```typescript
defineExpose({
  handleAddDefinition,
  handleValueChange,
  handleCustomValueChange,
  handleCustomFormatToggle
})
```

- [ ] **Step 5: 替换 text 模式自定义参数的 `<NFormItem>` 模板块**

在 template 中找到 text 模式的自定义参数块（约第 106-131 行）：

```vue
        <!-- 自定义参数（schema中不存在） -->
        <NFormItem
          v-for="entry in customEntries"
          :key="`custom-${entry.key}`"
          class="advanced-form-item"
        >
          <template #label>
            <NSpace align="center" :size="8" style="width: 100%;">
              <span>{{ entry.key }}</span>
              <NTag type="info" size="small">
                {{ t('modelManager.advancedParameters.customParam') }}
              </NTag>
              <NButton size="tiny" type="error" quaternary circle @click="handleRemove(entry.key)">
                ×
              </NButton>
            </NSpace>
          </template>
          <NInput
            type="textarea"
            size="small"
            :autosize="{ minRows: 1, maxRows: 3 }"
            :value="String(paramOverrides[entry.key] ?? '')"
            data-test="custom-param-input"
            class="advanced-control"
            @update:value="value => handleCustomValueChange(entry.key, value)"
          />
        </NFormItem>
```

替换为：

```vue
        <!-- 自定义参数（schema中不存在） -->
        <NFormItem
          v-for="entry in customEntries"
          :key="`custom-${entry.key}`"
          class="advanced-form-item"
        >
          <template #label>
            <NSpace align="center" :size="8" style="width: 100%;">
              <span>{{ entry.key }}</span>
              <NTag type="info" size="small">
                {{ t('modelManager.advancedParameters.customParam') }}
              </NTag>
              <NButton size="tiny" type="error" quaternary circle @click="handleRemove(entry.key)">
                ×
              </NButton>
            </NSpace>
          </template>
          <NSpace vertical :size="4" style="width: 100%; max-width: 320px;">
            <NSpace :size="4">
              <NButton
                size="tiny"
                :type="(customParamFormats[entry.key] ?? 'string') === 'json' ? 'primary' : 'default'"
                @click="handleCustomFormatToggle(entry.key, 'json')"
              >
                {{ t('modelManager.advancedParameters.formatJson') }}
              </NButton>
              <NButton
                size="tiny"
                :type="(customParamFormats[entry.key] ?? 'string') === 'string' ? 'primary' : 'default'"
                @click="handleCustomFormatToggle(entry.key, 'string')"
              >
                {{ t('modelManager.advancedParameters.formatString') }}
              </NButton>
            </NSpace>
            <NInput
              type="textarea"
              size="small"
              :autosize="{ minRows: 1, maxRows: 6 }"
              :value="getCustomDisplayValue(entry.key)"
              data-test="custom-param-input"
              class="advanced-control"
              @update:value="value => handleCustomValueChange(entry.key, value)"
            />
            <NText
              v-if="(customParamFormats[entry.key] ?? 'string') === 'json'"
              :depth="paramOverrides[entry.key] !== null && typeof paramOverrides[entry.key] === 'object' ? 3 : undefined"
              :style="{
                fontSize: '12px',
                color: paramOverrides[entry.key] !== null && typeof paramOverrides[entry.key] === 'object'
                  ? undefined
                  : 'var(--n-color-error, #d03050)'
              }"
            >
              {{
                paramOverrides[entry.key] !== null && typeof paramOverrides[entry.key] === 'object'
                  ? t('modelManager.advancedParameters.parsedAsObject')
                  : t('modelManager.advancedParameters.invalidJson')
              }}
            </NText>
          </NSpace>
        </NFormItem>
```

- [ ] **Step 6: 替换 image 模式自定义参数的 `<NFormItem>` 模板块**

在 template 中找到 image 模式的自定义参数块（约第 228-251 行）：

```vue
        <!-- 自定义参数（schema中不存在） -->
        <NFormItem
          v-for="entry in customEntries"
          :key="`custom-${entry.key}`"
          class="advanced-form-item"
        >
          <template #label>
            <NSpace align="center" :size="8" style="width: 100%;">
              <span>{{ entry.key }}</span>
              <NTag type="info" size="small">
                {{ t('modelManager.advancedParameters.customParam') }}
              </NTag>
              <NButton size="tiny" type="error" quaternary circle @click="handleRemove(entry.key)">
                ×
              </NButton>
            </NSpace>
          </template>
          <NInput
            size="small"
            :value="String(paramOverrides[entry.key] ?? '')"
            data-test="custom-param-input"
            class="advanced-control"
            @update:value="value => handleCustomValueChange(entry.key, value)"
          />
        </NFormItem>
```

替换为（与 text 模式完全相同的新模板）：

```vue
        <!-- 自定义参数（schema中不存在） -->
        <NFormItem
          v-for="entry in customEntries"
          :key="`custom-${entry.key}`"
          class="advanced-form-item"
        >
          <template #label>
            <NSpace align="center" :size="8" style="width: 100%;">
              <span>{{ entry.key }}</span>
              <NTag type="info" size="small">
                {{ t('modelManager.advancedParameters.customParam') }}
              </NTag>
              <NButton size="tiny" type="error" quaternary circle @click="handleRemove(entry.key)">
                ×
              </NButton>
            </NSpace>
          </template>
          <NSpace vertical :size="4" style="width: 100%; max-width: 320px;">
            <NSpace :size="4">
              <NButton
                size="tiny"
                :type="(customParamFormats[entry.key] ?? 'string') === 'json' ? 'primary' : 'default'"
                @click="handleCustomFormatToggle(entry.key, 'json')"
              >
                {{ t('modelManager.advancedParameters.formatJson') }}
              </NButton>
              <NButton
                size="tiny"
                :type="(customParamFormats[entry.key] ?? 'string') === 'string' ? 'primary' : 'default'"
                @click="handleCustomFormatToggle(entry.key, 'string')"
              >
                {{ t('modelManager.advancedParameters.formatString') }}
              </NButton>
            </NSpace>
            <NInput
              type="textarea"
              size="small"
              :autosize="{ minRows: 1, maxRows: 6 }"
              :value="getCustomDisplayValue(entry.key)"
              data-test="custom-param-input"
              class="advanced-control"
              @update:value="value => handleCustomValueChange(entry.key, value)"
            />
            <NText
              v-if="(customParamFormats[entry.key] ?? 'string') === 'json'"
              :depth="paramOverrides[entry.key] !== null && typeof paramOverrides[entry.key] === 'object' ? 3 : undefined"
              :style="{
                fontSize: '12px',
                color: paramOverrides[entry.key] !== null && typeof paramOverrides[entry.key] === 'object'
                  ? undefined
                  : 'var(--n-color-error, #d03050)'
              }"
            >
              {{
                paramOverrides[entry.key] !== null && typeof paramOverrides[entry.key] === 'object'
                  ? t('modelManager.advancedParameters.parsedAsObject')
                  : t('modelManager.advancedParameters.invalidJson')
              }}
            </NText>
          </NSpace>
        </NFormItem>
```

- [ ] **Step 7: 运行 core 单元测试确认无回归**

```bash
cd packages/core && npx vitest run
```

期望输出：所有测试 PASS。

- [ ] **Step 8: Commit**

```bash
git add packages/ui/src/components/ModelParameterEditor.vue
git commit -m "feat(ui): add JSON/string format toggle for custom parameters"
```

---

## 验收标准

1. 在模型编辑界面添加自定义参数 `chat_template_kwargs`，输入 `{"enable_thinking": False}`，点击 JSON 按钮 → 提示"已解析为 Object ✓"，测试连接不再报 400
2. 点击字符串按钮 → 值转为字符串存储，提示消失
3. 在字符串模式下输入任意内容 → 作为 string 发送，不自动解析
4. 现有内置参数（temperature 等）行为不变
5. `npx vitest run`（core 包）全部通过
