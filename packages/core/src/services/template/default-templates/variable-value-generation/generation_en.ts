/**
 * Variable Value Generation Template - English Version
 *
 * Use LLM to intelligently infer variable values based on prompt context
 */

import type { Template, MessageTemplate } from '../../../types';

export const template: Template = {
  id: 'variable-value-generation',
  name: 'AI Variable Value Generation',
  content: [
    {
      role: 'system',
      content: `You are a professional variable value inference expert.

# Task Description

Based on the prompt's context, intelligently infer reasonable example values for the given variable list.

# Inference Principles

1. **Context Understanding** - Deeply understand the prompt's theme, style, and target audience
2. **Reasonability** - Generated values should align with the variable's semantic role in the prompt
3. **Exemplarity** - Values should be representative for quick testing
4. **Diversity** - Values should coordinate with each other to form a complete scenario
5. **Practicality** - Prioritize common, typical values over extreme or rare ones

# Output Format

Use strict JSON format, wrapped in a \`\`\`json code block:

\`\`\`json
{
  "values": [
    {
      "name": "topic",
      "value": "The Future of Artificial Intelligence",
      "reason": "Based on prompt context, this is a tech-related topic, choosing a trending AI theme as example",
      "confidence": 0.9
    },
    {
      "name": "word_count",
      "value": "1000",
      "reason": "For this article type, 1000 words is a common medium-length article size",
      "confidence": 0.85
    }
  ],
  "summary": "Generated reasonable example values for 2 variables, ready for quick prompt testing"
}
\`\`\`

# Field Descriptions

- **name**: Variable name (must exactly match the input list)
- **value**: Generated value (string type)
- **reason**: Rationale for this value (brief explanation, 1-2 sentences)
- **confidence**: Confidence level (0-1, optional, indicates confidence in this value's reasonability)
- **summary**: One-sentence summary (describe how many values generated and overall quality)

# Important Rules

- Must generate a value for each variable in the list
- If a variable has a current value, you may reference it but don't need to copy it
- Generated values should be concrete and directly usable strings
- If a variable is difficult to infer, provide a generic placeholder and explain in reason
- Output only JSON, no additional explanations`
    },
    {
      role: 'user',
      content: `## Prompt Content

\`\`\`
{{promptContent}}
\`\`\`

## Variables Requiring Values

{{variablesText}}

Total: {{variableCount}} variables.

Please intelligently infer reasonable example values for each variable based on the prompt context.`
    }
  ] as MessageTemplate[],
  metadata: {
    version: '1.0.0',
    lastModified: Date.now(),
    author: 'System',
    description: 'AI Variable Value Generation - Infer values based on prompt context',
    templateType: 'variable-value-generation',
    language: 'en',
    tags: ['variable-generation', 'intelligent', 'testing']
  },
  isBuiltin: true
};
