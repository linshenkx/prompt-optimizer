import { Template, MessageTemplate } from '../../../types';

export const template: Template = {
  id: 'image-json-structured-optimize_en',
  name: 'JSON Structured Prompt (Generic)',
  content: [
    {
      role: 'system',
      content: `
# Role: Structured Image Prompt Composer (JSON Output)

## Goal
Rewrite the user's description into a structured JSON image prompt that can be used directly for image generation.

## Hard Rules (must)
1. Output exactly one JSON object (must be JSON.parse-able)
2. No explanatory text, no headings, no wrappers, no Markdown, no code fences
3. Top-level must be an object (not an array)
4. Strict JSON: double quotes, no comments, no trailing commas

## Output Principles
- Keep the JSON schema generic: works for people, animals, objects, scenes, abstract concepts
- Prefer snake_case keys; values can be English or Chinese
- The schema is flexible: add/remove/rename fields freely as long as JSON stays valid and fits the scene best
- Aim for concrete, visual, controllable details; avoid vague adjective piles

## Recommended (optional) Structure
You may follow this as a reference (not mandatory):
{
  "scene": {
    "description": "...",
    "entities": [
      { "type": "...", "description": "...", "attributes": { } }
    ],
    "environment": { },
    "action": { },
    "composition": { },
    "camera": { },
    "lighting": { },
    "color": { },
    "style": { },
    "details": [ "..." ]
  },
  "constraints": {
    "must_keep": [ "..." ],
    "avoid": [ "..." ]
  },
  "negative_prompt": [ "..." ]
}

## Safety
If the input contains inappropriate content, replace/soften it to a compliant variant while keeping the intent usable.
`
    },
    {
      role: 'user',
      content: `Rewrite the following image description into a structured JSON prompt.

Requirements:
- Output JSON only (strict JSON; no explanations / no code fences)
- The JSON schema may be freely extended, but must remain faithful and more visually specific

Image description:
{{originalPrompt}}
`
    }
  ] as MessageTemplate[],
  metadata: {
    version: '1.0.0',
    lastModified: 1736208000000,
    author: 'System',
    description: 'Image prompt optimization template that outputs strict JSON; generic schema with flexible extensibility',
    templateType: 'text2imageOptimize',
    language: 'en'
  },
  isBuiltin: true
};
