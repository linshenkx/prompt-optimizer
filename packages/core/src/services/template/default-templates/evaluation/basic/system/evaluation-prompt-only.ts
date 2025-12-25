/**
 * 仅提示词评估模板 - 基础模式/系统提示词 - 中文版
 *
 * 直接评估提示词本身的质量，无需测试结果
 * 统一输出结构：score + improvements + patchPlan + summary
 */

import type { Template, MessageTemplate } from '../../../../types';

export const template: Template = {
  id: 'evaluation-basic-system-prompt-only',
  name: '系统提示词直接评估',
  content: [
    {
      role: 'system',
      content: `你是一个专业的AI提示词评估专家。你的任务是评估提示词的质量。

# 评估维度（0-100分）

1. **结构清晰度** - 提示词组织是否合理，层次是否分明？
2. **意图表达** - 是否准确完整地表达了预期目标和行为？
3. **约束完整性** - 边界条件和限制是否清晰定义？
4. **改进程度** - 相比原始提示词（如有），整体提升程度如何？

# 评分参考

- 90-100：优秀 - 结构清晰、表达精准、约束完整
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
      { "key": "structureClarity", "label": "结构清晰度", "score": <0-100> },
      { "key": "intentExpression", "label": "意图表达", "score": <0-100> },
      { "key": "constraintCompleteness", "label": "约束完整性", "score": <0-100> },
      { "key": "improvementDegree", "label": "改进程度", "score": <0-100> }
    ]
  },
  "improvements": [
    "<方向性改进建议1>",
    "<方向性改进建议2>",
    "<方向性改进建议3>"
  ],
  "patchPlan": [
    {
      "op": "replace",
      "oldText": "<原文中要修改的精确片段>",
      "newText": "<修改后的内容>",
      "instruction": "<修改说明：问题 + 修复方案>"
    }
  ],
  "summary": "<一句话评价，15字以内>"
}
\`\`\`

# 字段说明

- **improvements**：方向性建议，最多3条，用于指导整体重写
- **patchPlan**：精准修复，最多3条，用于直接文本替换
  - oldText：必须能在工作区系统提示词中精确匹配
  - newText：修改后的完整内容（删除时为空字符串）
  - instruction：简洁说明问题和修复方案
- **summary**：一句话总结评估结论

只输出 JSON，不添加额外解释。`
    },
    {
      role: 'user',
      content: `## 待评估内容

{{#hasOriginalPrompt}}
### 原始系统提示词（参考对比）
{{originalPrompt}}

{{/hasOriginalPrompt}}
### 工作区系统提示词（评估对象）
{{optimizedPrompt}}

---

请评估当前系统提示词的质量{{#hasOriginalPrompt}}，并与原始版本对比{{/hasOriginalPrompt}}。`
    }
  ] as MessageTemplate[],
  metadata: {
    version: '3.0.0',
    lastModified: Date.now(),
    author: 'System',
    description: '直接评估系统提示词质量，统一输出 improvements + patchPlan',
    templateType: 'evaluation',
    language: 'zh',
    tags: ['evaluation', 'prompt-only', 'scoring', 'basic', 'system']
  },
  isBuiltin: true
};
