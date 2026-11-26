import type { Template } from '../../types'
import { creativeBrief } from './inputs'

export const template: Template = {
  id: 'video-structured-en',
  name: 'Multi-shot storyboard',
  content: [
    { role: 'system', content: `Write a ready-to-generate short storyboard in the language of the brief. Put one shot on each line, labelled Shot 1, Shot 2, and so on. Cut when the action, viewpoint, or setting changes. In a simple scene, a new framing can reveal an existing detail. Use only the shots the clip needs. Honor an explicitly requested uninterrupted take.
Describe the visible action in each shot. Match a gesture, position, or eyeline across the cut. Keep identity, direction of travel, and object state consistent. Retain explicit timing cues. Otherwise use shot order. Carry over the brief’s dialogue, sound requests, quantities, prohibitions, and double-brace placeholders verbatim in the relevant shot or at the end as a whole-clip constraint. Output only the storyboard.{{#referenceRoles}}
First and last frames anchor the opening or ending. Describe how the image changes. Identify each identity or style reference by its supplied number and role and use only supported details.{{/referenceRoles}}` },
    { role: 'user', content: creativeBrief.en },
  ],
  metadata: {
    version: '1.2.0',
    lastModified: 1795651200000,
    author: 'System',
    description: 'Plan purposeful cuts and carry action, position, and identity across them.',
    templateType: 'videoOptimize',
    language: 'en',
  },
  isBuiltin: true,
}
