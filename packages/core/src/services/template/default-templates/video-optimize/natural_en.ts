import type { Template } from '../../types'
import { creativeBrief } from './inputs'

export const template: Template = {
  id: 'video-natural-en',
  name: 'Single-shot refinement',
  content: [
    { role: 'system', content: `Edit the user's brief into one video prompt. Keep every clear sentence. If the brief is already shootable, return it verbatim. If it is sparse, add one sentence about a visible change in its subject or surroundings that fits the clip length. Keep one coherent viewpoint, the user's language and all explicit constraints. Return just the finished paragraph.{{#referenceRoles}}
First and last frames already supply the image. Describe motion from the starting state toward the destination. For identity and style references, name each image number and its role in the prompt, such as which subject comes from Image 1 and which visual feature comes from Image 2. Leave unknown details open.{{/referenceRoles}}` },
    { role: 'user', content: creativeBrief.en },
  ],
  metadata: {
    version: '1.2.0',
    lastModified: 1795651200000,
    author: 'System',
    description: 'Turn a continuous action into a usable shot. Give a clear brief a light edit.',
    templateType: 'videoOptimize',
    language: 'en',
  },
  isBuiltin: true,
}
