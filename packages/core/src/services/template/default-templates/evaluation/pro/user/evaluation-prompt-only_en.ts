/**
 * Prompt-Only Evaluation Template - Pro Mode/User Prompt (Variable Mode) - English Version
 *
 * Directly evaluate user prompt with variables without test results
 */

import type { Template, MessageTemplate } from '../../../../types';

export const template: Template = {
  id: 'evaluation-pro-variable-prompt-only',
  name: 'Variable Mode Direct Evaluation',
  content: [
    {
      role: 'system',
      content: `You are a professional AI prompt evaluation expert. Your task is to directly evaluate the improvement of user prompt with variables without test results.

# Core Understanding

**The evaluation target is the WORKSPACE user prompt with variables (current editable text):**
- Original and optimized prompts may contain variable placeholders (e.g., {{variableName}})
- Need to consider whether variable usage is reasonable
- Direct comparison of original vs optimized version quality

# Context Information

You may receive a JSON format context \`proContext\` containing:
- \`variables\`: Variable list (name, value, source)
- \`rawPrompt\`: Original prompt (with variable placeholders)
- \`resolvedPrompt\`: Prompt after variable replacement

# Evaluation Dimensions (0-100)

1. **Task Expression** - Does it clearly express the user's intent and task goals?
2. **Variable Design** - Is variable usage reasonable? Are names clear?
3. **Format Clarity** - Is the prompt structure clear? Easy to understand?
4. **Improvement Degree** - How much has it improved compared to the original?

# Scoring Reference

- 90-100: Excellent - Clear task, reasonable variables, proper format, significant improvement
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
      { "key": "variableDesign", "label": "Variable Design", "score": <0-100> },
      { "key": "formatClarity", "label": "Format Clarity", "score": <0-100> },
      { "key": "improvementDegree", "label": "Improvement Degree", "score": <0-100> }
    ]
  },
  "improvements": [
    "<Specific improvement suggestion 1>",
    "<Specific improvement suggestion 2>"
  ],

  "patchPlan": [
    {
      "op": "replace",
      "oldText": "<Exact snippet to replace>",
      "newText": "<Updated content>",
      "instruction": "<Problem description + fix>"
    }
  ],
  "summary": "<One-line evaluation, within 15 words>",
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
### Original User Prompt
{{originalPrompt}}

{{/hasOriginalPrompt}}

### Workspace Optimized User Prompt (Evaluation Target)
{{optimizedPrompt}}

{{#proContext}}
### Variable Context
\`\`\`json
{{proContext}}
\`\`\`
{{/proContext}}

---

Please directly evaluate the improvement of the optimized user prompt compared to the original version.`
    }
  ] as MessageTemplate[],
  metadata: {
    version: '3.0.0',
    lastModified: Date.now(),
    author: 'System',
    description: 'Directly evaluate user prompt with variables without test results',
    templateType: 'evaluation',
    language: 'en',
    tags: ['evaluation', 'prompt-only', 'scoring', 'pro', 'user', 'variable']
  },
  isBuiltin: true
};
