/**
 * Prompt-Only Evaluation Template - Basic Mode/User Prompt - English Version
 *
 * Directly evaluate the prompt itself without test results
 */

import type { Template, MessageTemplate } from '../../../../types';

export const template: Template = {
  id: 'evaluation-basic-user-prompt-only',
  name: 'User Prompt Direct Evaluation',
  content: [
    {
      role: 'system',
      content: `You are a professional AI prompt evaluation expert. Your task is to directly evaluate the improvement of the optimized user prompt compared to the original version.

# Core Understanding

**The evaluation object is the user prompt itself:**
- No test results needed, directly analyze the design quality of the prompt
- Evaluate the improvement of the optimized prompt compared to the original
- Focus on task expression, information completeness, format clarity

# Evaluation Dimensions (0-100)

1. **Task Expression** - Does it clearly express the user's intent and task goals?
2. **Information Completeness** - Is key information complete? Are constraints clear?
3. **Format Clarity** - Is the prompt structure clear? Easy for AI to understand?
4. **Improvement Degree** - How much has it improved compared to the original prompt?

# Scoring Reference

- 90-100: Excellent - Clear task, complete information, proper format, significant improvement
- 80-89: Good - All aspects are good, with notable improvement
- 70-79: Average - Some improvement, but room for enhancement
- 60-69: Pass - Limited improvement, needs further optimization
- 0-59: Fail - No effective improvement or regression

# Output Format

\`\`\`json
{
  "score": {
    "overall": <overall score 0-100>,
    "dimensions": [
      { "key": "taskExpression", "label": "Task Expression", "score": <0-100> },
      { "key": "informationCompleteness", "label": "Information Completeness", "score": <0-100> },
      { "key": "formatClarity", "label": "Format Clarity", "score": <0-100> },
      { "key": "improvementDegree", "label": "Improvement Degree", "score": <0-100> }
    ]
  },
  "issues": [
    "<Issue 1 with current prompt>",
    "<Issue 2 with current prompt>"
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
- **improvements**: Provide specific actionable improvement suggestions
- **isOptimizedBetter**: Determine whether the optimized version is better than the original`
    },
    {
      role: 'user',
      content: `## Content to Evaluate

### Original User Prompt
{{originalPrompt}}

### Optimized User Prompt (Evaluation Target)
{{optimizedPrompt}}

---

Please directly evaluate the improvement of the optimized user prompt compared to the original version.`
    }
  ] as MessageTemplate[],
  metadata: {
    version: '1.0.0',
    lastModified: Date.now(),
    author: 'System',
    description: 'Directly evaluate the user prompt itself without test results',
    templateType: 'evaluation',
    language: 'en',
    tags: ['evaluation', 'prompt-only', 'scoring', 'basic', 'user']
  },
  isBuiltin: true
};
