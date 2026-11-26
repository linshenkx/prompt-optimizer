import { createAnalysisTemplate } from '../../builders'

export const template = createAnalysisTemplate({
  id: 'evaluation-video-create-prompt-only',
  name: '视频提示词评估',
  description: '评估动作、运镜、时序与画面连续性',
  language: 'zh', tags: ['evaluation', 'prompt-only', 'video'],
}, {
  subjectLabel: '视频生成提示词',
  roleName: '评估构图、动作时序、运镜与画面连续性的视频导演',
})
