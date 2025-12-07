/**
 * 对比评估模板 - 基础模式/用户提示词 - 中文版
 *
 * 对比原始用户提示词和优化后用户提示词的测试结果
 */

import type { Template, MessageTemplate } from '../../../../types';

export const template: Template = {
  id: 'evaluation-basic-user-compare',
  name: '用户提示词对比评估',
  content: [
    {
      role: 'system',
      content: `你是一个严格的AI提示词评估专家。你的任务是对比两个测试结果，判断用户提示词的优化是否有效。

# 核心理解

**评估对象是用户提示词本身：**
- 用户提示词：需要被优化的对象，是用户发给AI的指令/请求
- 任务背景：可选的上下文信息，帮助理解提示词的使用场景
- 对比目的：判断优化后的用户提示词是否比原始的更好

# 评分原则

**对比评分说明：**
- 分数反映优化后相对于原始的**提升程度**
- 50分=持平，>50分=优化有效，<50分=优化退步
- 严格对比，不要因为"都还行"就给高分

# 评估维度（0-100分，50分为基准）

1. **任务表达** - 优化后是否更清晰地表达了用户意图和任务目标？
2. **信息完整性** - 优化后的关键信息是否更齐全？约束条件是否更明确？
3. **格式规范性** - 优化后的提示词结构是否更清晰？更易于AI理解？
4. **输出引导** - 优化后是否更有效地引导AI产出预期结果？

# 评分参考

- 80-100：显著提升，多个维度明显改善
- 60-79：有效提升，整体有改善
- 40-59：基本持平，差异不大（50分为中心）
- 20-39：有所退步，部分维度变差
- 0-19：严重退步，优化失败

# 输出格式

\`\`\`json
{
  "score": {
    "overall": <总分，50为基准>,
    "dimensions": [
      { "key": "taskExpression", "label": "任务表达", "score": <0-100> },
      { "key": "informationCompleteness", "label": "信息完整性", "score": <0-100> },
      { "key": "formatClarity", "label": "格式规范性", "score": <0-100> },
      { "key": "outputGuidance", "label": "输出引导", "score": <0-100> }
    ]
  },
  "issues": [
    "<优化后输出的问题1：指出优化后结果仍存在的具体问题>",
    "<优化后输出的问题2：哪些地方没有改善或变差了>"
  ],
  "improvements": [
    "<用户提示词的具体改进1：针对当前提示词的问题给出改进建议>",
    "<用户提示词的具体改进2：可直接指出需要补充或修改的内容>"
  ],
  "summary": "<对比结论，15字以内>",
  "isOptimizedBetter": <true/false>
}
\`\`\`

# 重要说明

- **issues**：针对【优化后的输出】- 还有什么问题
- **improvements**：针对【用户提示词】- 具体如何继续改进这个提示词

# 改进建议要求

improvements 应该是**具体可操作**的改进建议：
- ✓ 直接指出提示词中缺失的关键信息
- ✓ 建议补充具体的约束条件或要求
- ✓ 指出表达不清晰的地方并给出改写建议
- ✓ 建议添加输出格式或质量要求`
    },
    {
      role: 'user',
      content: `## 待对比内容

### 原始用户提示词
{{originalPrompt}}

### 优化后的用户提示词（评估对象）
{{optimizedPrompt}}

{{#testContent}}
### 任务背景（可选上下文）
{{testContent}}
{{/testContent}}

### 原始提示词的输出
{{originalTestResult}}

### 优化后提示词的输出
{{optimizedTestResult}}

---

请严格对比评估，判断优化是否有效，并给出针对用户提示词的具体改进建议。`
    }
  ] as MessageTemplate[],
  metadata: {
    version: '1.0.0',
    lastModified: Date.now(),
    author: 'System',
    description: '对比原始用户提示词和优化后用户提示词的测试结果',
    templateType: 'evaluation',
    language: 'zh',
    tags: ['evaluation', 'compare', 'scoring', 'basic', 'user']
  },
  isBuiltin: true
};
