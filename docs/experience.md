# 项目核心经验指南

本指南收录项目开发中的关键经验与最佳实践，快速解决常见问题，提升开发效率。

---

## 🎯 核心布局经验：动态 Flex 布局

**这是本项目最重要的经验。** 摒弃固定尺寸，全面使用 Flexbox 动态空间分配。

### 核心原则
- **最高指导原则**：一个元素若要作为 Flex 子项（`flex-1`）进行伸缩，其直接父元素必须是 Flex 容器（`display: flex`）
- **约束链完整性**：从顶层到底层的所有相关父子元素都必须遵循 Flex 规则
- **黄金组合**：`flex: 1` + `min-h-0`（或 `min-w-0`）

### 实施要点
```css
/* 父容器 */
.parent {
  display: flex;
  flex-direction: column;
  height: 100vh; /* 或其他明确高度 */
}

/* 动态子项 */
.child {
  flex: 1;
  min-height: 0; /* 关键：允许收缩 */
}

/* 滚动容器 */
.scrollable {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
```

### 调试方法
当 Flex 布局失效时，从出问题的元素开始，逐层向上检查父元素是否为 `display: flex`。

---

## 🔧 开发规范

### API 集成
```typescript
// 统一 OpenAI 兼容格式
const config = {
  baseURL: "https://api.provider.com/v1",
  models: ["model-name"],
  apiKey: import.meta.env.VITE_API_KEY // 必须使用 Vite 环境变量
};
```

**核心原则**：
- 业务逻辑与API配置分离
- 只传递用户明确配置的参数，不设默认值
- 敏感信息通过环境变量管理

### 错误处理
```typescript
try {
  await apiCall();
} catch (error) {
  console.error('[Service Error]', error); // 开发日志
  throw new Error('操作失败，请稍后重试'); // 用户友好提示
}
```

### 测试规范
```javascript
describe("功能测试", () => {
  beforeEach(() => {
    testId = `test-${Date.now()}`; // 唯一标识避免冲突
  });
  
  // LLM参数测试：每个参数独立测试
  it("should handle temperature parameter", async () => {
    await modelManager.updateModel(configKey, {
      llmParams: { temperature: 0.7 } // 只测试一个参数
    });
  });
});
```

**要点**：
- 使用动态唯一标识符
- 每个LLM参数创建独立测试
- 覆盖异常场景
- 正确清理测试状态

---

## 🚨 关键Bug修复经验

### 1. 参数透明化（2024-12-20）
**问题**：LLM参数默认值误导用户
```typescript
// ❌ 错误：自动设置默认值
if (!config.temperature) config.temperature = 0.7;

// ✅ 正确：只使用用户配置的参数
const requestConfig = {
  model: modelConfig.defaultModel,
  messages: formattedMessages,
  ...userLlmParams // 只传递用户明确配置的参数
};
```

### 2. 数据导入安全验证
```typescript
// 白名单验证 + 类型检查
for (const [key, value] of Object.entries(importData)) {
  if (!ALLOWED_KEYS.includes(key)) {
    console.warn(`跳过未知配置: ${key}`);
    continue;
  }
  if (typeof value !== 'string') {
    console.warn(`跳过无效类型 ${key}: ${typeof value}`);
    continue;
  }
  await storage.setItem(key, value);
}
```

### 3. Flex 约束链断裂修复
**典型错误**：
```html
<!-- ❌ 父容器不是 flex，子元素 flex-1 失效 -->
<div class="h-full relative">
  <TextDiff class="flex-1 min-h-0" />
</div>

<!-- ✅ 正确：父容器必须是 flex -->
<div class="h-full flex flex-col">
  <TextDiff class="flex-1 min-h-0" />
</div>
```

---

## ⚡ 快速问题排查

### 布局问题
1. 检查 Flex 约束链是否完整
2. 确认 `min-h-0` 是否添加
3. 验证父容器是否为 `display: flex`

### 滚动问题
1. 检查是否有中间层错误的 `overflow` 属性
2. 确认高度约束是否从顶层正确传递
3. 验证滚动容器是否有正确的 `overflow-y: auto`

### API调用问题
1. 检查环境变量是否正确设置（`VITE_` 前缀）
2. 确认参数是否过度设置默认值
3. 验证错误处理是否用户友好

### 测试失败
1. 检查测试ID是否唯一
2. 确认测试后是否正确清理状态
3. 验证LLM参数测试是否独立

---

## 🔄 版本管理

### 版本同步
```json
// package.json
{
  "scripts": {
    "version": "pnpm run version:sync && git add -A"
  }
}
```
**关键**：使用 `version` 钩子而非 `postversion`，确保同步文件包含在版本提交中。

### 模板管理
- **内置模板**：不可修改，不可导出
- **用户模板**：可修改，导入时生成新ID
- **导入规则**：跳过与内置模板ID重复的模板

### 4. 数组内容深度比较修复（2025-01-27）
**问题**：BugBot 发现模板内容比较使用引用比较而非深度比较
```typescript
// ❌ 错误：数组引用比较
if (updatedTemplate.content !== currentTemplate.content) {
  // 数组内容相同但引用不同时会触发不必要更新
}

// ✅ 正确：深度比较函数
const deepCompareTemplateContent = (content1, content2) => {
  if (typeof content1 !== typeof content2) return false;
  
  if (typeof content1 === 'string') return content1 === content2;
  
  if (Array.isArray(content1) && Array.isArray(content2)) {
    if (content1.length !== content2.length) return false;
    return content1.every((item1, index) => {
      const item2 = content2[index];
      return item1.role === item2.role && item1.content === item2.content;
    });
  }
  
  return JSON.stringify(content1) === JSON.stringify(content2);
};

// 使用深度比较
if (!deepCompareTemplateContent(updatedTemplate.content, currentTemplate.content)) {
  // 只有内容真正改变时才更新
}
```

**关键**：Template 接口的 content 可以是 `string | Array<{role: string; content: string}>`，必须支持两种类型的正确比较。

### 5. 模板类型过滤器验证修复（2025-01-27）
**问题**：BugBot 发现 refreshTemplates 函数可能选择不匹配类型过滤器的模板
```typescript
// ❌ 问题：更新模板后直接返回，未验证类型匹配
if (updatedTemplate && contentChanged) {
  emit('update:modelValue', updatedTemplate)
  return // 跳过了类型验证
}

// ✅ 修复：添加类型验证
if (updatedTemplate && contentChanged) {
  // 验证更新后的模板是否还匹配当前类型过滤器
  if (updatedTemplate.metadata.templateType === props.type) {
    emit('update:modelValue', updatedTemplate)
    return
  }
  // 类型不匹配时继续执行后续逻辑
}
```
**修复效果**：确保模板选择器只选择匹配当前类型的模板，避免类型不一致的问题。

---

## 📝 文档更新规范

遇到新问题或找到更好解决方案时，应及时更新此文档：
1. 在对应章节添加新经验
2. 更新代码示例
3. 记录修复时间和问题背景
4. 保持文档简洁性，避免过度详细的过程描述

---

**记住**：好的经验文档应该能让团队成员快速找到解决方案，而不是重新踩坑。
