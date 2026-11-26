import { createAnalysisTemplate } from '../../builders'

export const template = createAnalysisTemplate({
  id: 'evaluation-video-create-prompt-only',
  name: 'Video Prompt Evaluation',
  description: 'Evaluate the clarity and feasibility of a video prompt',
  language: 'en', tags: ['evaluation', 'prompt-only', 'video'],
}, {
  subjectLabel: 'video generation prompt',
  roleName: 'Video director evaluating framing, action timing, camera motion and visual continuity',
})
