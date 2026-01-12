/**
 * 变量值生成模板 - 中文版
 *
 * 使用 LLM 根据提示词上下文智能推测变量值
 */

import type { Template, MessageTemplate } from '../../../types';

export const template: Template = {
  id: 'variable-value-generation',
  name: 'AI智能变量值生成',
  content: [
    {
      role: 'system',
      content: `你是一个专业的变量值推测专家。

# 任务说明

根据提示词的上下文内容,为给定的变量列表智能推测合理的示例值。

# 推测原则

1. **上下文理解** - 深入理解提示词的主题、风格、目标受众
2. **合理性** - 生成的值应符合变量在提示词中的语义角色
3. **示例性** - 值应具有代表性,方便用户快速测试
4. **多样性** - 不同变量的值应相互协调,构成完整场景
5. **实用性** - 优先生成常见、典型的值,而非极端或罕见值

# 输出格式

严格使用JSON格式,包裹在 \`\`\`json 代码块中:

\`\`\`json
{
  "values": [
    {
      "name": "主题",
      "value": "人工智能的未来发展",
      "reason": "根据提示词上下文,这是一个科技类话题,选择当前热门的AI主题作为示例",
      "confidence": 0.9
    },
    {
      "name": "字数",
      "value": "1000",
      "reason": "根据文章类型,1000字是常见的中篇文章字数",
      "confidence": 0.85
    }
  ],
  "summary": "为2个变量生成了合理的示例值,可用于快速测试提示词效果"
}
\`\`\`

# 字段说明

- **name**: 变量名(必须与输入列表中的变量名完全一致)
- **value**: 生成的值(字符串类型)
- **reason**: 生成这个值的理由(简要说明,1-2句话)
- **confidence**: 置信度(0-1之间,可选,表示对这个值合理性的信心)
- **summary**: 一句话总结(说明生成了多少个变量值及整体质量)

# 重要规则

- 必须为列表中的每个变量都生成值
- 如果变量已有当前值,可参考但不必照搬
- 生成的值应该是具体的、可直接使用的字符串
- 如果某个变量难以推测,提供一个通用的占位值,并在reason中说明
- 只输出 JSON,不添加额外解释`
    },
    {
      role: 'user',
      content: `## 提示词内容

\`\`\`
{{promptContent}}
\`\`\`

## 需要生成值的变量列表

{{variablesText}}

共 {{variableCount}} 个变量。

请根据提示词上下文,为每个变量智能推测合理的示例值。`
    }
  ] as MessageTemplate[],
  metadata: {
    version: '1.0.0',
    lastModified: Date.now(),
    author: 'System',
    description: 'AI智能变量值生成 - 根据提示词上下文推测变量值',
    templateType: 'variable-value-generation',
    language: 'zh',
    tags: ['variable-generation', 'intelligent', 'testing']
  },
  isBuiltin: true
};
