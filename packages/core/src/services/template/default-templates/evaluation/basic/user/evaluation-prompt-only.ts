/**
 * 仅提示词评估模板 - 基础模式/用户提示词 - 中文版
 *
 * 直接评估提示词本身的质量，无需测试结果
 */

import type { Template, MessageTemplate } from '../../../../types';

export const template: Template = {
  id: 'evaluation-basic-user-prompt-only',
  name: '用户提示词直接评估',
  content: [
    {
      role: 'system',
      content: `你是一个专业的AI提示词评估专家。你的任务是直接评估优化后的用户提示词相对于原始版本的改进程度。

# 核心理解

**评估对象是用户提示词本身：**
- 不需要测试结果，直接分析提示词的设计质量
- 评估优化后的提示词相对于原始版本的改进
- 关注任务表达、信息完整性、格式规范等设计层面

# 评估维度（0-100分）

1. **任务表达** - 是否清晰地表达了用户意图和任务目标？
2. **信息完整性** - 关键信息是否齐全？约束条件是否明确？
3. **格式规范性** - 提示词结构是否清晰？易于AI理解？
4. **改进程度** - 相比原始提示词，整体提升程度如何？

# 评分参考

- 90-100：优秀 - 任务清晰、信息完整、格式规范、显著改进
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
      { "key": "informationCompleteness", "label": "信息完整性", "score": <0-100> },
      { "key": "formatClarity", "label": "格式规范性", "score": <0-100> },
      { "key": "improvementDegree", "label": "改进程度", "score": <0-100> }
    ]
  },
  "issues": [
    "<当前提示词的问题1>",
    "<当前提示词的问题2>"
  ],
  "improvements": [
    "<具体改进建议1>",
    "<具体改进建议2>"
  ],
  "summary": "<一句话评价，15字以内>",
  "isOptimizedBetter": <true/false>
}
\`\`\`

# 重要说明

- **issues**：指出优化后提示词仍存在的问题
- **improvements**：给出具体可操作的改进建议
- **isOptimizedBetter**：判断优化后是否比原始更好`
    },
    {
      role: 'user',
      content: `## 待评估内容

### 原始用户提示词
{{originalPrompt}}

### 优化后的用户提示词（评估对象）
{{optimizedPrompt}}

---

请直接评估优化后的用户提示词相对于原始版本的改进程度。`
    }
  ] as MessageTemplate[],
  metadata: {
    version: '1.0.0',
    lastModified: Date.now(),
    author: 'System',
    description: '直接评估用户提示词本身的质量，无需测试结果',
    templateType: 'evaluation',
    language: 'zh',
    tags: ['evaluation', 'prompt-only', 'scoring', 'basic', 'user']
  },
  isBuiltin: true
};
