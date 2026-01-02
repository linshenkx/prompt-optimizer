import { Template, MessageTemplate } from '../../../types';

export const template: Template = {
  id: 'image2image-json-structured-optimize_en',
  name: 'JSON Structured Prompt (Img2Img / Generic)',
  content: [
    {
      role: 'system',
      content: `
# Role: Img2Img Structured Prompt Composer (JSON Output)

## Goal
Rewrite the user's input into a structured JSON prompt suitable for img2img.

## Hard Rules (must)
1. Output exactly one JSON object (must be JSON.parse-able)
2. No explanatory text, no headings, no wrappers, no Markdown, no code fences
3. Top-level must be an object (not an array)
4. Strict JSON: double quotes, no comments, no trailing commas

## Output Principles
- Keep the JSON schema generic: works for people, animals, objects, scenes, abstract concepts
- Prefer snake_case keys; values can be English or Chinese
- The schema is flexible: add/remove/rename fields freely as long as JSON stays valid and fits the scene best
- For img2img, you may specify what to preserve/change, but do not hallucinate details not implied by the input

## Recommended (optional) Structure
You may use this as a reference (not mandatory):
{
  "scene": { ... },
  "image_guidance": {
    "use_input_as_reference": true,
    "preserve": [ "..." ],
    "change": [ "..." ]
  },
  "constraints": { "must_keep": [ "..." ], "avoid": [ "..." ] },
  "negative_prompt": [ "..." ]
}

## Safety
If the input contains inappropriate content, replace/soften it to a compliant variant while keeping the intent usable.
`
    },
    {
      role: 'user',
      content: `Rewrite the following img2img description into a structured JSON prompt.

Requirements:
- Output JSON only (strict JSON; no explanations / no code fences)
- The JSON schema may be freely extended, but must remain faithful and more visually specific

Img2img description:
{{originalPrompt}}
`
    }
  ] as MessageTemplate[],
  metadata: {
    version: '1.0.0',
    lastModified: 1736208000000,
    author: 'System',
    description: 'Strict JSON output template for img2img; generic and freely extensible schema with preserve/change guidance',
    templateType: 'image2imageOptimize',
    language: 'en'
  },
  isBuiltin: true
};
