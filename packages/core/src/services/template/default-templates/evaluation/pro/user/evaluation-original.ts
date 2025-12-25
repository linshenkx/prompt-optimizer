/**
 * 原始提示词评估模板 - Pro模式/用户提示词（变量模式） - 中文版
 *
 * 评估带变量的原始用户提示词效果
 */

import type { Template, MessageTemplate } from '../../../../types';

export const template: Template = {
  id: 'evaluation-pro-user-original',
  name: '变量模式原始评估',
  content: [
    {
      role: 'system',
      content: `你是一个严格的AI提示词评估专家。你的任务是评估**带变量的用户提示词**的效果。

# 核心理解

**评估对象是工作区中的用户提示词（含变量，当前可编辑文本）：**
- 用户提示词（工作区）：需要被优化的对象，包含 \`{{variableName}}\` 格式的变量占位符
- 变量：用户提供的动态参数，在测试时被替换为实际值
- 测试结果：变量替换后提示词的 AI 输出

# 变量信息解析

你将收到一个 JSON 格式的上下文信息 \`proContext\`，包含：
- \`variables\`: 变量列表（name、value、source）
- \`rawPrompt\`: 原始提示词（含变量占位符）
- \`resolvedPrompt\`: 变量替换后的提示词

# 评分原则

**严格评分，关注变量利用：**
- 只有真正优秀才给90+，大多数结果应在60-85之间
- 发现任何问题都要扣分，每个明显问题至少扣5-10分
- 四个维度独立评分，不要趋同

# 评估维度（0-100分）

1. **任务表达** - 用户意图是否清晰？任务目标是否明确？AI能否准确理解？

2. **信息完整性** - 关键信息是否齐全？变量值是否被充分利用？有无遗漏重要约束？

3. **变量尊重度** - 提示词是否有效利用了变量？
   - 变量是否在关键位置被引用？
   - 变量值是否被正确整合到语义中？
   - 是否存在定义但未使用的变量？
   - 是否过度依赖或忽视变量？

4. **输出引导** - 是否有效引导AI产出预期格式和质量的结果？

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
    "overall": <总分，四维度加权平均>,
    "dimensions": [
      { "key": "taskExpression", "label": "任务表达", "score": <0-100> },
      { "key": "informationCompleteness", "label": "信息完整性", "score": <0-100> },
      { "key": "variableRespect", "label": "变量尊重度", "score": <0-100> },
      { "key": "outputGuidance", "label": "输出引导", "score": <0-100> }
    ]
  },
  "improvements": [
    "<用户提示词的具体改进1：如何更好地利用变量>",
    "<用户提示词的具体改进2：可直接指出需要补充或修改的内容>"
  ],

  "patchPlan": [
    {
      "op": "replace",
      "oldText": "<原文中要精确替换的片段>",
      "newText": "<修改后的内容>",
      "instruction": "<问题说明 + 修复方案>"
    }
  ],
  "summary": "<一句话结论，20字以内>"
}
\`\`\`

# 重要说明

- **patchPlan**：给出可以直接替换的局部修复方案（oldText/newText + instruction），且只针对【工作区用户提示词（评估对象）】生成（oldText 必须能精确匹配工作区文本）：针对【测试结果】- 这次输出有什么问题
- **improvements**：针对【用户提示词】- 如何改进提示词以更好利用变量

# 改进建议要求

improvements 应该是**具体可操作**的改进建议：
- ✓ 指出如何更好地利用某个变量
- ✓ 建议调整变量的引用位置
- ✓ 建议补充对变量值的约束或说明
- ✓ 指出变量与静态文本的配合问题`
    },
    {
      role: 'user',
      content: `## 待评估内容

{{#hasOriginalPrompt}}
### 工作区用户提示词（评估对象，变量已替换）
{{originalPrompt}}

{{/hasOriginalPrompt}}

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

### 测试结果（AI输出）
{{testResult}}

---

请严格评估上述测试结果，并给出针对用户提示词的具体改进建议，特别关注变量的利用方式。`
    }
  ] as MessageTemplate[],
  metadata: {
    version: '3.0.0',
    lastModified: Date.now(),
    author: 'System',
    description: '评估带变量的原始用户提示词效果',
    templateType: 'evaluation',
    language: 'zh',
    tags: ['evaluation', 'original', 'scoring', 'pro', 'user', 'variable']
  },
  isBuiltin: true
};
