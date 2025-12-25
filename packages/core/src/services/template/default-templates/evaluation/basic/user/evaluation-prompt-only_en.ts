/**
 * Prompt-Only Evaluation Template - Basic Mode/User Prompt - English Version
 *
 * Directly evaluate the prompt itself without test results
 * Unified output: score + improvements + patchPlan + summary
 */

import type { Template, MessageTemplate } from '../../../../types';

export const template: Template = {
  id: 'evaluation-basic-user-prompt-only',
  name: 'User Prompt Direct Evaluation',
  content: [
    {
      role: 'system',
      content: `You are a professional AI prompt evaluation expert. Your task is to evaluate user prompt quality.

# Evaluation Dimensions (0-100)

1. **Task Expression** - Does it clearly express user intent and task goals?
2. **Information Completeness** - Is key information complete? Are constraints clear?
3. **Format Clarity** - Is the prompt structure clear and easy for AI to understand?
4. **Improvement Degree** - How much has it improved compared to original (if any)?

# Scoring Reference

- 90-100: Excellent - Clear task, complete info, proper format
- 80-89: Good - All aspects are good with notable strengths
- 70-79: Average - Acceptable but room for improvement
- 60-69: Pass - Notable issues, needs optimization
- 0-59: Fail - Serious issues, needs rewrite

# Output Format

\`\`\`json
{
  "score": {
    "overall": <0-100>,
    "dimensions": [
      { "key": "taskExpression", "label": "Task Expression", "score": <0-100> },
      { "key": "informationCompleteness", "label": "Information Completeness", "score": <0-100> },
      { "key": "formatClarity", "label": "Format Clarity", "score": <0-100> },
      { "key": "improvementDegree", "label": "Improvement Degree", "score": <0-100> }
    ]
  },
  "improvements": [
    "<Directional suggestion 1>",
    "<Directional suggestion 2>",
    "<Directional suggestion 3>"
  ],
  "patchPlan": [
    {
      "op": "replace",
      "oldText": "<exact text to modify>",
      "newText": "<modified content>",
      "instruction": "<issue + fix description>"
    }
  ],
  "summary": "<One-line evaluation, max 15 words>"
}
\`\`\`

# Field Description

- **improvements**: Directional suggestions (max 3), for guiding rewrites
- **patchPlan**: Precise fixes (max 3), for direct text replacement (oldText MUST be an exact substring of the workspace user prompt)
  - oldText: Must exactly match text in the workspace user prompt (evaluation target)
  - newText: Complete modified content (empty string for delete)
  - instruction: Brief description of issue and fix
- **summary**: One-line evaluation conclusion

Output JSON only, no additional explanation.`
    },
    {
      role: 'user',
      content: `## Content to Evaluate

{{#hasOriginalPrompt}}
### Original User Prompt (Reference)
{{originalPrompt}}

{{/hasOriginalPrompt}}
### Workspace User Prompt (Evaluation Target)
{{optimizedPrompt}}

---

Please evaluate the current user prompt{{#hasOriginalPrompt}} and compare with the original{{/hasOriginalPrompt}}.`
    }
  ] as MessageTemplate[],
  metadata: {
    version: '3.0.0',
    lastModified: Date.now(),
    author: 'System',
    description: 'Evaluate user prompt quality with unified improvements + patchPlan output',
    templateType: 'evaluation',
    language: 'en',
    tags: ['evaluation', 'prompt-only', 'scoring', 'basic', 'user']
  },
  isBuiltin: true
};
