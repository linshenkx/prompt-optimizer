const context = {
  zh: `{{#hasReferenceImages}}参考图（按上传顺序）
{{{referenceRoles}}}
在正文按用途引用需要使用的图片，并用上传序号标明对应图片。
{{/hasReferenceImages}}{{#hasFrameImages}}帧图（按发送顺序）
{{{referenceRoles}}}
首帧锚定开场，尾帧（如有）锚定结尾。描述动作和运镜如何衔接，不使用图片编号标签。
{{/hasFrameImages}}{{#referenceRoles}}{{^hasInputImages}}当前只有图片列表，没有画面内容。以创作要求为依据，避免猜测图中细节。
{{/hasInputImages}}{{/referenceRoles}}`,
  en: `{{#hasReferenceImages}}Reference images in upload order
{{{referenceRoles}}}
Refer to relevant images by upload number and intended use.
{{/hasReferenceImages}}{{#hasFrameImages}}Frame images in submission order
{{{referenceRoles}}}
Anchor the opening with the first frame and the ending with the last frame if supplied. Describe how the action and camera move connect without numbered image tags.
{{/hasFrameImages}}{{#referenceRoles}}{{^hasInputImages}}Only the image list is available. Rely on the creative brief for visual details instead of guessing the image contents.
{{/hasInputImages}}{{/referenceRoles}}`,
}

export const creativeBrief = {
  zh: `仅使用创作要求明确给出的时长、画幅、分辨率与时间点。没有明确时长或秒点时，用动作顺序和相对节奏表达。
${context.zh}
{{{originalPrompt}}}`,
  en: `Use any duration, aspect ratio, resolution or timestamps explicitly provided in the brief. Use action order and relative pacing when no duration or timestamps are specified.
${context.en}
{{{originalPrompt}}}`,
}

export const revisionBrief = {
  zh: `${context.zh}

{{#originalPrompt}}创作背景
{{{originalPrompt}}}

{{/originalPrompt}}待编辑稿
{{{lastOptimizedPrompt}}}

这次只改
{{{iterateInput}}}`,
  en: `${context.en}

{{#originalPrompt}}Original brief
{{{originalPrompt}}}

{{/originalPrompt}}Current draft
{{{lastOptimizedPrompt}}}

Make this change
{{{iterateInput}}}`,
}
