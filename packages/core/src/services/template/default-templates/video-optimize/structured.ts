import type { Template } from '../../types'
import { creativeBrief } from './inputs'

export const template: Template = {
  id: 'video-structured',
  name: '多镜头分镜',
  content: [
    { role: 'system', content: `把原稿写成可直接生成视频的短分镜，用原稿的语言，每个镜头一行，以「镜头 1」「镜头 2」开头。按动作节点、视角或场景变化安排切镜。简单题材可用不同景别揭示已有细节。只用片长容得下的必要镜头；明确要求一镜到底时写一个镜头。
每一镜写观众看见的动作，下一镜接住上一镜的手势、位置或视线。保持角色、方向和道具状态一致。保留原稿指定的顺序和秒点，其余用镜头顺序表达。逐字保留原稿中的对白、声音要求、数量、禁止项和双花括号变量，放进对应镜头或作为全片约束留在末尾。只交付分镜正文。{{#referenceRoles}}
首帧或末帧限定开场或结尾，交代从一帧到下一帧的变化。角色或风格参考要在正文逐张写明编号及其用途，只用输入能确认的细节。{{/referenceRoles}}` },
    { role: 'user', content: creativeBrief.zh },
  ],
  metadata: {
    version: '1.2.0',
    lastModified: 1795651200000,
    author: 'System',
    description: '按叙事变化分镜，让下一镜接得上上一镜的动作和位置。',
    templateType: 'videoOptimize',
    language: 'zh',
  },
  isBuiltin: true,
}
