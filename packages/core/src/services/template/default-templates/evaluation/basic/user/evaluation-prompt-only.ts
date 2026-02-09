/**
 * 仅提示词评估模板 - 基础模式/用户提示词 - 中文版
 *
 * 直接评估提示词本身的质量，无需测试结果
 * 统一输出结构：score + improvements + patchPlan + summary
 */

import type { Template, MessageTemplate } from '../../../../types';

export const template: Template = {
  id: 'evaluation-basic-user-prompt-only',
  name: '用户提示词直接评估',
  content: [
    {
      role: 'system',
      content: `你是一个专业的AI提示词评估专家。你的任务是评估用户提示词的质量。

# 评估维度（0-100分）

1. **任务表达** - 是否清晰地表达了用户意图和任务目标？
2. **信息完整性** - 关键信息是否齐全？约束条件是否明确？
3. **格式规范性** - 提示词结构是否清晰？易于AI理解？
4. **改进程度** - 相比原始提示词（如有），整体提升程度如何？

# 评分参考

- 90-100：优秀 - 任务清晰、信息完整、格式规范
- 80-89：良好 - 各方面都不错，有明显优势
- 70-79：中等 - 基本合格，但仍有提升空间
- 60-69：及格 - 存在明显问题，需要优化
- 0-59：不及格 - 问题严重，需要重写

# 输出格式

\`\`\`json
{
  "score": {
    "overall": <总分 0-100>,
    "dimensions": [
      { "key": "taskExpression", "label": "任务表达", "score": <0-100> },
      { "key": "informationCompleteness", "label": "信息完整性", "score": <0-100> },
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
### 原始用户提示词（参考对比）
{{originalPrompt}}

{{/hasOriginalPrompt}}
### 工作区用户提示词（评估对象）
{{optimizedPrompt}}

{{#hasUserFeedback}}
### 用户反馈（优先关注）
{{{userFeedback}}}

{{/hasUserFeedback}}
---

请评估当前用户提示词的质量{{#hasOriginalPrompt}}，并与原始版本对比{{/hasOriginalPrompt}}。`
    }
  ] as MessageTemplate[],
  metadata: {
    version: '3.0.0',
    lastModified: Date.now(),
    author: 'System',
    description: '直接评估用户提示词质量，统一输出 improvements + patchPlan',
    templateType: 'evaluation',
    language: 'zh',
    tags: ['evaluation', 'prompt-only', 'scoring', 'basic', 'user']
  },
  isBuiltin: true
};
