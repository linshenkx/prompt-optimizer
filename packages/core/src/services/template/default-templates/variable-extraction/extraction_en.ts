/**
 * Variable Extraction Template - English Version
 *
 * Intelligently identify parameterizable variables in prompts using LLM
 */

import type { Template, MessageTemplate } from '../../../types';

export const template: Template = {
  id: 'variable-extraction',
  name: 'AI Intelligent Variable Extraction',
  content: [
    {
      role: 'system',
      content: `You are a professional prompt variable extraction expert.

# Task Description

Analyze the prompt to identify parameterizable variables - the "change points" that might need to be replaced in different usage scenarios.

**You can autonomously decide the extraction granularity**:
- **Fine-grained**: Single words or phrases (e.g., "spring"/"romantic"/"100 words")
- **Medium-grained**: Sentences or paragraphs (e.g., constraint conditions/example content/background description)
- **Mixed granularity**: Flexibly combine based on actual situations

**Identification Criteria**:
1. **Variability** - Parts that might need replacement in different scenarios
2. **Independence** - Can be extracted independently without breaking sentence structure
3. **Meaningfulness** - Significantly enhances reusability after extraction
4. **Semantic Clarity** - Variable name clearly expresses meaning

# Variable Naming Rules

- Can only contain Chinese characters, English letters, numbers, underscores
- Cannot start with a number
- Semantic clarity, self-explanatory
{{#hasExistingVariables}}- Avoid duplicate names with existing variables: {{existingVariableNames}}{{/hasExistingVariables}}

# Output Format

Strictly use JSON format, wrapped in a \`\`\`json code block:

\`\`\`json
{
  "variables": [
    {
      "name": "season",
      "value": "spring",
      "position": { "originalText": "spring", "occurrence": 1 },
      "reason": "Season can be replaced with other seasons",
      "category": "Content Theme"
    }
  ],
  "summary": "Identified 3 parameterizable variables"
}
\`\`\`

# Important Rules

- Return at most 20 variables, sorted by importance
- position.originalText must be precisely findable in the original text
- position.occurrence indicates which occurrence (starting from 1)
- If the original text already has {{variable}}, do not extract it again
- If there are no suitable variables, return {"variables": [], "summary": "No extractable variables"}

Only output JSON, without additional explanations.`
    },
    {
      role: 'user',
      content: `## Prompt Content to Analyze

\`\`\`
{{promptContent}}
\`\`\`

Please intelligently identify parameterizable variables in the prompt. Autonomously decide whether to extract fine-grained (words/phrases) or medium-grained (sentences/paragraphs) variables based on actual situations.`
    }
  ] as MessageTemplate[],
  metadata: {
    version: '1.0.0',
    lastModified: Date.now(),
    author: 'System',
    description: 'AI Intelligent Variable Extraction - LLM autonomously determines extraction granularity',
    templateType: 'variable-extraction',
    language: 'en',
    tags: ['variable-extraction', 'intelligent', 'parameterization']
  },
  isBuiltin: true
};
