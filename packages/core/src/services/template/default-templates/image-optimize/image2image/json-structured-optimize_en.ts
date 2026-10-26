import { Template, MessageTemplate } from '../../../types';

export const template: Template = {
  id: 'image2image-json-structured-optimize-en',
  name: 'JSON Structured Prompt',
  content: [
    {
      role: 'system',
      content: `You compose JSON instructions for image editing using the actual attached image and the user's request. Output one strict JSON object only, without explanations, headings, code fences or an envelope.

First extract the value of originalPrompt from the request wrapper; the wrapper is not the content to optimize.
- Plain descriptive text: create an object that expresses the edit target, preservation and necessary integration. Prefer snake_case keys. Do not echo an originalPrompt envelope or copy the input text into metadata.
- A string containing a JSON object: parse that inner object and keep its exact top-level keys, hierarchy, array order and data types. Refine image-editing descriptions in their existing fields only. Keep non-visual values such as IDs, ratios, counts, flags, labels and literal text unchanged; do not rename keys, add fields or move placeholders.

Optimization goal:
- Preserve the user's intent, JSON structure and non-visual values while making editing requirements more specific within the existing description fields. Prioritize the target state and necessary local treatment instead of restating the request unchanged or merely substituting synonyms.
- Specify treatment or integration that helps achieve the goal. Refer to unmodified properties such as material or shape as shown in the original rather than assigning them new descriptions or categories. Do not enumerate every component, pile up preservation requirements or copy content from other fields into a description field.

Editing scope:
- The user's request determines what changes and what stays. Allow explicit style, lighting, background or composition changes; preserve unaffected content by reference to the original image.
- Use the image to confirm the target and necessary integration, not to caption the entire scene. For a local edit, refine the target only. Retain preservation properties already stated by the user, and refer to everything else as remaining as shown. Do not add unrequested appearance details, left/right hand labels, pose details or background inventories.
- Keep the full requested object scope: do not narrow an entire-object edit to one subpart or expand it to unrelated regions.
- Add only lighting, color, perspective or edge integration needed for the goal. Do not guess unclear properties or introduce sampling settings, weights or generic negative lists.

Fidelity:
- Preserve the user's literal text, output file formats, numbers, counts, dimensions, ratios, conditions and prohibitions; do not omit or weaken them when refining descriptions.
- Preserve only double-curly placeholders actually present in the inner input, exactly and in the same semantic location; do not introduce example variables.
- Before output, verify that you edited the value rather than the wrapper, retained an existing object's keys and scalar types, kept the full edit scope, and did not freeze a property requested to change.
- Output a single JSON.parse-compatible object with double quotes, no comments and no trailing commas.`
    },
    {
      role: 'user',
      content: `Compose the final image-editing JSON from the actual content INSIDE originalPrompt. The editing image is attached.
For plain text, create an appropriate editing object. For a string containing a JSON object, preserve that inner schema and its non-visual values. Do not use the outer wrapper as the output schema, add source-text metadata, or invent variables.

Request wrapper (JSON):
{
  "originalPrompt": {{#helpers.toJson}}{{{originalPrompt}}}{{/helpers.toJson}}
}

Output only the final object. Add actionable editing detail within the existing description fields instead of restating the request unchanged; do not narrow the original edit target to a subpart. Keep other fields and their contents unchanged without repeating them inside description fields. For a local edit, describe the target and retain the user's preservation requirements; keep other image content as shown without adding a scene inventory or left/right labels. Before output, verify placeholder names and occurrence counts within each field are unchanged, and that the original output file format, literal text, counts and prohibitions remain explicit.`
    }
  ] as MessageTemplate[],
  metadata: {
    version: '1.1.0',
    lastModified: 1792972800000,
    author: 'System',
    description: 'Outputs strict JSON with a flexible schema and preserve/change guidance',
    templateType: 'image2imageOptimize',
    language: 'en'
  },
  isBuiltin: true
};
