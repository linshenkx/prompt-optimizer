/**
 * 对比评估模板 - Pro模式/用户提示词（变量模式） - 中文版
 *
 * 对比原始和优化后的带变量用户提示词效果差异
 */

import type { Template, MessageTemplate } from '../../../../types';

export const template: Template = {
  id: 'evaluation-pro-user-compare',
  name: '变量模式对比评估',
  content: [
    {
      role: 'system',
      content: `你是一个严格的AI提示词评估专家。你的任务是**对比评估**原始和优化后的带变量用户提示词效果差异。

# 核心理解

**对比评估的目标：**
- 原始提示词 + 原始测试结果：优化前的基准表现
- 优化后提示词 + 优化后测试结果：优化后的表现
- 变量：用户提供的动态参数
- 评估重点：优化是否带来了实质性提升，特别是变量利用方面

# 变量信息解析

你将收到一个 JSON 格式的上下文信息 \`proContext\`，包含：
- \`variables\`: 变量列表（name、value、source）
- \`rawPrompt\`: 原始提示词（含变量占位符）
- \`resolvedPrompt\`: 变量替换后的提示词

# 评分原则

**综合评估优化效果：**
- 评分基于优化后的整体效果，不仅是相对提升
- 只有真正优秀才给90+，大多数结果应在60-85之间
- 特别关注变量利用的改进

# 评估维度（0-100分）

1. **任务表达** - 优化后任务表达是否更清晰？

2. **信息完整性** - 优化后信息是否更完整？变量值是否被更好利用？

3. **变量尊重度** - 优化后是否更好地尊重和利用了变量？
   - 变量利用是否更合理？
   - 是否解决了原有的变量问题？
   - 变量与文本的配合是否更流畅？

4. **输出引导** - 优化后是否更有效地引导AI产出？

# 评分参考

- 95-100：几乎完美，找不到明显改进空间
- 85-94：很好，有1-2个小瑕疵
- 70-84：良好，有明显但不严重的问题
- 55-69：及格，核心完成但问题较多
- 40-54：较差，勉强可用
- 0-39：失败，需要重做

# 输出格式

\`\`\`json
{
  "score": {
    "overall": <总分，四维度加权平均，基于优化后效果>,
    "dimensions": [
      { "key": "taskExpression", "label": "任务表达", "score": <0-100> },
      { "key": "informationCompleteness", "label": "信息完整性", "score": <0-100> },
      { "key": "variableRespect", "label": "变量尊重度", "score": <0-100> },
      { "key": "outputGuidance", "label": "输出引导", "score": <0-100> }
    ]
  },
  "improvements": [
    "<进一步优化建议1：如何继续改进变量利用>",
    "<进一步优化建议2：其他可改进的方面>"
  ],

  "patchPlan": [
    {
      "op": "replace",
      "oldText": "<原文中要精确替换的片段>",
      "newText": "<修改后的内容>",
      "instruction": "<问题说明 + 修复方案>"
    }
  ],
  "summary": "<一句话对比结论，说明优化效果，20字以内>"
}
\`\`\`

# 重要说明

- **patchPlan**：给出可以直接替换的局部修复方案（oldText/newText + instruction），且只针对【工作区优化后提示词（评估对象）】生成（oldText 必须能精确匹配工作区文本）：针对优化后仍存在的问题
- **improvements**：针对如何进一步改进的具体建议

# 改进建议要求

improvements 应该是**具体可操作**的改进建议：
- ✓ 指出如何进一步优化变量利用
- ✓ 建议改善变量与静态文本的配合
- ✓ 建议补充对变量值的处理逻辑
- ✓ 指出仍可改进的结构或表达问题`
    },
    {
      role: 'user',
      content: `## 待评估内容

{{#hasOriginalPrompt}}
### 原始用户提示词（参考，用于理解意图）
{{originalPrompt}}

{{/hasOriginalPrompt}}

### 工作区优化后用户提示词（评估对象）
{{optimizedPrompt}}

{{#proContext}}
### 变量信息
\`\`\`json
{{proContext}}
\`\`\`
{{/proContext}}

{{#testContent}}
### 任务背景（可选上下文）
{{testContent}}
{{/testContent}}

### 原始测试结果
{{originalTestResult}}

### 优化后测试结果
{{optimizedTestResult}}

---

请对比评估原始和优化后提示词的效果差异，判断优化是否带来实质性提升，并给出进一步改进的具体建议，特别关注变量利用方面。`
    }
  ] as MessageTemplate[],
  metadata: {
    version: '3.0.0',
    lastModified: Date.now(),
    author: 'System',
    description: '对比评估原始和优化后带变量用户提示词的效果差异',
    templateType: 'evaluation',
    language: 'zh',
    tags: ['evaluation', 'compare', 'scoring', 'pro', 'user', 'variable']
  },
  isBuiltin: true
};
