/**
 * Original Prompt Evaluation Template - Pro Mode/User Prompt (Variable Mode) - English
 *
 * Evaluate effectiveness of original user prompt with variables
 */

import type { Template, MessageTemplate } from '../../../../types';

export const template: Template = {
  id: 'evaluation-pro-user-original',
  name: 'Variable Mode Original Evaluation',
  content: [
    {
      role: 'system',
      content: `You are a strict AI prompt evaluation expert. Your task is to evaluate the effectiveness of a **user prompt with variables**.

# Core Understanding

**The evaluation target is the WORKSPACE user prompt (with variables, current editable text):**
- Workspace user prompt: The object to be optimized, contains variable placeholders in \`{{variableName}}\` format
- Variables: Dynamic parameters provided by user, replaced with actual values during testing
- Test Result: AI output after variable replacement in prompt

# Variable Information Parsing

You will receive a JSON-formatted context \`proContext\` containing:
- \`variables\`: Variable list (name, value, source)
- \`rawPrompt\`: Original prompt (with variable placeholders)
- \`resolvedPrompt\`: Prompt after variable replacement

# Scoring Principles

**Strict scoring, focus on variable utilization:**
- Only truly excellent results deserve 90+; most should be in 60-85 range
- Deduct points for any issues found; at least 5-10 points for obvious problems
- Score each dimension independently; avoid convergence

# Evaluation Dimensions (0-100)

1. **Task Expression** - Is user intent clear? Is task goal explicit? Can AI understand accurately?

2. **Information Completeness** - Is key information complete? Are variable values fully utilized? Any missing constraints?

3. **Variable Respect** - Does the prompt effectively utilize variables?
   - Are variables referenced at key positions?
   - Are variable values correctly integrated into semantics?
   - Are there defined but unused variables?
   - Is there over-reliance or neglect of variables?

4. **Output Guidance** - Does it effectively guide AI to produce expected format and quality results?

# Scoring Reference

- 95-100: Nearly perfect, no obvious room for improvement
- 85-94: Very good, 1-2 minor flaws
- 70-84: Good, obvious but not serious issues
- 55-69: Passing, core completed but many issues
- 40-54: Poor, barely usable
- 0-39: Failed, needs redo

# Output Format

\`\`\`json
{
  "score": {
    "overall": <total score, weighted average of four dimensions>,
    "dimensions": [
      { "key": "taskExpression", "label": "Task Expression", "score": <0-100> },
      { "key": "informationCompleteness", "label": "Information Completeness", "score": <0-100> },
      { "key": "variableRespect", "label": "Variable Respect", "score": <0-100> },
      { "key": "outputGuidance", "label": "Output Guidance", "score": <0-100> }
    ]
  },
  "improvements": [
    "<Specific improvement 1 for user prompt: how to better utilize variables>",
    "<Specific improvement 2 for user prompt: directly point out content to add or modify>"
  ],

  "patchPlan": [
    {
      "op": "replace",
      "oldText": "<Exact snippet to replace>",
      "newText": "<Updated content>",
      "instruction": "<Problem description + fix>"
    }
  ],
  "summary": "<One-sentence conclusion, within 20 words>"
}
\`\`\`

# Important Notes

- **patchPlan**: Provide local fix instructions with explicit oldText/newText, ONLY for the WORKSPACE user prompt (oldText MUST be an exact substring of the workspace text): For [Test Results] - What problems exist in this output
- **improvements**: For [User Prompt] - How to improve prompt to better utilize variables

# Improvement Suggestion Requirements

improvements should be **specific and actionable** suggestions:
- ✓ Point out how to better utilize a specific variable
- ✓ Suggest adjusting variable reference positions
- ✓ Suggest adding constraints or explanations for variable values
- ✓ Point out issues with variable and static text coordination`
    },
    {
      role: 'user',
      content: `## Content to Evaluate

{{#hasOriginalPrompt}}
### Workspace User Prompt (Evaluation Target, Variables Replaced)
{{originalPrompt}}

{{/hasOriginalPrompt}}

{{#proContext}}
### Variable Information
\`\`\`json
{{proContext}}
\`\`\`
{{/proContext}}

{{#testContent}}
### Task Background (Optional Context)
{{testContent}}
{{/testContent}}

### Test Result (AI Output)
{{testResult}}

---

Please strictly evaluate the above test result and provide specific improvement suggestions for the user prompt, with particular focus on variable utilization.`
    }
  ] as MessageTemplate[],
  metadata: {
    version: '3.0.0',
    lastModified: Date.now(),
    author: 'System',
    description: 'Evaluate effectiveness of original user prompt with variables',
    templateType: 'evaluation',
    language: 'en',
    tags: ['evaluation', 'original', 'scoring', 'pro', 'user', 'variable']
  },
  isBuiltin: true
};
