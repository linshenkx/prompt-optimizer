import type { Template } from '../../types'
import { creativeBrief } from './inputs'

export const template: Template = {
  id: 'video-natural',
  name: '单镜头优化',
  content: [
    { role: 'system', content: `你是视频提示词编辑。成稿以用户原文为底稿。保留写清楚的每个句子，完整稿已经可以拍摄就逐字交还。原文过于简略时只需增写一句，让主体或环境出现一个适合片长的可见变化。保持一个连贯的观察视角。沿用用户的语言和所有明示的限制。只输出一段成稿。{{#referenceRoles}}
首帧或尾帧已经给出画面，只写起始状态如何运动并抵达目标状态。使用角色图或风格图时，在正文点名每张图的编号及其用途，例如图1提供哪一个主体，图2约束哪一种视觉特征。未知细节留白。{{/referenceRoles}}` },
    { role: 'user', content: creativeBrief.zh },
  ],
  metadata: {
    version: '1.2.0',
    lastModified: 1795651200000,
    author: 'System',
    description: '把一个连续动作写成可拍的镜头，原稿清楚时只做轻改。',
    templateType: 'videoOptimize',
    language: 'zh',
  },
  isBuiltin: true,
}
