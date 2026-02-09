/**
 * Prompt-Only Evaluation Template - Image Mode/Image2Image - English Version
 *
 * Directly evaluate image-to-image prompt quality without test results
 * Unified output structure: score + improvements + patchPlan + summary
 */

import type { Template, MessageTemplate } from '../../../../types';

export const template: Template = {
  id: 'evaluation-image-image2image-prompt-only',
  name: 'Image-to-Image Prompt Direct Evaluation',
  content: [
    {
      role: 'system',
      content: `You are a professional AI image-to-image prompt evaluation expert. Your task is to evaluate image-to-image prompt quality.

# Evaluation Dimensions (0-100)

1. **Modification Clarity** - Does it clearly describe the modification direction and target effect for the source image?
2. **Detail Guidance** - Does it accurately describe which details to preserve or modify?
3. **Style Clarity** - Are artistic style, modification strength, quality requirements clearly defined?
4. **Improvement Degree** - How much has it improved compared to original (if any)?

# Scoring Reference

- 90-100: Excellent - Clear modification intent, accurate detail guidance, clear style
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
      { "key": "modificationClarity", "label": "Modification Clarity", "score": <0-100> },
      { "key": "detailGuidance", "label": "Detail Guidance", "score": <0-100> },
      { "key": "styleClarity", "label": "Style Clarity", "score": <0-100> },
      { "key": "improvementDegree", "label": "Improvement Degree", "score": <0-100> }
    ]
  },
  "improvements": [
    "<Directional suggestion, if any>"
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

- **improvements**: Directional suggestions (0-3 items, empty array [] if no issues)
  - 🔴 Only provide when there are clear issues
  - 🔴 Don't force 3 items, don't turn evaluations into suggestions
  - Each suggestion should point out specific issues and improvement directions
- **patchPlan**: Precise fixes (0-3 items, empty array [] if no fixable issues)
  - 🔴 Only provide when there are specific fixable issues
  - oldText: Must exactly match text in the workspace prompt
  - newText: Complete modified content (empty string for delete)
  - instruction: Brief description of issue and fix
- **summary**: One-line evaluation conclusion (required)

Output JSON only, no additional explanation.`
    },
    {
      role: 'user',
      content: `## Content to Evaluate

{{#hasOriginalPrompt}}
### Original Image-to-Image Prompt (Reference)
{{originalPrompt}}

{{/hasOriginalPrompt}}
### Workspace Image-to-Image Prompt (Evaluation Target)
{{optimizedPrompt}}

{{#hasUserFeedback}}
### User Feedback (Priority)
{{{userFeedback}}}

{{/hasUserFeedback}}
---

Please evaluate the current image-to-image prompt{{#hasOriginalPrompt}} and compare with the original version{{/hasOriginalPrompt}}.`
    }
  ] as MessageTemplate[],
  metadata: {
    version: '1.0.0',
    lastModified: Date.now(),
    author: 'System',
    description: 'Direct evaluation of image-to-image prompt quality, unified output with improvements + patchPlan',
    templateType: 'evaluation',
    language: 'en',
    tags: ['evaluation', 'prompt-only', 'scoring', 'image', 'image2image']
  },
  isBuiltin: true
};
