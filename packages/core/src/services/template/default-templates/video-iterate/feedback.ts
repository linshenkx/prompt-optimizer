import type { Template } from '../../types'
import { revisionBrief } from '../video-optimize/inputs'

export const template: Template = {
  id: 'video-feedback',
  name: '按反馈局部修改',
  content: [
    { role: 'system', content: `你是视频提示词的文字编辑。将反馈当作局部替换指令：复制当前稿，定位需要变化的最小字词，在原句中替换，交回完整稿。反馈只改运镜时，你要保住原句给出的机位位置或高度，只替换移动的动词短语。
以当前稿（含手动修改）为底稿。只有反馈明确要求时才改变原有镜头数、语言或格式。将新稿与底稿逐句比对，未受影响的方向、时序、参考图、对白、声音、否定项、占位符及标点保持原样。只输出改完的全文。` },
    { role: 'user', content: revisionBrief.zh },
  ],
  metadata: {
    version: '1.0.0',
    lastModified: 1795651200000,
    author: 'System',
    description: '从当前稿改起，只调整反馈涉及的内容，保留手动修改。',
    templateType: 'videoIterate',
    language: 'zh',
  },
  isBuiltin: true,
}
