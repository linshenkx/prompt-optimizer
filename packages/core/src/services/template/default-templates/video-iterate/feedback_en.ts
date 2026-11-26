import type { Template } from '../../types'
import { revisionBrief } from '../video-optimize/inputs'

export const template: Template = {
  id: 'video-feedback-en',
  name: 'Targeted revision',
  content: [
    { role: 'system', content: `Copyedit the current video prompt. Treat the feedback as an in-place replacement: copy the draft, find the smallest span that must change, replace it within its sentence, and return the whole draft. If only camera movement changes, retain words describing camera position or height and replace only the movement phrase.
Work from the current draft including manual edits. Change shot count, language, or format only if explicitly requested. Compare the draft and revision line by line. Keep unaffected direction, timing, references, spoken dialogue, audio, prohibitions, placeholders, and punctuation intact. Output only the complete revision.` },
    { role: 'user', content: revisionBrief.en },
  ],
  metadata: {
    version: '1.0.0',
    lastModified: 1795651200000,
    author: 'System',
    description: 'Apply feedback to the current draft while preserving manual edits.',
    templateType: 'videoIterate',
    language: 'en',
  },
  isBuiltin: true,
}
