# E2E 测试选择器策略优化方案

## 问题分析

### 当前问题
1. **依赖文本内容**：受国际化影响，需要维护多语言正则表达式
2. **按钮位置不明确**：页面可能有多个同名按钮
3. **XPath 脆弱**：组件结构变化会导致失败
4. **不同模式 UI 不同**：Basic/Pro/Image 模式的界面结构完全不同

### 示例：当前定位方式
```typescript
// ❌ 问题 1：依赖文本
page.getByText(/Original Prompt|原始提示词|原始提示/i)

// ❌ 问题 2：可能匹配多个按钮
page.getByRole('button', { name: /^(分析|Analyze)$/i })

// ❌ 问题 3：XPath 脆弱
title.locator('xpath=ancestor::*[contains(@class,"n-card")][1]')
```

---

## 解决方案：使用 `data-testid` 属性

### 方案概述
为关键 UI 元素添加 `data-testid` 属性，提供稳定、语言无关的定位标识。

### 实施步骤

#### 步骤 1：在组件中添加 `data-testid`

**命名规范**：
```
data-testid="{模式}-{功能}-{元素类型}"
```

**示例**：
- `basic-system-input-panel` - Basic System 模式的输入面板
- `basic-system-analyze-button` - Basic System 模式的分析按钮
- `basic-user-analyze-button` - Basic User 模式的分析按钮
- `pro-multi-message-list` - Pro Multi 模式的消息列表
- `evaluation-score-badge` - 评估分数徽章（通用）

---

#### 步骤 2：修改组件代码

##### 2.1 InputPanel.vue

在 `InputPanel.vue` 的关键按钮上添加 `data-testid`：

```vue
<template>
  <NSpace vertical :size="16" :data-testid="testIdPrefix + '-input-panel'">
    <!-- 标题区域 -->
    <NFlex justify="space-between" align="center" :wrap="false">
      <NText :data-testid="testIdPrefix + '-input-label'">{{ label }}</NText>

      <!-- AI提取变量按钮 -->
      <NButton
        v-if="enableVariableExtraction && showExtractButton"
        :data-testid="testIdPrefix + '-extract-variables-button'"
        @click="$emit('extract-variables')"
      >
        ...
      </NButton>

      <!-- 预览按钮 -->
      <NButton
        v-if="showPreview"
        :data-testid="testIdPrefix + '-preview-button'"
        @click="$emit('open-preview')"
      >
        ...
      </NButton>
    </NFlex>

    <!-- 输入框 -->
    <VariableAwareInput
      v-if="enableVariableExtraction"
      :data-testid="testIdPrefix + '-input'"
      ...
    />
    <NInput
      v-else
      :data-testid="testIdPrefix + '-input'"
      ...
    />

    <!-- 操作按钮区域 -->
    <NSpace>
      <!-- 分析按钮 -->
      <NButton
        v-if="showAnalyzeButton"
        :data-testid="testIdPrefix + '-analyze-button'"
        @click="$emit('analyze')"
        :loading="analyzeLoading"
      >
        {{ $t('promptOptimizer.analyze') }}
      </NButton>

      <!-- 优化按钮 -->
      <NButton
        :data-testid="testIdPrefix + '-optimize-button'"
        @click="$emit('optimize')"
        :loading="optimizeLoading"
      >
        {{ $t('promptOptimizer.optimize') }}
      </NButton>
    </NSpace>
  </NSpace>
</template>

<script setup lang="ts">
interface Props {
  // ... 现有 props
  /** 🆕 测试 ID 前缀（用于区分不同模式） */
  testIdPrefix?: string
}

const props = withDefaults(defineProps<Props>(), {
  // ... 现有默认值
  testIdPrefix: 'input-panel'
})
</script>
```

##### 2.2 BasicSystemWorkspace.vue

在工作区中传递 `testIdPrefix`：

```vue
<template>
  <div data-testid="basic-system-workspace">
    <InputPanelUI
      v-model="promptModel"
      test-id-prefix="basic-system"
      :show-analyze-button="true"
      @analyze="handleAnalyze"
    />

    <!-- 评估分数徽章 -->
    <EvaluationScoreBadge
      data-testid="basic-system-score-badge"
      :score="evaluationScore"
    />
  </div>
</template>
```

##### 2.3 BasicUserWorkspace.vue

```vue
<template>
  <div data-testid="basic-user-workspace">
    <InputPanelUI
      v-model="promptModel"
      test-id-prefix="basic-user"
      :show-analyze-button="true"
      @analyze="handleAnalyze"
    />

    <EvaluationScoreBadge
      data-testid="basic-user-score-badge"
      :score="evaluationScore"
    />
  </div>
</template>
```

##### 2.4 EvaluationScoreBadge.vue

```vue
<template>
  <div
    class="evaluation-score-badge"
    :class="[sizeClass, levelClass, { clickable: !loading, loading }]"
    data-testid="evaluation-score-badge"
  >
    <template v-if="loading">
      <NSpin :size="spinSize" data-testid="score-loading" />
    </template>
    <template v-else-if="score !== null && score !== undefined">
      <span
        class="score-value"
        data-testid="score-value"
      >{{ score }}</span>
    </template>
  </div>
</template>
```

---

#### 步骤 3：更新测试辅助函数

##### 3.1 helpers/analysis.ts

```typescript
import { expect, type Page } from '@playwright/test'

/**
 * 填写原始提示词（使用 data-testid）
 * @param page Playwright Page 对象
 * @param mode 模式前缀（如 'basic-system', 'basic-user'）
 * @param value 提示词内容
 */
export async function fillOriginalPrompt(
  page: Page,
  mode: string,
  value: string
): Promise<void> {
  const input = page.locator(`[data-testid="${mode}-input"]`)
  await expect(input).toBeVisible({ timeout: 15000 })

  // 检查是否是 CodeMirror
  const cmContent = input.locator('.cm-content')
  if ((await cmContent.count()) > 0) {
    await cmContent.click()
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
    await page.keyboard.type(value)
  } else {
    await input.fill(value)
  }

  // 等待按钮可用
  const analyzeButton = page.locator(`[data-testid="${mode}-analyze-button"]`)
  await expect(analyzeButton).toBeEnabled({ timeout: 15000 })
}

/**
 * 点击分析按钮（使用 data-testid）
 * @param page Playwright Page 对象
 * @param mode 模式前缀
 */
export async function clickAnalyzeButton(page: Page, mode: string): Promise<void> {
  const analyzeButton = page.locator(`[data-testid="${mode}-analyze-button"]`)
  await expect(analyzeButton).toBeVisible({ timeout: 15000 })
  await expect(analyzeButton).toBeEnabled({ timeout: 15000 })
  await analyzeButton.click()
}

/**
 * 获取评估分数（使用 data-testid）
 * @param page Playwright Page 对象
 * @param mode 模式前缀（可选，用于更精确定位）
 * @returns 分数（0-100）
 */
export async function getEvaluationScore(
  page: Page,
  mode?: string
): Promise<number> {
  const badgeSelector = mode
    ? `[data-testid="${mode}-score-badge"]`
    : '[data-testid="evaluation-score-badge"]'

  const scoreBadge = page.locator(badgeSelector)
  await expect(scoreBadge).toBeVisible({ timeout: 90000 })
  await expect(scoreBadge).not.toHaveClass(/loading/, { timeout: 60000 })

  const scoreValue = scoreBadge.locator('[data-testid="score-value"]')
  await expect(scoreValue).toBeVisible({ timeout: 10000 })

  const scoreText = await scoreValue.textContent()
  const score = parseInt(scoreText?.trim() || '0')

  expect(score).toBeGreaterThan(0)
  expect(score).toBeLessThanOrEqual(100)

  return score
}

/**
 * 验证分析按钮在输入为空时禁用
 * @param page Playwright Page 对象
 * @param mode 模式前缀
 */
export async function verifyAnalyzeButtonDisabledWhenEmpty(
  page: Page,
  mode: string
): Promise<void> {
  const analyzeButton = page.locator(`[data-testid="${mode}-analyze-button"]`)
  await expect(analyzeButton).toBeVisible({ timeout: 15000 })
  await expect(analyzeButton).toBeDisabled()
}
```

---

#### 步骤 4：更新测试用例

##### 4.1 analysis/basic-system.spec.ts

```typescript
import { test, expect } from '../fixtures'
import { navigateToMode } from '../helpers/common'
import {
  fillOriginalPrompt,
  clickAnalyzeButton,
  getEvaluationScore,
  verifyAnalyzeButtonDisabledWhenEmpty
} from '../helpers/analysis'

const MODE = 'basic-system'

test.describe('Basic System - 提示词分析', () => {
  test('分析提示词并显示评估结果', async ({ page }) => {
    test.setTimeout(180000)

    // 1. 导航到 basic-system 工作区
    await navigateToMode(page, 'basic', 'system')
    await page.waitForTimeout(3000)

    // 2. 填写提示词（使用 data-testid）
    const testPrompt = '写一个排序算法'
    await fillOriginalPrompt(page, MODE, testPrompt)

    // 3. 点击分析按钮（使用 data-testid）
    await clickAnalyzeButton(page, MODE)
    await page.waitForTimeout(500)

    // 4. 验证评估分数（使用 data-testid）
    const score = await getEvaluationScore(page, MODE)
    console.log(`✓ ${MODE} 评估分数: ${score}/100`)
  })

  test('验证分析按钮在没有提示词时禁用', async ({ page }) => {
    await navigateToMode(page, 'basic', 'system')
    await page.waitForTimeout(1000)

    // 使用 data-testid 验证按钮状态
    await verifyAnalyzeButtonDisabledWhenEmpty(page, MODE)
  })
})
```

---

## 优势对比

### 修改前 ❌
```typescript
// 依赖文本，易受国际化影响
const card = page.getByText(/Original Prompt|原始提示词/i)
// 可能匹配多个按钮
const button = card.getByRole('button', { name: /分析|Analyze/i })
// XPath 脆弱
const ancestor = card.locator('xpath=ancestor::*[contains(@class,"n-card")]')
```

### 修改后 ✅
```typescript
// 稳定、语言无关
await fillOriginalPrompt(page, 'basic-system', '测试内容')
await clickAnalyzeButton(page, 'basic-system')
const score = await getEvaluationScore(page, 'basic-system')
```

### 关键优势
1. ✅ **语言无关**：不受国际化影响
2. ✅ **精确定位**：通过 testIdPrefix 区分不同模式
3. ✅ **稳定性高**：不依赖 DOM 结构和样式类
4. ✅ **易于维护**：选择器语义清晰
5. ✅ **符合最佳实践**：Playwright/Testing Library 推荐方式

---

## 实施计划

### Phase 1：核心组件（高优先级）
- [x] ~~创建优化方案文档~~
- [ ] `InputPanel.vue` - 添加 `testIdPrefix` prop 和 data-testid
- [ ] `BasicSystemWorkspace.vue` - 传递 testIdPrefix="basic-system"
- [ ] `BasicUserWorkspace.vue` - 传递 testIdPrefix="basic-user"
- [ ] `EvaluationScoreBadge.vue` - 添加 data-testid="evaluation-score-badge"
- [ ] 更新 `helpers/analysis.ts` 使用新选择器
- [ ] 更新 `analysis/basic-system.spec.ts` 和 `basic-user.spec.ts`
- [ ] 运行测试验证

### Phase 2：Pro 模式（中优先级）
- [ ] `ContextSystemWorkspace.vue` - 添加 data-testid
- [ ] `ContextUserWorkspace.vue` - 添加 data-testid
- [ ] 设计并实现 Pro 模式的测试

### Phase 3：Image 模式（低优先级）
- [ ] `ImageText2ImageWorkspace.vue` - 添加 data-testid
- [ ] `ImageImage2ImageWorkspace.vue` - 添加 data-testid
- [ ] 创建评估模板后实现测试

---

## 注意事项

1. **向后兼容**：添加 `data-testid` 不影响现有功能
2. **生产环境**：`data-testid` 在生产环境保留（文件大小增加可忽略）
3. **命名一致性**：严格遵守命名规范，便于查找和维护
4. **渐进式迁移**：先迁移 Basic 模式，再扩展到其他模式

---

## 参考资料

- [Playwright Best Practices - Use Test IDs](https://playwright.dev/docs/best-practices#use-test-ids)
- [Testing Library - Priority](https://testing-library.com/docs/queries/about/#priority)
- [Vue Test Utils - Finding Elements](https://test-utils.vuejs.org/guide/essentials/a-crash-course.html#finding-elements)
