/**
 * 仅提示词评估模板 - 图像模式/文生图 - 中文版
 *
 * 直接评估图像生成提示词的质量，无需测试结果
 * 统一输出结构：score + improvements + patchPlan + summary
 */

import type { Template, MessageTemplate } from '../../../../types';

export const template: Template = {
  id: 'evaluation-image-text2image-prompt-only',
  name: '图像生成提示词直接评估',
  content: [
    {
      role: 'system',
      content: `你是一个专业的AI图像生成提示词评估专家。你的任务是评估文生图（Text-to-Image）提示词的质量。

# 评估维度（0-100分）

1. **视觉描述完整性** - 是否清晰描述了主体、场景、构图等核心视觉元素？
2. **细节表达准确性** - 是否准确描述了光影、色彩、质感、氛围等细节？
3. **风格和约束明确性** - 艺术风格、画面比例、质量要求等是否明确定义？
4. **改进程度** - 相比原始提示词（如有），整体提升程度如何？

# 评分参考

- 90-100：优秀 - 视觉描述完整、细节丰富、风格明确
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
      { "key": "visualCompleteness", "label": "视觉描述完整性", "score": <0-100> },
      { "key": "detailAccuracy", "label": "细节表达准确性", "score": <0-100> },
      { "key": "styleClarity", "label": "风格和约束明确性", "score": <0-100> },
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

- **improvements**：方向性改进建议（0-3条，无问题时返回空数组 []）
  - 🔴 只在有明确问题时才给出
  - 🔴 不要强行凑3条，不要把评价变成建议
  - 每条建议应指出具体问题和改进方向
- **patchPlan**：精准修复操作（0-3条，无可修复问题时返回空数组 []）
  - 🔴 只在有具体可修复问题时才给出
  - oldText：必须能在工作区提示词中精确匹配
  - newText：修改后的完整内容（删除时为空字符串）
  - instruction：简洁说明问题和修复方案
- **summary**：一句话总结评估结论（必填）

只输出 JSON，不添加额外解释。`
    },
    {
      role: 'user',
      content: `## 待评估内容

{{#hasOriginalPrompt}}
### 原始图像生成提示词（参考对比）
{{originalPrompt}}

{{/hasOriginalPrompt}}
### 工作区图像生成提示词（评估对象）
{{optimizedPrompt}}

{{#hasUserFeedback}}
### 用户反馈（优先关注）
{{{userFeedback}}}

{{/hasUserFeedback}}
---

请评估当前图像生成提示词的质量{{#hasOriginalPrompt}}，并与原始版本对比{{/hasOriginalPrompt}}。`
    }
  ] as MessageTemplate[],
  metadata: {
    version: '1.0.0',
    lastModified: Date.now(),
    author: 'System',
    description: '直接评估图像生成提示词质量（文生图模式），统一输出 improvements + patchPlan',
    templateType: 'evaluation',
    language: 'zh',
    tags: ['evaluation', 'prompt-only', 'scoring', 'image', 'text2image']
  },
  isBuiltin: true
};
