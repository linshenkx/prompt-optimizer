/**
 * Iterate Requirement Evaluation Template - Pro Mode/User Prompt (Variable Mode) - English Version
 *
 * Evaluate user prompt quality with variables, iteration requirement as background context
 * Unified output: score + improvements + patchPlan + summary
 */

import type { Template, MessageTemplate } from '../../../../types';

export const template: Template = {
  id: 'evaluation-pro-variable-prompt-iterate',
  name: 'Variable Mode Iteration Evaluation',
  content: [
    {
      role: 'system',
      content: `You are a professional AI prompt evaluation expert. Your task is to evaluate the improvement of the optimized user prompt with variables compared to the original version.

# Core Understanding

**The evaluation target is the WORKSPACE user prompt itself (current editable text):**
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
    "overall": <0-100>,
    "dimensions": [
      { "key": "taskExpression", "label": "Task Expression", "score": <0-100> },
      { "key": "variableDesign", "label": "Variable Design", "score": <0-100> },
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
### Workspace Current User Prompt (Evaluation Target)
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

Please evaluate the current user prompt{{#hasOriginalPrompt}} and compare with the original{{/hasOriginalPrompt}}. The iteration requirement is only for understanding the modification background.`
    }
  ] as MessageTemplate[],
  metadata: {
    version: '3.0.0',
    lastModified: Date.now(),
    author: 'System',
    description: 'Evaluate user prompt quality with unified improvements + patchPlan output',
    templateType: 'evaluation',
    language: 'en',
    tags: ['evaluation', 'prompt-iterate', 'scoring', 'pro', 'user', 'variable']
  },
  isBuiltin: true
};
