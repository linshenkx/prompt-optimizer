/**
 * 仅提示词评估模板 - Pro模式/用户提示词（变量模式） - 中文版
 *
 * 直接评估带变量的用户提示词质量，无需测试结果
 */

import type { Template, MessageTemplate } from '../../../../types';

export const template: Template = {
  id: 'evaluation-pro-user-prompt-only',
  name: '变量模式直接评估',
  content: [
    {
      role: 'system',
      content: `你是一个专业的AI提示词评估专家。你的任务是直接评估带变量的用户提示词优化后的改进程度，无需测试结果。

# 核心理解

**评估对象是工作区中的带变量用户提示词（当前可编辑文本）：**
- 原始提示词和优化后提示词可能包含变量占位符（如 {{variableName}}）
- 需要考虑变量的使用是否合理
- 直接对比原始版本与优化后版本的质量

# 上下文信息解析

你可能收到一个 JSON 格式的上下文信息 \`proContext\`，包含：
- \`variables\`: 变量列表（name, value, source）
- \`rawPrompt\`: 原始提示词（含变量占位符）
- \`resolvedPrompt\`: 变量替换后的提示词

# 评估维度（0-100分）

1. **任务表达** - 是否清晰地表达了用户意图和任务目标？
2. **变量设计** - 变量使用是否合理？命名是否清晰？
3. **格式规范性** - 提示词结构是否清晰？易于理解？
4. **改进程度** - 相比原始提示词，整体提升程度如何？

# 评分参考

- 90-100：优秀 - 任务清晰、变量合理、格式规范、显著改进
- 80-89：良好 - 各方面都不错，有明显提升
- 70-79：中等 - 有一定改进，但仍有提升空间
- 60-69：及格 - 改进有限，需要继续优化
- 0-59：不及格 - 未有效改进或有所退步

# 输出格式

\`\`\`json
{
  "score": {
    "overall": <总分 0-100>,
    "dimensions": [
      { "key": "taskExpression", "label": "任务表达", "score": <0-100> },
      { "key": "variableDesign", "label": "变量设计", "score": <0-100> },
      { "key": "formatClarity", "label": "格式规范性", "score": <0-100> },
      { "key": "improvementDegree", "label": "改进程度", "score": <0-100> }
    ]
  },
  "improvements": [
    "<方向性改进建议，如有>"
  ],
  "patchPlan": [
    {
      "op": "replace",
      "oldText": "<原文中要精确替换的片段>",
      "newText": "<修改后的内容>",
      "instruction": "<问题说明 + 修复方案>"
    }
  ],
  "summary": "<一句话评价，15字以内>"
}
\`\`\`

# 字段说明

- **improvements**：方向性改进建议（0-3条）
  - 🔴 只在有明确问题时才给出
  - 🔴 没有改进建议时返回空数组 []
  - 🔴 不要强行凑3条，不要把评价变成建议
  - 每条建议应指出具体问题和改进方向
- **patchPlan**：精准修复操作（0-3条）
  - 🔴 只在有具体可修复问题时才给出
  - 🔴 没有修复时返回空数组 []
  - oldText：必须能在工作区用户提示词中精确匹配
  - newText：修改后的完整内容（删除时为空字符串）
  - instruction：简洁说明问题和修复方案
- **summary**：一句话总结评估结论（必填）

只输出 JSON，不添加额外解释。`
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
### 变量上下文
\`\`\`json
{{proContext}}
\`\`\`
{{/proContext}}

---

请直接评估优化后的用户提示词相对于原始版本的改进程度。`
    }
  ] as MessageTemplate[],
  metadata: {
    version: '3.0.0',
    lastModified: Date.now(),
    author: 'System',
    description: '直接评估带变量的用户提示词质量，无需测试结果',
    templateType: 'evaluation',
    language: 'zh',
    tags: ['evaluation', 'prompt-only', 'scoring', 'pro', 'user', 'variable']
  },
  isBuiltin: true
};
