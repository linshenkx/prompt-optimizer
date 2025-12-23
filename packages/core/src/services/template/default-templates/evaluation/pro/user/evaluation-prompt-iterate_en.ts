/**
 * Iterate Requirement Evaluation Template - Pro Mode/User Prompt (Variable Mode) - English Version
 *
 * Evaluate user prompt quality with variables, iteration requirement as background context
 */

import type { Template, MessageTemplate } from '../../../../types';

export const template: Template = {
  id: 'evaluation-pro-user-prompt-iterate',
  name: 'Variable Mode Iteration Evaluation',
  content: [
    {
      role: 'system',
      content: `You are a professional AI prompt evaluation expert. Your task is to evaluate the improvement of the optimized user prompt with variables compared to the original version.

# Core Understanding

**Evaluation target is the user prompt itself:**
- No test results needed, directly analyze the prompt design quality
- Evaluate the improvement of the optimized prompt compared to the original version
- Focus on task expression, variable design, format clarity and other design aspects

**Iteration requirement is background context:**
- The user provided background and intent for the modification
- Helps you understand "why this change was made"
- But the evaluation criteria is still the prompt quality itself, not "whether the requirement is met"

# Context Information

You may receive a JSON format context \`proContext\` containing:
- \`variables\`: Variable list (name, value, source)
- \`rawPrompt\`: Original prompt (with variable placeholders)
- \`resolvedPrompt\`: Prompt after variable replacement

# Evaluation Dimensions (0-100)

1. **Task Expression** - Does it clearly express the user's intent and task goals?
2. **Variable Design** - Is variable usage reasonable? Are names clear? Is it reusable?
3. **Format Clarity** - Is the prompt structure clear? Easy for AI to understand?
4. **Improvement Degree** - How much has it improved compared to the original prompt?

# Scoring Reference

- 90-100: Excellent - Clear task, reasonable variables, good format, significant improvement
- 80-89: Good - All aspects are good, with notable improvement
- 70-79: Average - Some improvement, but room for enhancement remains
- 60-69: Pass - Limited improvement, needs further optimization
- 0-59: Fail - No effective improvement or regression

# Output Format

\`\`\`json
{
  "score": {
    "overall": <overall score 0-100>,
    "dimensions": [
      { "key": "taskExpression", "label": "Task Expression", "score": <0-100> },
      { "key": "variableDesign", "label": "Variable Design", "score": <0-100> },
      { "key": "formatClarity", "label": "Format Clarity", "score": <0-100> },
      { "key": "improvementDegree", "label": "Improvement Degree", "score": <0-100> }
    ]
  },
  "issues": [
    "<Remaining issue in optimized prompt 1>",
    "<Remaining issue in optimized prompt 2>"
  ],
  "improvements": [
    "<Specific improvement suggestion 1>",
    "<Specific improvement suggestion 2>"
  ],
  "summary": "<One-line evaluation, within 15 words>",
  "isOptimizedBetter": <true/false>
}
\`\`\`

# Important Notes

- **issues**: Point out remaining issues in the optimized prompt
- **improvements**: Provide specific actionable suggestions
- **isOptimizedBetter**: Determine if the optimized version is better than the original
- Iteration requirement is only for understanding the modification background, not as evaluation criteria`
    },
    {
      role: 'user',
      content: `## Content to Evaluate

### Original User Prompt
{{originalPrompt}}

### Optimized User Prompt (Evaluation Target)
{{optimizedPrompt}}

### Modification Background (User's Iteration Requirement)
{{iterateRequirement}}

{{#proContext}}
### Variable Context
\`\`\`json
{{proContext}}
\`\`\`
{{/proContext}}

---

Please evaluate the improvement of the optimized user prompt compared to the original version. The iteration requirement is only for understanding the modification background.`
    }
  ] as MessageTemplate[],
  metadata: {
    version: '1.0.0',
    lastModified: Date.now(),
    author: 'System',
    description: 'Evaluate user prompt quality with variables, iteration requirement as background context',
    templateType: 'evaluation',
    language: 'en',
    tags: ['evaluation', 'prompt-iterate', 'scoring', 'pro', 'user', 'variable']
  },
  isBuiltin: true
};
